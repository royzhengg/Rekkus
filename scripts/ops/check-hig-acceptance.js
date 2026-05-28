#!/usr/bin/env node
const { readText } = require('./lib/files')
const { validateAcceptanceRegister } = require('./lib/hig-acceptance')

const result = validateAcceptanceRegister(readText('operations/IPHONE_HIG_ACCEPTANCE.md'), {
  backlogSource: readText('BACKLOG.md'),
  releaseCandidate: process.env.REKKUS_RELEASE_CANDIDATE,
})

if (result.failures.length > 0) {
  console.error('iPhone HIG acceptance checks failed:')
  for (const failure of result.failures) console.error(`- ${failure}`)
  process.exit(1)
}

const promotion = process.env.REKKUS_RELEASE_CANDIDATE
  ? ` for release candidate ${process.env.REKKUS_RELEASE_CANDIDATE}`
  : ''
console.log(`iPhone HIG acceptance structure passed${promotion}.`)
