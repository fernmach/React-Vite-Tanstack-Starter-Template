import { z } from 'zod'

export const roleSchema = z.enum(['EDITOR', 'ADMIN'])

export const permissionSchema = z.enum([
  'instructions:create',
  'instructions:update',
  'instructions:set-active',
  'instructions:archive',
])

export const authUserSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    roles: z.array(roleSchema).min(1),
    permissions: z.array(permissionSchema),
  })
  .strict()

export const loginInputSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(200),
  })
  .strict()

export const authSessionSchema = z
  .object({
    user: authUserSchema.nullable(),
    csrfToken: z.string().min(1),
  })
  .strict()

export const logoutResponseSchema = z
  .object({ success: z.literal(true) })
  .strict()

export type Role = z.infer<typeof roleSchema>
export type Permission = z.infer<typeof permissionSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type LogoutResponse = z.infer<typeof logoutResponseSchema>

export type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated'
  | 'recovering'
  | 'error'
