import { initializeDatabase } from '#server/db/data-source'
import { logCaughtError } from '#server/utils/errors'

export default defineNitroPlugin(async () => {
  try {
    await initializeDatabase()
    console.info('[banana-image] MySQL connected')
  } catch (error) {
    logCaughtError('banana-image mysql', error)
  }
})
