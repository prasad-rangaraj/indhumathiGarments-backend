import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  adminId!: string;

  @Column({ type: 'varchar' })
  adminEmail!: string;

  @Column({ type: 'varchar' })
  action!: string; // e.g., 'UPDATE_ROLE', 'DELETE_USER', 'UPDATE_ORDER_STATUS'

  @Column({ type: 'varchar' })
  entityType!: string; // e.g., 'USER', 'ORDER', 'PRODUCT'

  @Column({ type: 'varchar' })
  entityId!: string;

  @Column({ type: 'text', nullable: true })
  details?: string; // JSON string containing whatever was changed

  @CreateDateColumn()
  createdAt!: Date;
}
