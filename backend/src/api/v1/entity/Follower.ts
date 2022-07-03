// 👇 Typeorm
import { JoinTable, ManyToMany } from 'typeorm';
// 👇 Entities
import Date from './Date';
import User from './User';

export default abstract class Entity extends Date {
  @ManyToMany(() => User, { cascade: true })
  @JoinTable({
    name: 'followers',
    joinColumn: {
      name: 'user',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'following',
      referencedColumnName: 'id',
    },
  })
  following: User[];
}
