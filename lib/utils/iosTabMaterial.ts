import type { AppEnvironment } from '@/lib/config'

export function canUseIosTabBarMaterial(
  platform: string,
  environment: AppEnvironment,
  flagEnabled: boolean
): boolean {
  return (
    flagEnabled &&
    platform === 'ios' &&
    (environment === 'development' || environment === 'staging')
  )
}
