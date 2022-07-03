// 👇 Typeorm
import { Entity, Column, ManyToOne, JoinColumn, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
// 👇 Entities
import User from './User';
import Like from './Like';

// 👇 database name
@Entity('posts')
export default class Post extends Like {
  constructor(post: Partial<Post>) {
    super();
    Object.assign(this, post);
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { default: '' })
  body: string;

  @Column('varchar', { length: 16, nullable: true })
  media: string | null;

  @OneToMany(() => Post, (posts) => posts.parent)
  comments: Post[];

  @ManyToOne(() => Post, (post) => post.comments, {
    nullable: true,
    onDelete: 'CASCADE',
    // createForeignKeyConstraints: false,
  })
  @JoinColumn({
    name: 'parent',
    referencedColumnName: 'id',
  })
  parent: Partial<Post> | null;

  @ManyToOne(() => User, (user) => user.posts, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    referencedColumnName: 'id',
  })
  createdBy: Partial<User>;

  // 👇 posts stats to be loaded after query using aggregate functions
  stats: {
    likes: number;
    comments: number;
    liked: number;
  };
}
