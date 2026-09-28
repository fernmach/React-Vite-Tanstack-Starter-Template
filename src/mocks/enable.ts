import { env } from '@/config/env'

function isUnexpectedApiRequest(request: Request): boolean {
  const requestUrl = new URL(request.url)
  const apiUrl = new URL(env.API_URL, window.location.origin)

  return (
    requestUrl.origin === apiUrl.origin &&
    (requestUrl.pathname === apiUrl.pathname ||
      requestUrl.pathname.startsWith(`${apiUrl.pathname.replace(/\/$/, '')}/`))
  )
}

export async function enableMocking(): Promise<void> {
  const { worker } = await import('./browser')

  await worker.start({
    onUnhandledRequest(request, print) {
      if (isUnexpectedApiRequest(request)) print.warning()
    },
  })
}
