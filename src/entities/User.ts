import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Relation } from 'typeorm';
import type { Address } from './Address.js';
import type { Order } from './Order.js';
import type { Review } from './Review.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', unique: true  })
  email!: string;

  @Column({ type: 'varchar' })
  phone!: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ type: 'varchar', nullable: true })
  password?: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  googleId?: string;

  @Column({ type: 'boolean', default: false })
  isGoogleUser!: boolean;

  @Column({ type: 'varchar', default: 'customer'  })
  role!: string;

  @Column({ type: 'boolean', default: true  })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: true  })
  otp?: string;

  @Column({ type: 'timestamp', nullable: true })
  otpExpires?: Date;

  @Column({ type: 'boolean', default: false  })
  isVerified!: boolean;

  @Column({ type: 'varchar', nullable: true  })
  resetPasswordToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  resetPasswordExpires?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Security
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  lockoutUntil?: Date;

  @OneToMany('Order', (order: any) => order.user)
  orders!: Relation<Order[]>;

  @OneToMany('Address', (address: any) => address.user)
  addresses!: Relation<Address[]>;

  @OneToMany('Review', (review: any) => review.user)
  reviews!: Relation<Review[]>;
}
