import { useAuth } from '@/lib/auth/context'

export function useInstructionPermissions() {
  const { can } = useAuth()

  return {
    canCreate: can('instructions:create'),
    canUpdate: can('instructions:update'),
    canSetActive: can('instructions:set-active'),
    canArchive: can('instructions:archive'),
  }
}
