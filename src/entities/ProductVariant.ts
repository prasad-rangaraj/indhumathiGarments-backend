import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Relation } from 'typeorm';
import type { Product } from './Product.js';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  productId?: string;

  @ManyToOne('Product', (product: any) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product!: Relation<Product>;

  @Column({ type: 'varchar', nullable: true })
  sku?: string;

  @Column({ type: 'varchar', nullable: true })
  size?: string;

  @Column({ type: 'varchar', nullable: true })
  color?: string;

  @Column({ type: 'int', default: 0 })
  stockQuantity!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
