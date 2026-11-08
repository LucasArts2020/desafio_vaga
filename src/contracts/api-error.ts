export interface ApiError {
  code: string
  message: string
  requestId: string
  fieldErrors?: Record<string, string>
}
