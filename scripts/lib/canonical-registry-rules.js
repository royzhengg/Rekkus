const ACTIVE_STATES = new Set(['Stable', 'Provisional'])

function hasAcceptedStatus(source) {
  return /^Status:\s*Accepted\s*$/mi.test(source) || /^## Status\s*\n+\s*Accepted\s*$/mi.test(source)
}

function canonicalRegistryFailures(source, readAdr) {
  const failures = []
  const lines = source.split('\n')
  const headerIndex = lines.findIndex(line => line.trim() === '| Pattern | Canonical | State | Decision |')

  if (headerIndex < 0) {
    return ['AGENTS.md Canonical Patterns table must include a Decision column.']
  }

  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith('|')) break

    const cells = line.split('|').slice(1, -1).map(cell => cell.trim())
    const [pattern, , state, decision] = cells
    if (!pattern || !ACTIVE_STATES.has(state)) continue

    const links = [...(decision ?? '').matchAll(/\[[^\]]+]\((docs\/adr\/[^)#]+\.md)(?:#[^)]+)?\)/g)]
    if (links.length !== 1) {
      failures.push(`Canonical pattern "${pattern}" must link exactly one ADR decision.`)
      continue
    }

    const adrPath = links[0][1]
    const adrSource = readAdr(adrPath)
    if (typeof adrSource !== 'string') {
      failures.push(`Canonical pattern "${pattern}" links to missing ADR: ${adrPath}.`)
      continue
    }
    if (!hasAcceptedStatus(adrSource)) {
      failures.push(`Canonical pattern "${pattern}" must link to an Accepted ADR: ${adrPath}.`)
    }
  }

  return failures
}

module.exports = { canonicalRegistryFailures }
