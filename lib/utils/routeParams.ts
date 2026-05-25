export type RawRouteParam = string | string[] | undefined

export function routeParamString(value: RawRouteParam): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.find(item => typeof item === 'string')
  return undefined
}

export function routeParamNumber(value: RawRouteParam): number | null {
  const parsed = Number(routeParamString(value))
  return Number.isFinite(parsed) ? parsed : null
}

export function routeParamsObject<T extends Record<string, RawRouteParam>>(
  params: T,
  keys: Array<keyof T>
): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const key of keys) {
    const value = routeParamString(params[key])
    if (value !== undefined) normalized[String(key)] = value
  }
  return normalized
}
