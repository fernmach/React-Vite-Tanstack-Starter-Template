import { http, HttpResponse } from 'msw'
import { instructionsUrl } from './instructions-handlers'

/** Simulates a transport failure for the Instructions collection endpoint. */
export function instructionsNetworkFailure() {
  return http.all(`${instructionsUrl}*`, () => HttpResponse.error())
}

/** Simulates a deterministic JSON HTTP failure for Instructions requests. */
export function instructionsHttpError(
  status: number,
  error: { message: string; code?: string },
) {
  return http.all(`${instructionsUrl}*`, () =>
    HttpResponse.json(error, { status }),
  )
}
