// 👇 Typeorm
import { JoinTable, ManyToMany } from 'typeorm';
// 👇 Entities
import Date from './Date';
import User from './User';

export default abstract class Like extends Date {
  @ManyToMany(() => User, { cascade: true })
  @JoinTable({
    name: 'likes',
    joinColumn: {
      name: 'postId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'userId',
      referencedColumnName: 'id',
    },
  })
  likes: Partial<User>[];
}
