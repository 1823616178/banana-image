import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt, UpdatedAt } from '#server/db/columns'

@Entity('style_presets')
export class StylePreset {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'varchar', length: 32, unique: true })
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
