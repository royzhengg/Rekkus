import { useEffect, useState } from 'react'
import { fetchTopicFollows } from '@/lib/services/topics'

export function useTopicFollows(userId: string | undefined) {
  const [topics, setTopics] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setTopics([])
      return
    }
    void fetchTopicFollows(userId).then(next => {
      if (!cancelled) setTopics(next)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  return topics
}
