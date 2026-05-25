export const PASSWORD_MIN_LENGTH = 8
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH
}

export function passwordMinLengthMessage(): string {
  return `At least ${PASSWORD_MIN_LENGTH} characters`
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password === confirm
}

export function hasCurrentPassword(password: string): boolean {
  return password.length > 0
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,30}$/.test(username)
}
