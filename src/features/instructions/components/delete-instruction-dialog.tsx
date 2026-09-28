import { useState, type MouseEvent } from 'react'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useArchiveInstruction } from '../api/archive-instruction'
import type { Instruction } from '../model/instruction'

export function DeleteInstructionDialog({
  instruction,
  onAnnounce,
  compact = false,
}: {
  instruction: Instruction
  onAnnounce: (message: string) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const mutation = useArchiveInstruction()

  async function confirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (mutation.isPending) return

    try {
      await mutation.mutateAsync({ id: instruction.id })
      setOpen(false)
      onAnnounce(`Instrução ${instruction.code} arquivada com sucesso.`)
    } catch {
      onAnnounce(
        `Não foi possível arquivar a instrução ${instruction.code}. Tente novamente.`,
      )
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) setOpen(nextOpen)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant={compact ? 'outline' : 'ghost'}
          size={compact ? 'sm' : 'icon'}
          aria-label={`Excluir instrução ${instruction.code}`}
        >
          <Trash2
            data-icon={compact ? 'inline-start' : undefined}
            aria-hidden="true"
          />
          {compact && 'Excluir'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Arquivar instrução {instruction.code}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            A instrução “{instruction.description}” deixará de aparecer na
            lista. O arquivamento é reversível pelo serviço de dados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction disabled={mutation.isPending} onClick={confirm}>
            {mutation.isPending ? 'Arquivando…' : 'Arquivar instrução'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
