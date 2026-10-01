import { useMemo, useState } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { AuthContext, type AuthContextValue } from '@/lib/auth/context'
import { AUTH_TEST_ACCOUNTS } from '@/mocks/auth-store'
import { fireEvent, render, screen } from '@/test/render'
import { LoginForm } from './login-form'

function LoginFormHarness({
  login = vi.fn(async () => AUTH_TEST_ACCOUNTS.EDITOR.user),
  onAuthenticated = vi.fn(),
}: {
  login?: AuthContextValue['login']
  onAuthenticated?: () => void | Promise<void>
}) {
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status: user ? 'authenticated' : 'anonymous',
      error: null,
      login: async (input) => {
        const nextUser = await login(input)
        setUser(nextUser)
        return nextUser
      },
      logout: async () => setUser(null),
      retrySession: async () => undefined,
      hasRole: (...roles) =>
        user?.roles.some((role) => roles.includes(role)) ?? false,
      can: (permission) => user?.permissions.includes(permission) ?? false,
    }),
    [login, user],
  )

  return (
    <AuthContext value={value}>
      <LoginForm onAuthenticated={onAuthenticated} />
    </AuthContext>
  )
}

describe('LoginForm', () => {
  it('validates required fields and invalid email without submitting', async () => {
    const user = userEvent.setup()
    const login = vi.fn<AuthContextValue['login']>()
    render(<LoginFormHarness login={login} />)

    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe seu e-mail.')).toHaveAttribute(
      'role',
      'alert',
    )
    expect(screen.getByText('Informe sua senha.')).toHaveAttribute(
      'role',
      'alert',
    )

    await user.type(screen.getByLabelText('E-mail'), 'email-invalido')
    await user.type(screen.getByLabelText('Senha'), 'senha{Enter}')
    expect(screen.getByText('Informe um e-mail válido.')).toBeVisible()

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'editor@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'x'.repeat(201) },
    })
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(
      screen.getByText('A senha deve ter no máximo 200 caracteres.'),
    ).toBeVisible()
    expect(login).not.toHaveBeenCalled()
  })

  it('submits controlled credentials from the keyboard', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => AUTH_TEST_ACCOUNTS.EDITOR.user)
    const onAuthenticated = vi.fn()
    render(<LoginFormHarness login={login} onAuthenticated={onAuthenticated} />)

    const email = screen.getByLabelText('E-mail')
    const password = screen.getByLabelText('Senha')
    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(password).toHaveAttribute('autocomplete', 'current-password')

    await user.type(email, 'editor@example.com')
    await user.type(password, 'senha-segura{Enter}')

    expect(login).toHaveBeenCalledWith({
      email: 'editor@example.com',
      password: 'senha-segura',
    })
    expect(onAuthenticated).toHaveBeenCalledOnce()
  })

  it('announces safe invalid-credential feedback without server details', async () => {
    const user = userEvent.setup()
    const login = vi.fn(async () => {
      throw new ApiError({
        kind: 'http',
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'SECRET raw backend detail',
      })
    })
    render(<LoginFormHarness login={login} />)

    await user.type(screen.getByLabelText('E-mail'), 'editor@example.com')
    await user.type(screen.getByLabelText('Senha'), 'incorreta{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha inválidos.',
    )
    expect(document.body).not.toHaveTextContent('SECRET')
  })

  it('disables controls and announces submission progress', async () => {
    const user = userEvent.setup()
    const login = vi.fn(() => new Promise<never>(() => undefined))
    render(<LoginFormHarness login={login} />)
    await user.type(screen.getByLabelText('E-mail'), 'editor@example.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-segura')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Entrando…')
    expect(screen.getByLabelText('E-mail')).toBeDisabled()
  })
})
