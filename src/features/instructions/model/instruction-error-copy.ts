import type { ApiError } from '@/lib/api-error'

export function instructionQueryErrorCopy(error: ApiError): string {
  if (error.status === 401) return 'A lista de instruções está indisponível.'
  if (error.kind === 'network')
    return 'Não foi possível conectar ao serviço. Tente novamente.'
  if (error.kind === 'validation')
    return 'Os dados recebidos não puderam ser exibidos com segurança. Tente novamente.'
  if (
    error.kind === 'http' &&
    error.codeSource === 'backend' &&
    error.status === 400 &&
    error.code === 'INVALID_PAGINATION'
  )
    return 'Não foi possível carregar esta página.'
  return 'Não foi possível carregar as instruções. Tente novamente.'
}

export function instructionWriteErrorCopy(
  error: ApiError,
  action: 'alterar' | 'arquivar',
): string {
  if (error.status === 401) return 'A operação está indisponível.'
  if (error.status === 403)
    return 'Você não tem permissão para realizar esta operação.'
  if (
    error.kind === 'network' ||
    (error.kind === 'validation' && error.validationPhase === 'response')
  )
    return 'Não foi possível confirmar a alteração. Atualize a lista antes de tentar novamente.'
  if (
    error.kind === 'http' &&
    error.codeSource === 'backend' &&
    error.status === 404 &&
    error.code === 'INSTRUCTION_NOT_FOUND'
  )
    return 'Esta instrução não está mais disponível.'
  if (
    error.kind === 'http' &&
    error.codeSource === 'backend' &&
    error.status === 400 &&
    error.code === 'INVALID_PATCH_BODY'
  )
    return 'Não foi possível enviar esta alteração.'
  return action === 'arquivar'
    ? 'Não foi possível arquivar a instrução. Tente novamente.'
    : 'Não foi possível alterar a instrução. Tente novamente.'
}
