export function parseJsonUnknown(raw: string): unknown {
  return JSON.parse(raw) as unknown
}

export function parseJsonWithGuard<T>(
  raw: string,
  guard: (value: unknown) => value is T
): T | null {
  try {
    const parsed = parseJsonUnknown(raw)
    return guard(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
