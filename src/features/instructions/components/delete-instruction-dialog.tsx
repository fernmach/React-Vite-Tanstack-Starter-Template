import { useRef, useState, type MouseEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { isApiCancellation, normalizeApiError } from '@/lib/api-error'
import { useArchiveInstruction } from '../api/archive-instruction'
import { useRefreshInstructionLists } from '../api/use-refresh-instruction-lists'
import { instructionWriteErrorCopy } from '../model/instruction-error-copy'
import type { Instruction } from '../model/instruction'
import { useInstructionPermissions } from './use-instruction-permissions'

export function DeleteInstructionDialog({
  instruction,
  onAnnounce,
  compact = false,
}: {
  instruction: Instruction
  onAnnounce: (message: string, visible?: boolean) => void
  compact?: boolean
}) {
  const { canArchive } = useInstructionPermissions()
  const [open, setOpen] = useState(false)
  const refreshList = useRefreshInstructionLists()
  const followUpFailure = useRef<'refresh' | 'callback' | null>(null)
  const [feedback, setFeedback] = useState<{
    text: string
    neutral: boolean
  } | null>(null)
  const mutation = useArchiveInstruction({
    onFollowUpError: (phase) => {
      followUpFailure.current = phase
    },
  })

  async function confirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    setFeedback(null)
    followUpFailure.current = null

    try {
      await mutation.mutateAsync({ id: instruction.id })
      setOpen(false)
      if (followUpFailure.current)
        onAnnounce(
          followUpFailure.current === 'refresh'
            ? 'A instrução foi arquivada, mas a lista não pôde ser atualizada. Atualize a página para conferir os dados.'
            : 'A instrução foi arquivada, mas houve uma falha após o envio. Atualize a página para conferir os dados.',
          true,
        )
      else onAnnounce(`Instrução ${instruction.code} arquivada com sucesso.`)
    } catch (error) {
      if (isApiCancellation(error)) return
      const apiError = normalizeApiError(error)
      const text = instructionWriteErrorCopy(apiError, 'arquivar')
      setFeedback({ text, neutral: apiError.status === 401 })
    }
  }

  if (!canArchive) return null

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!mutation.isPending) {
          setOpen(nextOpen)
          if (nextOpen) setFeedback(null)
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant={compact ? 'outline' : 'ghost'}
          size={compact ? 'sm' : 'icon'}
          aria-label={`Excluir instrução ${instruction.code}`}
        >
          <Trash2 data-icon="inline-start" aria-hidden="true" />
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
        {feedback && (
          <Alert
            variant={feedback.neutral ? 'default' : 'destructive'}
            role={feedback.neutral ? 'status' : 'alert'}
          >
            <AlertDescription>
              <p>{feedback.text}</p>
              {mutation.error?.status === 404 && (
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => void refreshList()}
                >
                  Atualizar lista
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
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
