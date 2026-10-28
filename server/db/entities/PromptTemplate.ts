import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt, UpdatedAt } from '#server/db/columns'

@Entity('prompt_templates')
export class PromptTemplate {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'varchar', length: 64 })
  title!: string

  @Column({ type: 'text' })
  content!: string

  @Column({ type: 'int', unsigned: true, default: 0 })
  useCount!: number

  @CreatedAt()
  createdAt!: Date

  @UpdatedAt()
  updatedAt!: Date
}
