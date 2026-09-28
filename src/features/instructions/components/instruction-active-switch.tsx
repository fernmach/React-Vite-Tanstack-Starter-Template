import { Switch } from '@/components/ui/switch'
import { useSetInstructionActive } from '../api/set-instruction-active'
import type { Instruction } from '../model/instruction'

export function InstructionActiveSwitch({
  instruction,
  onAnnounce,
}: {
  instruction: Instruction
  onAnnounce: (message: string) => void
}) {
  const mutation = useSetInstructionActive({
    mutationConfig: {
      onSuccess: (_data, input) => {
        onAnnounce(
          `Instrução ${instruction.code} marcada como ${input.active ? 'ativa' : 'inativa'}.`,
        )
      },
      onError: () => {
        onAnnounce(
          `Não foi possível alterar a instrução ${instruction.code}. O estado anterior foi restaurado. Tente novamente.`,
        )
      },
    },
  })

  function change(next: boolean) {
    if (mutation.isPending) return
    mutation.mutate({ id: instruction.id, active: next })
  }

  return (
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
  )
}
