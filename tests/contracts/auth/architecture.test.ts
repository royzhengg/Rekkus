import * as fs from 'node:fs'
import * as path from 'node:path'

const PROVIDER_STATE_PATH = path.resolve(__dirname, '../../../lib/services/auth/providerState.ts')

describe('providerState.ts architecture boundary', () => {
  let source: string

  beforeAll(() => {
    source = fs.readFileSync(PROVIDER_STATE_PATH, 'utf8')
  })

  it('does not import react', () => {
    expect(source).not.toMatch(/from ['"]react['"]/)
    expect(source).not.toMatch(/require\(['"]react['"]\)/)
  })

  it('does not import react-native', () => {
    expect(source).not.toMatch(/from ['"]react-native['"]/)
    expect(source).not.toMatch(/require\(['"]react-native['"]\)/)
  })

  it('does not import supabase client', () => {
    expect(source).not.toMatch(/from ['"]@\/lib\/supabase['"]/)
    expect(source).not.toMatch(/supabase\.auth/)
  })

  it('does not import from contexts', () => {
    expect(source).not.toMatch(/from ['"]@\/lib\/contexts/)
  })

  it('does not import from hooks', () => {
    expect(source).not.toMatch(/from ['"]@\/lib\/hooks/)
  })
})
