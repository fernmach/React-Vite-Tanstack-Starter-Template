import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { authRedirectOrDefault } from '@/lib/auth/redirect'
import { LoginForm } from '../components/login-form'

export function LoginPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/login' })

  return (
    <main className="mx-auto flex w-full max-w-[1600px] justify-center px-4 py-12 sm:px-8 sm:py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">Entrar</h1>
          </CardTitle>
          <CardDescription>
            Use sua conta para acessar as ações autorizadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            onAuthenticated={() =>
              navigate({
                href: authRedirectOrDefault(search.redirect),
                replace: true,
              })
            }
          />
        </CardContent>
      </Card>
    </main>
  )
}
