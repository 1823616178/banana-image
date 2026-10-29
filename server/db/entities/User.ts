import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt, UpdatedAt } from '#server/db/columns'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'varchar', length: 32, unique: true })
  username!: string

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string

  @Column({ type: 'enum', enum: ['admin', 'user'], default: 'user' })
  role!: 'admin' | 'user'

  @Column({ type: 'boolean', default: false })
  disabled!: boolean

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastLoginAt!: Date | null

  @CreatedAt()
  createdAt!: Date

  @UpdatedAt()
  updatedAt!: Date
}
