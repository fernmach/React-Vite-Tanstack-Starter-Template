import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api-error'
import { useAuth } from '@/lib/auth/context'
import {
  validateLoginForm,
  type LoginFormErrors,
  type LoginFormValues,
} from '../model/login-form'

const EMPTY_VALUES: LoginFormValues = { email: '', password: '' }

function safeLoginError(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === 'INVALID_CREDENTIALS'
  ) {
    return 'E-mail ou senha inválidos.'
  }
  return 'Não foi possível entrar. Tente novamente.'
}

type LoginFormProps = {
  onAuthenticated(): void | Promise<void>
}

export function LoginForm({ onAuthenticated }: LoginFormProps) {
  const { login } = useAuth()
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState<LoginFormErrors>({})
  const [submitError, setSubmitError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateLoginForm(values)
    setErrors(nextErrors)
    setSubmitError(undefined)
    if (Object.values(nextErrors).some(Boolean)) return

    setIsSubmitting(true)
    try {
      await login({ email: values.email.trim(), password: values.password })
      await onAuthenticated()
    } catch (error) {
      setSubmitError(safeLoginError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <div className="flex flex-col gap-5">
        <div
          className="flex flex-col gap-2"
          data-invalid={errors.email ? true : undefined}
        >
          <label htmlFor="login-email" className="text-sm font-medium">
            E-mail
          </label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            disabled={isSubmitting}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                email: event.target.value,
              }))
              if (errors.email)
                setErrors((current) => ({ ...current, email: undefined }))
            }}
          />
          {errors.email ? (
            <p
              id="login-email-error"
              role="alert"
              className="text-destructive text-sm"
            >
              {errors.email}
            </p>
          ) : null}
        </div>

        <div
          className="flex flex-col gap-2"
          data-invalid={errors.password ? true : undefined}
        >
          <label htmlFor="login-password" className="text-sm font-medium">
            Senha
          </label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            disabled={isSubmitting}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? 'login-password-error' : undefined
            }
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                password: event.target.value,
              }))
              if (errors.password)
                setErrors((current) => ({ ...current, password: undefined }))
            }}
          />
          {errors.password ? (
            <p
              id="login-password-error"
              role="alert"
              className="text-destructive text-sm"
            >
              {errors.password}
            </p>
          ) : null}
        </div>

        {submitError ? (
          <p
            role="alert"
            aria-live="assertive"
            className="text-destructive text-sm"
          >
            {submitError}
          </p>
        ) : null}

        <p role="status" aria-live="polite" className="sr-only">
          {isSubmitting ? 'Entrando…' : ''}
        </p>
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </div>
    </form>
  )
}
