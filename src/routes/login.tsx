import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/pages/login-page'
import { getAuthSessionQueryOptions } from '@/lib/auth/api'
import { authRedirectOrDefault, safeAuthRedirect } from '@/lib/auth/redirect'

type LoginSearch = {
  redirect?: string
}

export const Route = createFileRoute('/login')({
  validateSearch: (search): LoginSearch => ({
    redirect: safeAuthRedirect(search.redirect),
  }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.ensureQueryData(
      getAuthSessionQueryOptions(),
    )
    if (session.user) {
      throw redirect({ href: authRedirectOrDefault(search.redirect) })
    }
  },
  component: LoginPage,
})
