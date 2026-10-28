import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import type { AspectRatio, GenerationStatus, ImageSize } from '#shared/types/api'

@Entity('generations')
@Index('idx_generations_status_created', ['status', 'createdAt'])
@Index('idx_generations_model', ['model'])
export class Generation {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'text' })
  prompt!: string

  @Column({ type: 'text' })
  finalPrompt!: string

  @Column({ type: 'varchar', length: 64 })
  model!: string

  @Column({ type: 'varchar', length: 8 })
  aspectRatio!: AspectRatio

  @Column({ type: 'varchar', length: 4 })
  imageSize!: ImageSize

  @Column({ type: 'tinyint', unsigned: true })
  count!: number

  @Column({ type: 'enum', enum: ['text2img', 'edit'], default: 'text2img' })
  mode!: 'text2img' | 'edit'

  @Column({ type: 'json' })
  refImageIds!: string[]

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  stylePresetId!: string | null

  @Column({ type: 'enum', enum: ['queued', 'running', 'succeeded', 'partial', 'failed', 'blocked', 'canceled'], default: 'queued' })
  status!: GenerationStatus

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode!: string | null

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null

  @Column({ type: 'int', unsigned: true, default: 0 })
  inputTokens!: number

  @Column({ type: 'int', unsigned: true, default: 0 })
  outputTokens!: number

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  costUsd!: string

  @Column({ type: 'int', unsigned: true, default: 0 })
  durationMs!: number

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  parentImageId!: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  workerId!: string | null

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lockedAt!: Date | null

  @Column({ type: 'datetime', precision: 3, nullable: true })
  heartbeatAt!: Date | null

  @Index()
  @Column({ type: 'datetime', precision: 3, nullable: true })
  leaseExpiresAt!: Date | null

  @Column({ type: 'int', unsigned: true, default: 0 })
  attemptCount!: number

  @Column({ type: 'int', unsigned: true, default: 3 })
  maxAttempts!: number

  @Column({ type: 'int', unsigned: true, default: 0 })
  version!: number

  @Column({ type: 'datetime', precision: 3, nullable: true })
  cancelRequestedAt!: Date | null

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  createdAt!: Date

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updatedAt!: Date
}
