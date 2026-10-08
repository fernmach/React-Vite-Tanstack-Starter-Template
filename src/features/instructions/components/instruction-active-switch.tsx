import { useId, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { isApiCancellation } from '@/lib/api-error'
import { useSetInstructionActive } from '../api/set-instruction-active'
import { useRefreshInstructionLists } from '../api/use-refresh-instruction-lists'
import { instructionWriteErrorCopy } from '../model/instruction-error-copy'
import type { Instruction } from '../model/instruction'
import { useInstructionPermissions } from './use-instruction-permissions'

export function InstructionActiveSwitch({
  instruction,
  onAnnounce,
}: {
  instruction: Instruction
  onAnnounce: (message: string) => void
}) {
  const { canSetActive } = useInstructionPermissions()
  const switchId = useId()
  const [feedback, setFeedback] = useState<{
    text: string
    neutral: boolean
  } | null>(null)
  const refreshList = useRefreshInstructionLists()
  const mutation = useSetInstructionActive({
    onFollowUpError: (phase) =>
      setFeedback({
        text:
          phase === 'refresh'
            ? 'A alteração foi salva, mas a lista não pôde ser atualizada. Atualize a página para conferir os dados.'
            : 'A alteração foi salva, mas houve uma falha após o envio. Atualize a página para conferir os dados.',
        neutral: false,
      }),
    mutationConfig: {
      onSuccess: (_data, input) => {
        onAnnounce(
          `Instrução ${instruction.code} marcada como ${input.active ? 'ativa' : 'inativa'}.`,
        )
      },
      onError: (error) => {
        if (isApiCancellation(error)) return
        const text = instructionWriteErrorCopy(error, 'alterar')
        setFeedback({ text, neutral: error.status === 401 })
      },
    },
  })

  function change(next: boolean) {
    if (mutation.isPending) return
    setFeedback(null)
    mutation.mutate({ id: instruction.id, active: next })
  }

  if (!canSetActive)
    return (
      <Badge
        variant={instruction.active ? 'secondary' : 'outline'}
        aria-label={`Estado da instrução ${instruction.code}: ${instruction.active ? 'Ativo' : 'Inativo'}`}
      >
        {instruction.active ? 'Ativo' : 'Inativo'}
      </Badge>
    )

  return (
    <div>
      <Field
        orientation="horizontal"
        data-disabled={mutation.isPending}
        className="inline-flex w-auto gap-2"
      >
        <Switch
          id={switchId}
          checked={instruction.active}
          disabled={mutation.isPending}
          onCheckedChange={change}
          aria-label={`${instruction.active ? 'Desativar' : 'Ativar'} instrução ${instruction.code}`}
        />
        <FieldLabel htmlFor={switchId}>
          {mutation.isPending
            ? 'Salvando…'
            : instruction.active
              ? 'Ativo'
              : 'Inativo'}
        </FieldLabel>
      </Field>
      {feedback && (
        <Alert
          className="mt-2"
          variant={feedback.neutral ? 'default' : 'destructive'}
          role={feedback.neutral ? 'status' : 'alert'}
        >
          <AlertDescription>
            <p>{feedback.text}</p>
            {mutation.error?.status === 404 && (
              <Button
                className="mt-2"
                variant="link"
                size="sm"
                onClick={() => void refreshList()}
              >
                Atualizar lista
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
