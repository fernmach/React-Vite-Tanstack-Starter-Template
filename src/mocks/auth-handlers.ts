import { HttpResponse, http } from 'msw'
import { env } from '@/config/env'
import { loginInputSchema } from '@/lib/auth/model'
import {
  currentMockCsrfToken,
  hasValidMockCsrf,
  loginMockAccount,
  logoutMockSession,
  readMockSession,
  refreshMockSession,
} from './auth-store'

const authUrl = (path: string) =>
  `*${env.API_URL.replace(/\/$/, '')}/auth/${path}`

function errorResponse(status: number, message: string, code: string) {
  return HttpResponse.json({ message, code }, { status })
}

function validateCsrf(request: Request) {
  return hasValidMockCsrf(request.headers.get('X-CSRF-Token'))
}

export const authHandlers = [
  http.get(authUrl('session'), () => {
    const result = readMockSession()
    if (result.status === 'expired')
      return errorResponse(
        401,
        'The access session has expired.',
        'ACCESS_EXPIRED',
      )
    return HttpResponse.json(result.session)
  }),

  http.post(authUrl('login'), async ({ request }) => {
    if (!validateCsrf(request))
      return errorResponse(403, 'The CSRF token is invalid.', 'CSRF_INVALID')

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse(
        400,
        'The credentials are invalid.',
        'INVALID_LOGIN_INPUT',
      )
    }
    const input = loginInputSchema.safeParse(body)
    if (!input.success)
      return errorResponse(
        400,
        'The credentials are invalid.',
        'INVALID_LOGIN_INPUT',
      )

    const session = loginMockAccount(input.data)
    if (!session)
      return errorResponse(
        401,
        'The credentials are invalid.',
        'INVALID_CREDENTIALS',
      )
    return HttpResponse.json(session)
  }),

  http.post(authUrl('refresh'), ({ request }) => {
    if (!validateCsrf(request))
      return errorResponse(403, 'The CSRF token is invalid.', 'CSRF_INVALID')

    const session = refreshMockSession()
    if (!session)
      return errorResponse(401, 'The session has expired.', 'SESSION_EXPIRED')
    return HttpResponse.json(session)
  }),

  http.post(authUrl('logout'), ({ request }) => {
    if (!validateCsrf(request))
      return errorResponse(403, 'The CSRF token is invalid.', 'CSRF_INVALID')
    logoutMockSession()
    return HttpResponse.json({ success: true })
  }),
]

export const currentAuthCsrfToken = currentMockCsrfToken
