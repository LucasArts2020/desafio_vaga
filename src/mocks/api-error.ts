import { HttpResponse } from 'msw'
import type { ApiError } from '@/contracts/api-error'

export function apiError(status: number, code: string, message: string, fieldErrors?: ApiError['fieldErrors']) {
  return HttpResponse.json<ApiError>({ code, message, requestId: crypto.randomUUID(), fieldErrors }, { status })
}

export class MockFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: ApiError['fieldErrors'],
  ) {
    super(message)
  }
}

export async function respondToMock<Result extends Response>(operation: () => Promise<Result>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof MockFailure)) throw error
    return apiError(error.status, error.code, error.message, error.fieldErrors)
  }
}
