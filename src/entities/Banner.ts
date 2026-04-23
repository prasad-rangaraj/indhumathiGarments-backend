import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'varchar', nullable: true  })
  description?: string;

  @Column({ type: 'varchar' })
  image!: string;

  @Column({ type: 'varchar', nullable: true  })
  link?: string;

  @Column({ type: 'varchar' })
  position!: string;

  @Column({ type: 'boolean', default: true  })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  order!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
