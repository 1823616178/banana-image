import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt, UpdatedAt } from '#server/db/columns'

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'varchar', length: 64, unique: true })
  key!: string

  @Column({ type: 'json' })
  value!: unknown

  @CreatedAt()
  createdAt!: Date

  @UpdatedAt()
  updatedAt!: Date
}
