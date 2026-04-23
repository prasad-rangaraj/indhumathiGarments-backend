import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Relation } from 'typeorm';
import type { Product } from './Product.js';

@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string; // Can be session ID or User ID for guests

  @Column({ type: 'varchar' })
  productId!: string;

  @ManyToOne('Product', (product: any) => product.cartItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Relation<Product>;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'varchar' })
  size!: string;

  @Column({ type: 'varchar', nullable: true  })
  color?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
