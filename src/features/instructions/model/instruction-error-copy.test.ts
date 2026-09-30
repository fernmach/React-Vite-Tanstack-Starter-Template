import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-error'
import {
  instructionQueryErrorCopy,
  instructionWriteErrorCopy,
} from './instruction-error-copy'

function http(status: number, code?: string) {
  return new ApiError({
    kind: 'http',
    status,
    code,
    codeSource: code ? 'backend' : undefined,
    message: 'PRIVATE SERVER MESSAGE',
    details: { secret: 'PRIVATE BODY' },
  })
}

describe('Instructions safe error copy', () => {
  it('maps only known status-qualified backend codes', () => {
    expect(instructionQueryErrorCopy(http(400, 'INVALID_PAGINATION'))).toBe(
      'Não foi possível carregar esta página.',
    )
    expect(
      instructionWriteErrorCopy(http(400, 'INVALID_PATCH_BODY'), 'alterar'),
    ).toBe('Não foi possível enviar esta alteração.')
    expect(
      instructionWriteErrorCopy(http(404, 'INSTRUCTION_NOT_FOUND'), 'arquivar'),
    ).toBe('Esta instrução não está mais disponível.')
    expect(
      instructionWriteErrorCopy(http(500, 'INSTRUCTION_NOT_FOUND'), 'arquivar'),
    ).not.toContain('não está mais disponível')
  })

  it('uses safe copy for missing, unknown, network, validation, and unknown failures', () => {
    const cases = [
      http(503),
      http(400, 'UNKNOWN'),
      new ApiError({ kind: 'network', message: 'PRIVATE NETWORK' }),
      new ApiError({
        kind: 'validation',
        message: 'PRIVATE SCHEMA',
        details: ['SECRET'],
      }),
      new ApiError({ kind: 'unknown', message: 'PRIVATE STACK' }),
    ]
    for (const error of cases) {
      for (const copy of [
        instructionQueryErrorCopy(error),
        instructionWriteErrorCopy(error, 'arquivar'),
      ]) {
        expect(copy).not.toMatch(/PRIVATE|SECRET/)
        expect(copy.length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps authentication copy neutral', () => {
    expect(instructionQueryErrorCopy(http(401))).toBe(
      'A lista de instruções está indisponível.',
    )
    expect(instructionWriteErrorCopy(http(401), 'alterar')).toBe(
      'A operação está indisponível.',
    )
  })
})
