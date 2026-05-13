export function normalizeUgPhone(input: string) {
  const cleaned = input.replace(/\s+/g, '')
  if (/^\+2567\d{8}$/.test(cleaned)) return cleaned
  if (/^2567\d{8}$/.test(cleaned)) return `+${cleaned}`
  if (/^07\d{8}$/.test(cleaned)) return `+256${cleaned.slice(1)}`
  throw new Error('Use +2567XXXXXXXX or 07XXXXXXXX')
}

export function validateStrongPassword(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include a number.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character.'
  return ''
}

