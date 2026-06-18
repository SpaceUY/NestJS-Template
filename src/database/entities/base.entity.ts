import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Generated,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  // Integer PK — used for internal joins and FK references only.
  // Never expose this in API responses; use `uuid` instead.
  @PrimaryGeneratedColumn()
  id: number;

  // UUID — the public-facing identifier safe to expose in API responses.
  // It avoids leaking sequential integer IDs to external consumers.
  // If your project doesn't need to hide sequential IDs, you can simplify
  // by dropping this field and using `id` everywhere.
  @Column({ unique: true })
  @Generated('uuid')
  uuid: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
