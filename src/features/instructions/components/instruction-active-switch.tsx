import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { isApiCancellation } from '@/lib/api-error'
import { useSetInstructionActive } from '../api/set-instruction-active'
import { useRefreshInstructionLists } from '../api/use-refresh-instruction-lists'
import { instructionWriteErrorCopy } from '../model/instruction-error-copy'
import type { Instruction } from '../model/instruction'

export function InstructionActiveSwitch({
  instruction,
  onAnnounce,
}: {
  instruction: Instruction
  onAnnounce: (message: string) => void
}) {
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

  return (
    <div>
      <div className="inline-flex items-center gap-2">
        <Switch
          checked={instruction.active}
          disabled={mutation.isPending}
          onCheckedChange={change}
          aria-label={`${instruction.active ? 'Desativar' : 'Ativar'} instrução ${instruction.code}`}
        />
        <span className="text-sm">
          {mutation.isPending
            ? 'Salvando…'
            : instruction.active
              ? 'Ativo'
              : 'Inativo'}
        </span>
      </div>
      {feedback && (
        <div className="mt-1">
          <p
            className="text-destructive text-sm"
            role={feedback.neutral ? 'status' : 'alert'}
          >
            {feedback.text}
          </p>
          {mutation.error?.status === 404 && (
            <button
              className="text-primary text-sm underline"
              onClick={() => void refreshList()}
            >
              Atualizar lista
            </button>
          )}
        </div>
      )}
    </div>
  )
}
