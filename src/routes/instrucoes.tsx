import { createFileRoute } from '@tanstack/react-router'
import { InstructionsListPage } from '@/features/instructions/pages/instructions-list-page'

export const Route = createFileRoute('/instrucoes')({
  component: InstructionsListPage,
})
