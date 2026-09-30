import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { RouteErrorFallback } from '@/components/errors/route-error-fallback'

export function RouteError(props: ErrorComponentProps) {
  const router = useRouter()
  return (
    <RouteErrorFallback {...props} invalidate={() => router.invalidate()} />
  )
}
