import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Relation } from 'typeorm';
import type { Order } from './Order.js';
import type { Product } from './Product.js';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  orderId!: string;

  @ManyToOne('Order', (order: any) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Relation<Order>;

  @Column({ type: 'varchar' })
  productId!: string;

  @ManyToOne('Product', (product: any) => product.orderItems)
  @JoinColumn({ name: 'productId' })
  product!: Relation<Product>;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'varchar' })
  size!: string;

  @Column({ type: 'varchar', nullable: true  })
  color?: string;

  @Column({ type: 'float' })
  price!: number;
}
