// 👇 Typeorm
import { Entity, PrimaryGeneratedColumn, JoinColumn, ManyToOne, OneToOne, Index, Column } from 'typeorm';
// 👇 Entities
import User from './User';
import Date from './Date';
import Message from './Message';

// 👇 database name
@Entity('conversations')
// 👇 unique constraints
@Index(['from', 'to'], { unique: true })
export default class Conversation extends Date {
  constructor(message: Partial<Conversation>) {
    super();
    Object.assign(this, message);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.conversationFrom, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'from',
    referencedColumnName: 'id',
  })
  from: Partial<User>;

  @ManyToOne(() => User, (user) => user.conversationTo, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'to',
    referencedColumnName: 'id',
  })
  to: Partial<User>;

  @OneToOne(() => Message, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'message',
    referencedColumnName: 'id',
  })
  message: Partial<Message>;

  @Column('boolean', { default: false })
  seen: boolean;
}
