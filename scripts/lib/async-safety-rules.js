function asyncSafetyFailures(file, source) {
  const failures = []
  const hasDebouncedAsync =
    /setTimeout\s*\(\s*async/.test(source) ||
    /setTimeout\s*\(\s*\(\)\s*=>\s*\{[\s\S]{0,180}?void\s*\(\s*async/.test(source)

  if (hasDebouncedAsync && !/(?:requestIdRef|[A-Za-z]+RequestRef|AbortController)/.test(source)) {
    failures.push(`${file} has a debounced async effect but no cancellation generation or AbortController.`)
  }

  if (/lib\/hooks\/use(?:Search|Autocomplete)\.ts$/.test(file)) {
    if (!/useEffect\s*\(\s*\(\)\s*=>\s*\{\s*const requestId = \+\+requestIdRef\.current/.test(source)) {
      failures.push(`${file} must invalidate prior requests at effect start, before any early return or debounce.`)
    }
    if (
      !/return \(\) => \{[\s\S]{0,100}?clearTimeout\(timer\)[\s\S]{0,120}?requestIdRef\.current === requestId[\s\S]{0,80}?requestIdRef\.current \+= 1/.test(source)
    ) {
      failures.push(`${file} must invalidate its active request during timer cleanup or unmount.`)
    }
  }

  if (/lib\/hooks\/useRestaurantSearch\.ts$/.test(file)) {
    if (
      !/return \(\) => \{[\s\S]{0,180}?searchRequestRef\.current \+= 1[\s\S]{0,120}?nearbyRequestRef\.current \+= 1[\s\S]{0,120}?selectionRequestRef\.current \+= 1/.test(source)
    ) {
      failures.push(`${file} must invalidate search, nearby, and selection requests during unmount cleanup.`)
    }
    if (!/clearSearch[\s\S]{0,220}?searchRequestRef\.current \+= 1/.test(source)) {
      failures.push(`${file} must invalidate pending prediction work when search is cleared.`)
    }
  }

  return failures
}

module.exports = { asyncSafetyFailures }
