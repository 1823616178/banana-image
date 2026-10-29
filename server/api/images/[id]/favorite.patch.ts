import { favoriteSchema } from '#server/dto/generation'
import { setFavorite } from '#server/services/images'
import { requireUser } from '#server/utils/auth'
import { respond } from '#server/utils/response'
import { idParam, readSchema } from '#server/utils/validate'

export default defineEventHandler(event => respond(event, async () => {
  const user = requireUser(event)
  const id = idParam(getRouterParam(event, 'id'))
  const input = await readSchema(event, favoriteSchema)
  return setFavorite(id, user.id, input.favorite)
}))
