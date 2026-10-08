import { useNavigate, useSearch } from '@tanstack/react-router'
import { authRedirectOrDefault } from '@/lib/auth/redirect'
import { LoginForm } from '../components/login-form'

export function LoginPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/login' })

  return (
    <main className="mx-auto flex w-full max-w-[1600px] justify-center px-4 py-12 sm:px-8 sm:py-16">
      <LoginForm
        onAuthenticated={() =>
          navigate({
            href: authRedirectOrDefault(search.redirect),
            replace: true,
          })
        }
      />
    </main>
  )
}
