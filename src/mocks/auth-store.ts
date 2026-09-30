import type {
  AuthSession,
  AuthUser,
  LoginInput,
  Permission,
  Role,
} from '@/lib/auth/model'

type TestAccount = LoginInput & { user: AuthUser }

const editorPermissions: Permission[] = [
  'instructions:create',
  'instructions:update',
  'instructions:set-active',
]

const adminPermissions: Permission[] = [
  ...editorPermissions,
  'instructions:archive',
]

export const AUTH_TEST_ACCOUNTS: Record<Role, TestAccount> = {
  EDITOR: {
    email: 'editor@taskdesk.test',
    password: 'Editor-Test-Password',
    user: {
      id: 'mock-editor',
      name: 'Editora Task Desk',
      email: 'editor@taskdesk.test',
      roles: ['EDITOR'],
      permissions: editorPermissions,
    },
  },
  ADMIN: {
    email: 'admin@taskdesk.test',
    password: 'Admin-Test-Password',
    user: {
      id: 'mock-admin',
      name: 'Administrador Task Desk',
      email: 'admin@taskdesk.test',
      roles: ['ADMIN'],
      permissions: adminPermissions,
    },
  },
}

let csrfSequence = 0
let csrfToken = nextCsrfToken()
let user: AuthUser | null = null
let accessValid = false
let refreshValid = false

function nextCsrfToken() {
  csrfSequence += 1
  return `mock-csrf-${csrfSequence}`
}

function copyUser(value: AuthUser | null): AuthUser | null {
  return value
    ? {
        ...value,
        roles: [...value.roles],
        permissions: [...value.permissions],
      }
    : null
}

function rotateCsrf() {
  csrfToken = nextCsrfToken()
  return csrfToken
}

export function currentMockCsrfToken(): string {
  return csrfToken
}

export function hasValidMockCsrf(value: string | null): boolean {
  return value === csrfToken
}

export function readMockSession():
  | { status: 'ok'; session: AuthSession }
  | { status: 'expired' } {
  if (user && !accessValid) return { status: 'expired' }
  return {
    status: 'ok',
    session: { user: copyUser(user), csrfToken },
  }
}

export function loginMockAccount(input: LoginInput): AuthSession | undefined {
  const account = Object.values(AUTH_TEST_ACCOUNTS).find(
    (candidate) =>
      candidate.email === input.email && candidate.password === input.password,
  )
  if (!account) return undefined

  user = copyUser(account.user)
  accessValid = true
  refreshValid = true
  return { user: copyUser(user), csrfToken: rotateCsrf() }
}

export function refreshMockSession(): AuthSession | undefined {
  if (!user || !refreshValid) return undefined
  accessValid = true
  return { user: copyUser(user), csrfToken: rotateCsrf() }
}

export function logoutMockSession(): void {
  user = null
  accessValid = false
  refreshValid = false
  rotateCsrf()
}

export function authenticateMockAs(role: Role): AuthSession {
  const account = AUTH_TEST_ACCOUNTS[role]
  user = copyUser(account.user)
  accessValid = true
  refreshValid = true
  return { user: copyUser(user), csrfToken: rotateCsrf() }
}

export function expireMockAccess(): void {
  if (user) accessValid = false
}

export function revokeMockRefresh(): void {
  refreshValid = false
}

export function authorizeMockPermission(
  permission: Permission,
): { allowed: true } | { allowed: false; status: 401 | 403; code: string } {
  if (!user || !accessValid)
    return { allowed: false, status: 401, code: 'AUTHENTICATION_REQUIRED' }
  if (!user.permissions.includes(permission))
    return { allowed: false, status: 403, code: 'FORBIDDEN' }
  return { allowed: true }
}

export function resetAuthStore(): void {
  csrfSequence = 0
  csrfToken = nextCsrfToken()
  user = null
  accessValid = false
  refreshValid = false
}
