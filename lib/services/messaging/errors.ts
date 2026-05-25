export function mapMessagingError(error: { message?: string } | null): string | null {
  if (!error?.message) return null
  if (error.message.includes('messaging_blocked')) {
    return 'Messaging is not available between these accounts.'
  }
  if (error.message.includes('invalid_target')) {
    return 'You cannot start a message thread with this profile.'
  }
  if (error.message.includes('not_authenticated')) {
    return 'Please sign in to use messages.'
  }
  if (error.message.includes('invalid_message')) {
    return 'Messages must be between 1 and 2,000 characters.'
  }
  if (error.message.includes('not_participant')) {
    return 'You are not a participant in this conversation.'
  }
  if (error.message.includes('rate_limited')) {
    return 'You are sending messages too quickly. Please wait a moment.'
  }
  return 'Messaging is not available right now.'
}

export function isMissingRequestStateColumn(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? ''
  return (
    error?.code === '42703' ||
    message.includes('request_status') ||
    message.includes('requested_by') ||
    message.includes('requested_at')
  )
}
