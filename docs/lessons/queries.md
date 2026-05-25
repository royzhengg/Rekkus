# Lessons: Supabase Queries

## Parallelise independent queries with `Promise.all`

```ts
const [likesRes, commentsRes] = await Promise.all([
  supabase.from('likes').select(...),
  supabase.from('comments').select(...),
])
```

**Why:** Sequential awaits add latency equal to the sum of all requests. Independent queries should always run in parallel.
