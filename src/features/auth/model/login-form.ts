import { z } from 'zod'

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Informe seu e-mail.')
    .email('Informe um e-mail válido.'),
  password: z
    .string()
    .min(1, 'Informe sua senha.')
    .max(200, 'A senha deve ter no máximo 200 caracteres.'),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>

export type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>

export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  const result = loginFormSchema.safeParse(values)
  if (result.success) return {}

  const fields = result.error.flatten().fieldErrors
  return {
    email: fields.email?.[0],
    password: fields.password?.[0],
  }
}
