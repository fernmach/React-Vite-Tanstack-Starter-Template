import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteInstructionDialog } from './delete-instruction-dialog'
import { InstructionActiveSwitch } from './instruction-active-switch'
import type { Instruction } from '../model/instruction'
export function InstructionCard({
  instruction,
  onAnnounce = () => {},
}: {
  instruction: Instruction
  onAnnounce?: (message: string) => void
}) {
  return (
    <article className="border-border bg-card mb-3 rounded-sm border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">MPV {instruction.code}</p>
          <p className="mt-1">{instruction.description}</p>
        </div>
        <InstructionActiveSwitch
          instruction={instruction}
          onAnnounce={onAnnounce}
        />
      </div>
      <details className="mt-3">
        <summary className="text-primary cursor-pointer text-sm font-medium">
          Ver URL
        </summary>
        <a
          className="text-primary mt-2 block text-sm break-all underline"
          href={instruction.url}
        >
          {instruction.url}
        </a>
      </details>
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<a href={`/instrucoes/${instruction.id}/editar`} />}
        >
          <Pencil data-icon="inline-start" aria-hidden="true" />
          Editar <span className="sr-only">instrução {instruction.code}</span>
        </Button>
        <DeleteInstructionDialog
          instruction={instruction}
          onAnnounce={onAnnounce}
          compact
        />
      </div>
    </article>
  )
}
