// 👇 Typeorm
import { BeforeInsert, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
// 👇 Entities
import Date from './Date';
import User from './User';
import Message from './Message';
// 👇 Constants, Helpers & Types
import { reactions } from '../constants';
import { ReactionKeys } from '../types';
import { uniqueId } from '../helpers';

// 👇 database name
@Entity('reactions')
// 👇 unique constraints
@Index(['user', 'message'], { unique: true })
export default class Reaction extends Date {
  constructor(reaction: Partial<Reaction>) {
    super();
    Object.assign(this, reaction);
  }

  @PrimaryColumn({ length: 16, type: 'varchar' })
  id: string;

  @Column({ type: 'enum', enum: Object.keys(reactions), nullable: false })
  reaction: ReactionKeys;

  @ManyToOne(() => User, (user) => user.reactions, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    referencedColumnName: 'id',
  })
  user: User;

  @ManyToOne(() => Message, (message) => message.reactions, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'messageId',
    referencedColumnName: 'id',
  })
  message: Message;

  // 👇 generate unique identifier for primary key column before insert to database
  @BeforeInsert()
  protected beforeInsert() {
    this.id = uniqueId();
  }
}
