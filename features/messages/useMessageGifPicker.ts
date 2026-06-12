import { useState } from 'react'
import { fetchGifs, type GifResult } from '@/lib/services/gifs'

export function useMessageGifPicker() {
  const [visible, setVisible] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadGifs(q: string) {
    setLoading(true)
    setError(null)
    const { gifs, error: fetchError } = await fetchGifs(q)
    setResults(gifs)
    setError(fetchError)
    setLoading(false)
  }

  async function open() {
    setVisible(true)
    setQuery('')
    await loadGifs('')
  }

  async function search(q: string) {
    setQuery(q)
    await loadGifs(q)
  }

  return { visible, setVisible, query, results, loading, error, open, search }
}
