// 👇 Typeorm
import { BaseEntity, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export default abstract class Entity extends BaseEntity {
  @CreateDateColumn()
  createdDate: Date;

  @UpdateDateColumn()
  updatedDate: Date;
}
