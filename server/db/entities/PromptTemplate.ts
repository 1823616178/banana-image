import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt, UpdatedAt } from '#server/db/columns'

@Entity('prompt_templates')
@Index('idx_prompt_templates_user', ['userId'])
export class PromptTemplate {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  /** null 表示所有账号共享的常用提示词，由管理员维护 */
  @Column({ type: 'bigint', unsigned: true, nullable: true })
  userId!: string | null

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
