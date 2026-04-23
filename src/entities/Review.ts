import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Relation } from 'typeorm';
import type { User } from './User.js';
import type { Product } from './Product.js';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  productId!: string;

  @ManyToOne('Product', (product: any) => product.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Relation<Product>;

  @Column({ type: 'varchar', nullable: true  })
  userId?: string;

  @ManyToOne('User', (user: any) => user.reviews, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'varchar', nullable: true  })
  title?: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'json', nullable: true, default: [] })
  images!: string[];

  @Column({ type: 'boolean', default: false  })
  isApproved!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
