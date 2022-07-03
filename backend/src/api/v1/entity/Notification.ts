// 👇 Typeorm
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
// 👇 Entities
import User from './User';
import Date from './Date';
// 👇 Constants, Helpers & Types
import { NotificationType } from '../types/enum';

// 👇 database name
@Entity('notifications')
export default class Notification extends Date {
  constructor(notification: Partial<Notification>) {
    super();
    Object.assign(this, notification);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.notificationFrom, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'from',
    referencedColumnName: 'id',
  })
  from: Partial<User>;

  @ManyToOne(() => User, (user) => user.notificationTo, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'to',
    referencedColumnName: 'id',
  })
  to: Partial<User>;

  @Column('boolean', { default: false })
  seen: boolean;

  @Column('varchar', { length: 36, nullable: false })
  identifier: string;

  @Column({ type: 'enum', enum: NotificationType, nullable: false })
  type: NotificationType | 'VIEWED';

  // 👇 seen notification count
  viewed: number;
}
