const AUTH_RETURN_ROUTES = new Set(['sync-v2-pilot'])

export function authReturnRouteName(value) {
  return typeof value === 'string' && AUTH_RETURN_ROUTES.has(value)
    ? value
    : 'dashboard'
}
