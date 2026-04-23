import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Relation } from 'typeorm';
import type { Order } from './Order.js';
import type { User } from './User.js';

@Entity('return_requests')
export class ReturnRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  orderId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne('Order', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId', referencedColumnName: 'orderId' })
  order!: Relation<Order>;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'varchar', default: 'Pending' })
  status!: string; // 'Pending', 'Approved', 'Rejected', 'Processed'

  @Column({ type: 'text', nullable: true })
  adminNotes?: string;

  @Column({ type: 'simple-json', nullable: true })
  images?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
