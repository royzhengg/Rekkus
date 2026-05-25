function unsafeAnyFailures(file, source) {
  const failures = []
  const lines = source.split('\n')

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const lineNumber = i + 1
    const trimmed = line.trim()

    if (/@ts-ignore/.test(line)) {
      failures.push(`FAIL [TS_IGNORE] ${file}:${lineNumber}: do not suppress TypeScript; fix the type boundary.`)
      continue
    }
    if (/@ts-nocheck/.test(line)) {
      failures.push(`FAIL [TS_NOCHECK] ${file}:${lineNumber}: file-level TypeScript disabling is prohibited.`)
      continue
    }
    if (/@ts-expect-error/.test(line) && !/@ts-expect-error\s+--\s+\S/.test(line)) {
      failures.push(`FAIL [TS_EXPECT_ERROR] ${file}:${lineNumber}: @ts-expect-error requires "-- <reason>".`)
      continue
    }
    if (/eslint-disable/.test(line)) {
      failures.push(`FAIL [ESLINT_DISABLE] ${file}:${lineNumber}: do not bypass repository safety rules.`)
      continue
    }
    if (trimmed.startsWith('//')) continue

    if ((/\bas any\b|:\s*any\b|<any>|Array<any>|Record<string,\s*any>|any\[\]/).test(line)) {
      failures.push(`FAIL [UNSAFE_ANY] ${file}:${lineNumber}: avoid any; use unknown, narrowing, or typed wrappers.`)
    }
    if (/JSON\.parse\(.*\)\s+as\s+(?!unknown\b)/.test(line)) {
      failures.push(`FAIL [UNSAFE_JSON_PARSE] ${file}:${lineNumber}: parse JSON as unknown and validate with a guard.`)
    }
    if (/supabase\s+as\s+/.test(line) && !/supabase\s+as\s+unknown\s+as\s+/.test(line)) {
      failures.push(`FAIL [UNSAFE_SUPABASE_CAST] ${file}:${lineNumber}: use generated Database types or a typed wrapper.`)
    }
    if (/\bas unknown as\s+\w/.test(line)) {
      failures.push(`FAIL [UNSAFE_DOUBLE_CAST] ${file}:${lineNumber}: \`as unknown as\` bypasses type narrowing as effectively as \`as any\`; use a type guard, unknown narrowing, or typed wrapper.`)
    }
  }

  return failures
}

module.exports = { unsafeAnyFailures }
