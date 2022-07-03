// 👇 Typeorm
import { Entity, Column, BeforeInsert, OneToMany, PrimaryGeneratedColumn, AfterLoad } from 'typeorm';
// 👇 Generators & Validators
import argon2 from 'argon2';
import { IsEmail, Length, Matches } from 'class-validator';
// 👇 Entities
import Post from './Post';
import Follower from './Follower';
import Message from './Message';
import Reaction from './Reaction';
import Conversation from './Conversation';
import Notification from './Notification';
// 👇 Constants, Helpers & Types
import { AuthType, Gender, NotificationType } from '../types/enum';

// 👇 database name
@Entity('users')
export default class User extends Follower {
  constructor(user: Partial<User>) {
    super();
    Object.assign(this, user);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 /* unique: true */ })
  @IsEmail({ message: 'Email is invalid.' })
  email: string;

  @Column('varchar', { length: 128 })
  @Length(3, 128, { message: 'Name must be between 3 to 128 characters long.' })
  name: string;

  @Column('varchar', { length: 25 /* unique: true */ })
  @Length(3, 25, { message: 'Username must be between 3 to 25 characters long.' })
  @Matches(/^[a-zA-Z0-9]+$/, { message: 'Username should contain only letters and numbers.' })
  username: string;

  @Column({ type: 'enum', enum: Gender, default: Gender.NEUTRAL })
  gender: Gender;

  // 👇 null value for password if OAuth authentication
  @Column('varchar', { length: 256, nullable: true })
  @Length(6, 256, { message: 'Password must be at least 6 characters long.' })
  password: string;

  @Column('varchar', { length: 256, nullable: true })
  bio: string;

  @Column('varchar', { length: 25 /* default: AuthType.PASSWORD */ })
  auth: AuthType;

  @Column('timestamp without time zone', { nullable: true })
  active: Date;

  @OneToMany(() => Post, (posts) => posts.createdBy)
  posts: Post[];

  @OneToMany(() => Message, (messages) => messages.from)
  messageFrom: Message[];

  @OneToMany(() => Message, (messages) => messages.to)
  messageTo: Message[];

  @OneToMany(() => Conversation, (conversation) => conversation.from)
  conversationFrom: Message[];

  @OneToMany(() => Conversation, (conversation) => conversation.to)
  conversationTo: Message[];

  @OneToMany(() => Notification, (notification) => notification.from)
  notificationFrom: Message[];

  @OneToMany(() => Notification, (notification) => notification.to)
  notificationTo: Message[];

  @OneToMany(() => Reaction, (reactions) => reactions.user)
  reactions: Reaction[];

  @Column('boolean', { default: true })
  notification: boolean;

  // 👇 notification and conversation counts to be loader after getting user from database
  notifications: {
    total: number;
    type: NotificationType | 'CONVERSATIONS';
  }[];

  // 👇 mutual status in reference to another user
  mutual: string;

  // 👇 toke key for websocket authentication
  token: string;

  @BeforeInsert()
  protected async beforeInsert() {
    // 👇 name and email to lowercase
    this.username = this.username.toLowerCase();
    this.email = this.email.toLowerCase();
    // 👇 hash password
    if (this.auth === AuthType.PASSWORD) {
      this.password = await argon2.hash(this.password);
    }
  }
}
