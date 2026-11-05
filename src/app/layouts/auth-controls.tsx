import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

export function AuthControls() {
  const auth = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string>()

  async function handleLogout() {
    setIsLoggingOut(true)
    setLogoutError(undefined)
    try {
      await auth.logout()
    } catch {
      setLogoutError(
        'Não foi possível encerrar a sessão no servidor. Você saiu neste dispositivo.',
      )
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (auth.status === 'loading' || auth.status === 'recovering') {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-muted-foreground text-sm"
      >
        {auth.status === 'loading'
          ? 'Verificando sessão…'
          : 'Atualizando sessão…'}
      </p>
    )
  }

  if (auth.status === 'authenticated' && auth.user) {
    return (
      <div className="flex items-center gap-3">
        <span className="max-w-40 truncate text-sm font-medium">
          {auth.user.name}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
          onClick={handleLogout}
        >
          {isLoggingOut ? 'Saindo…' : 'Sair'}
        </Button>
        <span role="status" aria-live="polite" className="sr-only">
          {isLoggingOut ? 'Encerrando sessão…' : ''}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Link
        to="/login"
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        Entrar
      </Link>
      {logoutError ? (
        <p
          role="alert"
          aria-live="assertive"
          className="text-destructive max-w-72 text-right text-xs"
        >
          {logoutError}
        </p>
      ) : null}
    </div>
  )
}
