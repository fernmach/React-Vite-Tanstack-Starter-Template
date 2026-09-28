import { z } from 'zod'
import { ApiError } from '@/lib/api-error'

const booleanStringSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

const publicEnvironmentSchema = z.object({
  VITE_API_URL: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => value.startsWith('/') || URL.canParse(value),
      'Must be a relative path or an absolute URL',
    )
    .default('/api'),
  VITE_ENABLE_API_MOCKING: booleanStringSchema.optional(),
  DEV: z.boolean(),
  PROD: z.boolean(),
})

type EnvironmentSource = z.input<typeof publicEnvironmentSchema>

export type PublicEnvironment = {
  API_URL: string
  ENABLE_API_MOCKING: boolean
  IS_DEVELOPMENT: boolean
}

export function parseEnvironment(source: EnvironmentSource): PublicEnvironment {
  const result = publicEnvironmentSchema.safeParse(source)

  if (!result.success) {
    throw new ApiError({
      kind: 'validation',
      message: 'The application environment is invalid.',
      details: result.error.issues,
      cause: result.error,
    })
  }

  const isDevelopment = result.data.DEV && !result.data.PROD

  return {
    API_URL: result.data.VITE_API_URL,
    ENABLE_API_MOCKING:
      isDevelopment && (result.data.VITE_ENABLE_API_MOCKING ?? true),
    IS_DEVELOPMENT: isDevelopment,
  }
}

export const env = parseEnvironment({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_ENABLE_API_MOCKING: import.meta.env.VITE_ENABLE_API_MOCKING,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
})

// Keep the compile-time Vite development flag visible to the bundler so the
// MSW dynamic import and its browser runtime are removed from production.
export const shouldEnableApiMocking =
  import.meta.env.DEV && env.ENABLE_API_MOCKING
