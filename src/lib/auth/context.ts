import { createContext, useContext } from 'react'
import type { ApiError } from '@/lib/api-error'
import type {
  AuthStatus,
  AuthUser,
  LoginInput,
  Permission,
  Role,
} from './model'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  error: ApiError | null
  login(input: LoginInput): Promise<AuthUser>
  logout(): Promise<void>
  retrySession(): Promise<void>
  hasRole(...roles: Role[]): boolean
  can(permission: Permission): boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
