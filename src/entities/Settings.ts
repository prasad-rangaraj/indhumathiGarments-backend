import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true  })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'boolean', default: false  })
  isEncrypted!: boolean;

  @Column({ type: 'varchar', nullable: true  })
  description?: string;

  @Column({ type: 'varchar', nullable: true  })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
