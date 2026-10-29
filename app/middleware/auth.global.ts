export default defineNuxtRouteMiddleware(async (to) => {
  const { user, loaded, refresh } = useAuth()
  if (!loaded.value) await refresh()
  if (to.path === '/login') {
    if (user.value) return navigateTo(typeof to.query.redirect === 'string' && to.query.redirect.startsWith('/') && !to.query.redirect.startsWith('//') ? to.query.redirect : '/')
    return
  }
  if (!user.value) return navigateTo({ path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } })
})
