export type StrictAssert = {
  equal(actual: unknown, expected: unknown, message?: string): void
  deepEqual(actual: unknown, expected: unknown, message?: string): void
}
