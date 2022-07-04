import { validate } from 'class-validator';
import {
  BeforeInsert,
  BeforeUpdate,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ precision: 0 })
  createdAt: Date;

  @UpdateDateColumn({ precision: 0 })
  updatedAt: Date;

  @DeleteDateColumn({ precision: 0 })
  deletedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  protected async validation(): Promise<void> {
    const errors = await validate(this);
    if (errors.length > 0) {
      throw errors;
    }
  }
}
