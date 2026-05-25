export type ModerationResponse = {
  safe: boolean
  reason?: string
}

export function isModerationResponse(value: unknown): value is ModerationResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return 'safe' in value && typeof value.safe === 'boolean'
}
