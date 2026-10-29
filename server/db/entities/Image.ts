import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt, DeletedAt, UpdatedAt } from '#server/db/columns'
import type { ImageSource } from '#shared/types/api'

@Entity('images')
@Index('idx_images_source_favorite_created', ['source', 'isFavorite', 'createdAt'])
@Index('idx_images_generation', ['generationId'])
@Index('idx_images_favorite', ['isFavorite'])
@Index('idx_images_user_created', ['userId', 'createdAt'])
@Index('uq_images_user_sha256', ['userId', 'sha256'], { unique: true })
export class Image {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  userId!: string | null

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  generationId!: string | null

  @Column({ type: 'enum', enum: ['generated', 'upload'] })
  source!: ImageSource

  /** 文件所在存储：ftp（FTP_DIR 下的 key）或 local（旧版本地 storage 目录） */
  @Column({ type: 'varchar', length: 16, default: 'local' })
  storage!: 'local' | 'ftp'

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

  @Column({ type: 'char', length: 64 })
  sha256!: string

  @Column({ type: 'boolean', default: false })
  isFavorite!: boolean

  @DeletedAt()
  deletedAt!: Date | null

  @CreatedAt()
  createdAt!: Date

  @UpdatedAt()
  updatedAt!: Date
}
