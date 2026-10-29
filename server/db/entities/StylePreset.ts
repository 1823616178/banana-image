import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt, UpdatedAt } from '#server/db/columns'

@Entity('style_presets')
@Index('idx_style_presets_user', ['userId'])
export class StylePreset {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  /** null 表示所有账号共享的预设，由管理员维护 */
  @Column({ type: 'bigint', unsigned: true, nullable: true })
  userId!: string | null

  @Column({ type: 'varchar', length: 32 })
  name!: string

  @Column({ type: 'text' })
  promptSuffix!: string

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  coverImageId!: string | null

  @Column({ type: 'int', default: 0 })
  sort!: number

  @Column({ type: 'boolean', default: true })
  enabled!: boolean

  @CreatedAt()
  createdAt!: Date

  @UpdatedAt()
  updatedAt!: Date
}
