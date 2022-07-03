// 👇 Typeorm
import { Entity, Column, PrimaryGeneratedColumn, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
// 👇 Entities
import Reaction from './Reaction';
import User from './User';
import Date from './Date';
// 👇 Constants, Helpers & Types
import { MessageType } from '../types/enum';

// 👇 database name
@Entity('messages')
export default class Message extends Date {
  constructor(message: Partial<Message>) {
    super();
    Object.assign(this, message);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { select: false })
  body: string;

  @ManyToOne(() => User, (user) => user.messageFrom, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'from',
    referencedColumnName: 'id',
  })
  from: Partial<User>;

  @ManyToOne(() => User, (user) => user.messageTo, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'to',
    referencedColumnName: 'id',
  })
  to: Partial<User>;

  @OneToMany(() => Reaction, (reactions) => reactions.message)
  reactions: Reaction[];

  @Column('boolean', { default: false })
  deleted: boolean;

  @Column('boolean', { default: false })
  missed: boolean;

  @Column('varchar', { length: 10, nullable: true })
  media: string | null;

  // 👇 status for message notification
  type: MessageType;
}
