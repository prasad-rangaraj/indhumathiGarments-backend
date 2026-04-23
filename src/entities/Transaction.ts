import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Relation, ManyToOne, JoinColumn } from 'typeorm';
import type { Order } from './Order.js';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  orderId?: string;

  @ManyToOne('Order', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'orderId' })
  order?: Relation<Order>;

  @Column({ type: 'varchar' })
  gatewayTransactionId!: string;

  @Column({ type: 'varchar', nullable: true })
  signature?: string;

  @Column({ type: 'float' })
  amount!: number;

  @Column({ type: 'varchar', default: 'pending' })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
