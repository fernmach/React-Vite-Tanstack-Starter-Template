import type { Instruction } from '@/features/instructions/model/instruction'

const descriptions = [
  'Montagem do conjunto principal',
  'Inspeção final de acabamento',
  'Configuração do módulo elétrico',
  'Aplicação de identificação técnica',
]

export const instructionMockRecords: Instruction[] = Array.from(
  { length: 48 },
  (_, index) => {
    const code = String(186681 + index)
    return {
      id: `instruction-${code}`,
      code,
      description: descriptions[index % descriptions.length],
      url: `https://example.com/instrucoes/${code}`,
      active: index % 4 !== 3,
      archived: false,
    }
  },
)
