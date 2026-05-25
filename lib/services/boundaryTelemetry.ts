import { analytics } from '@/lib/analytics'

export function reportInvalidBoundary(boundary: string): void {
  analytics.actionError(null, 'runtime_boundary', boundary)
}
