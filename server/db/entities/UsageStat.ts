import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt, UpdatedAt } from '#server/db/columns'

const numericTransformer = { to: (value: number) => value, from: (value: string | null) => value === null ? 0 : Number(value) }

@Entity('usage_stats')
@Index('uq_usage_stats_date_model', ['date', 'model'], { unique: true })
export class UsageStat {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'date' })
  date!: string

  @Column({ type: 'varchar', length: 64 })
  model!: string

  @Column({ type: 'int', unsigned: true, default: 0 })
  images!: number

  @Column({ type: 'bigint', unsigned: true, default: 0, transformer: numericTransformer })
  inputTokens!: number

  @Column({ type: 'bigint', unsigned: true, default: 0, transformer: numericTransformer })
  outputTokens!: number

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  costUsd!: string

  @CreatedAt()
  createdAt!: Date

  @UpdatedAt()
  updatedAt!: Date
}
