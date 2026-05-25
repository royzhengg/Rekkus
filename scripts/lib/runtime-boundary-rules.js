function runtimeBoundaryFailures(file, source) {
  const failures = []
  if (/readOfflineCache\s*<[^>]+>\s*\(\s*[^,\n)]+\s*\)/m.test(source)) {
    failures.push(`${file} reads persisted cache data without a value guard.`)
  }
  if (/payload\.(?:new|old)\s+as\s+[A-Z]\w*/m.test(source)) {
    failures.push(`${file} asserts a realtime payload instead of validating it.`)
  }
  if (/(?:await\s+)?req\.json\(\)[\s\S]{0,30}\bas\s+[A-Z]\w*/m.test(source)) {
    failures.push(`${file} asserts request JSON instead of parsing it as unknown.`)
  }
  if (/google(?:Result|Results)Envelope\s*<[^>]+>\s*\(\s*[^,)\n]+\s*\)/m.test(source)) {
    failures.push(`${file} accepts provider result items without an item guard.`)
  }
  return failures
}

module.exports = { runtimeBoundaryFailures }
