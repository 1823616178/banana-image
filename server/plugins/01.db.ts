import { initializeDatabase } from '#server/db/data-source'
import { errorMessage } from '#server/utils/errors'

export default defineNitroPlugin(async () => {
  try {
    await initializeDatabase()
    console.info('[banana-image] MySQL connected')
  } catch (error) {
    console.error(`[banana-image] MySQL unavailable: ${errorMessage(error)}`)
  }
})
