import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import type { ImageSource } from '#shared/types/api'

@Entity('images')
@Index('idx_images_source_favorite_created', ['source', 'isFavorite', 'createdAt'])
@Index('idx_images_generation', ['generationId'])
@Index('idx_images_favorite', ['isFavorite'])
export class Image {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  generationId!: string | null

  @Column({ type: 'enum', enum: ['generated', 'upload'] })
  source!: ImageSource

  @Column({ type: 'varchar', length: 255 })
  filePath!: string

  @Column({ type: 'varchar', length: 255 })
  thumbPath!: string

  @Column({ type: 'varchar', length: 32 })
  mimeType!: string

  @Column({ type: 'int', unsigned: true })
  width!: number

  @Column({ type: 'int', unsigned: true })
  height!: number

  @Column({ type: 'int', unsigned: true })
  bytes!: number

  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  sha256!: string

  @Column({ type: 'boolean', default: false })
  isFavorite!: boolean

  @DeleteDateColumn({ type: 'datetime', precision: 3, nullable: true })
  deletedAt!: Date | null

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  createdAt!: Date

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updatedAt!: Date
}
