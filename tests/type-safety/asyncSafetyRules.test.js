const assert = require('node:assert/strict')
const test = require('node:test')
const { asyncSafetyFailures } = require('../../scripts/lib/async-safety-rules')

test('async-safety scanner rejects ownership claimed only after debounce fires', () => {
  const staleWindow = `
    useEffect(() => {
      if (!query) return
      const timer = setTimeout(async () => {
        const requestId = ++requestIdRef.current
        const data = await fetchResults(query)
        if (requestId !== requestIdRef.current) return
        setResults(data)
      }, 100)
      return () => clearTimeout(timer)
    }, [query])
  `

  assert.equal(asyncSafetyFailures('lib/hooks/useAutocomplete.ts', staleWindow).length, 2)
})

test('async-safety scanner accepts effect-start ownership and cleanup invalidation', () => {
  const guarded = `
    useEffect(() => {
      const requestId = ++requestIdRef.current
      if (!query) return
      const timer = setTimeout(async () => {
        const data = await fetchResults(query)
        if (requestId !== requestIdRef.current) return
        setResults(data)
      }, 100)
      return () => {
        clearTimeout(timer)
        if (requestIdRef.current === requestId) requestIdRef.current += 1
      }
    }, [query])
  `

  assert.deepEqual(asyncSafetyFailures('lib/hooks/useAutocomplete.ts', guarded), [])
})

test('async-safety scanner covers promise-IIFE debounce and lifecycle cleanup', () => {
  const unguarded = `
    const searchRequestRef = useRef(0)
    const clearSearch = useCallback(() => setLocationSearch(''), [])
    setTimeout(() => { void (async () => { await fetchPredictions() })() }, 300)
  `
  const guarded = `
    const searchRequestRef = useRef(0)
    const nearbyRequestRef = useRef(0)
    const selectionRequestRef = useRef(0)
    useEffect(() => {
      return () => {
        searchRequestRef.current += 1
        nearbyRequestRef.current += 1
        selectionRequestRef.current += 1
      }
    }, [])
    const clearSearch = useCallback(() => {
      searchRequestRef.current += 1
      setLocationSearch('')
    }, [])
    setTimeout(() => { void (async () => { await fetchPredictions() })() }, 300)
  `

  assert.equal(asyncSafetyFailures('lib/hooks/useRestaurantSearch.ts', unguarded).length, 2)
  assert.deepEqual(asyncSafetyFailures('lib/hooks/useRestaurantSearch.ts', guarded), [])
})
