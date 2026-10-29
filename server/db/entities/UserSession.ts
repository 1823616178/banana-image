import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import { CreatedAt } from '#server/db/columns'

@Entity('user_sessions')
@Index('idx_user_sessions_user', ['userId'])
export class UserSession {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  tokenHash!: string

  @Column({ type: 'bigint', unsigned: true })
  userId!: string

  @Index()
  @Column({ type: 'datetime', precision: 3 })
  expiresAt!: Date

  @CreatedAt()
  createdAt!: Date
}
