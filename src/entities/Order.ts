import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, OneToOne, JoinColumn, Relation } from 'typeorm';
import type { User } from './User.js';
import type { OrderItem } from './OrderItem.js';
import type { Transaction } from './Transaction.js';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true  })
  orderId!: string;

  @Column({ type: 'varchar', nullable: true  })
  userId?: string;

  @ManyToOne('User', (user: any) => user.orders, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  @Column({ type: 'float' })
  total!: number;

  @Column({ type: 'float', nullable: true })
  originalTotal?: number | null;

  @Column({ type: 'float', nullable: true })
  discount?: number | null;

  @Column({ type: 'varchar', nullable: true  })
  couponCode?: string | null;

  @Column({ type: 'varchar', default: 'Pending'  })
  status!: string;

  @Column({ type: 'varchar', nullable: true })
  paymentStatus?: string; // 'Pending' | 'Paid' | 'Failed'

  @Column({ type: 'varchar', nullable: true })
  razorpayOrderId?: string;

  @Column({ type: 'varchar', nullable: true })
  razorpayPaymentId?: string;

  @Column({ type: 'varchar', nullable: true  })
  trackingNumber?: string;

  @Column({ type: 'varchar' })
  paymentMethod!: string;

  // Customer Info snapshot
  @Column({ type: 'varchar' })
  customerName!: string;

  @Column({ type: 'varchar' })
  customerEmail!: string;

  @Column({ type: 'varchar' })
  customerPhone!: string;

  @Column({ type: 'text' })
  customerAddress!: string;

  @Column({ type: 'varchar' })
  customerCity!: string;

  @Column({ type: 'varchar' })
  customerPincode!: string;

  @Column({ type: 'timestamp', nullable: true })
  delayedDeliveryDate?: Date | null;

  @Column({ type: 'text', nullable: true })
  delayReason?: string | null;

  @Column({ type: 'text', nullable: true })
  cancelReason?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  orderDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany('OrderItem', (orderItem: any) => orderItem.order, { cascade: true })
  items!: Relation<OrderItem[]>;

  @OneToOne('Transaction', (transaction: any) => transaction.order)
  transaction?: Relation<Transaction>;
}
