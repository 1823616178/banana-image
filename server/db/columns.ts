import { CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm'

const dateTime = { type: 'datetime' as const, precision: 3 }
const currentTimestamp = () => 'CURRENT_TIMESTAMP(3)'

export function CreatedAt() {
  return CreateDateColumn({ ...dateTime, default: currentTimestamp })
}

export function UpdatedAt() {
  return UpdateDateColumn({ ...dateTime, default: currentTimestamp, onUpdate: 'CURRENT_TIMESTAMP(3)' })
}

export function DeletedAt() {
  return DeleteDateColumn({ ...dateTime, nullable: true })
}
