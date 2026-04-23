import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar' })
  type!: string; // 'NEW_ORDER', 'LOW_STOCK', 'RETURN_REQUEST', etc.

  @Column({ type: 'varchar', nullable: true })
  link?: string; // Optional URL or reference ID

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
