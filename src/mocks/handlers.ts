import { authHandlers } from './auth-handlers'
import { instructionsHandlers } from './instructions-handlers'

export const handlers = [...authHandlers, ...instructionsHandlers]
