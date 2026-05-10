# Feed & Discovery — Design Reference

How the home feed and discovery page work in Rekkus. Update this file when feed logic, ranking, or curation strategy changes.

---

## Current state

Both tabs render from `PostsContext` — a flat array of posts (mock + Supabase). The split is:

- **Following**: shows all posts, masonry 2-column grid, ordered as received (no ranking)
- **Discover**: visual tab exists, renders the same posts — not yet differentiated

No personalisation, no social graph, no ranking. This is the baseline to build on.

---

## Following tab

### Intent

Show posts from people the user follows, ordered to surface the best content first — not purely reverse-chronological.

### Ranking signals (target state)

| Signal               | Relative weight | Notes                                                         |
| -------------------- | --------------- | ------------------------------------------------------------- |
| Recency              | Primary         | Time-decayed; see model below                                 |
| Saves                | 2.5x likes      | Strong intent — user plans to revisit                         |
| Shares               | 3.0x likes      | Strongest endorsement                                         |
| Comments             | 1.5x likes      | Weight substantive comments over emoji reactions              |
| Likes                | 1.0x            | Baseline signal                                               |
| Food rating          | +boost          | Posts rated ≥4.5 get +1.5 visibility lift                     |
| Creator relationship | +boost          | Creators the user has previously liked/commented float higher |
| Post completeness    | +boost          | Photo + location + review body > stub posts                   |

### Time decay model

Half-life decay rather than hard cutoffs — great older content stays visible:

```
score = engagement_score / (1 + hours_since_post / 24)^0.5
```

A 4.8-rated post from 3 days ago should still rank above a 3.0-rated post from 1 hour ago. Never bury high-save-count posts regardless of age.

### Empty state

If the user follows nobody (or followed accounts haven't posted):

- "Your feed is empty" message
- 3–5 suggested people to follow (sourced from Discover)
- CTA to explore the Discover tab

### Not yet built

- Real social graph (`follows` table in Supabase)
- Recency-ranked Supabase query filtered to followed users
- Creator interaction weighting

---

## Discover tab

### Intent

Surface interesting content from across the platform — not limited to who the user follows. Emphasises variety, trending dishes, and local relevance.

### Three-pool curation strategy

| Pool              | Target share | Description                                                                           |
| ----------------- | ------------ | ------------------------------------------------------------------------------------- |
| Trending locally  | ~35%         | Most-saved/liked posts in user's city this week                                       |
| Nearby            | ~30%         | Posts tagged within ~10 km of user's GPS                                              |
| New & quality     | ~25%         | Food rating ≥ 4.0, posted within 14 days, < 50 likes (gives new reviewers visibility) |
| Trending globally | ~10%         | Top posts platform-wide regardless of location                                        |

Pools are mixed together — not shown as separate sections. Deduplication: posts already shown in the Following tab are excluded.

### Cuisine diversity rule

Don't show the same cuisine type more than twice in a row. On the 3rd consecutive same-cuisine post, inject a post from a different cuisine before continuing. Same rule applies to the same restaurant — max 1 appearance per session.

### Not yet built

- Trending query (top liked/saved in last 7 days from Supabase)
- Location-based post filtering
- Pool mixing and interleaving logic
- Cuisine diversity rule

---

## Cold start (new users)

What to show before the user has followed anyone or generated any engagement history:

1. **Interest onboarding** (prompt on first launch): "What cuisines do you love?" — force-select 3+. Use this to seed initial Discover feed.
2. **Default content**: Top 20 highest-rated posts in user's city (or nearest city if GPS available)
3. **Suggested people**: Surface 5 prolific reviewers to follow
4. **Messaging**: "The more you save and review, the better your feed gets"
5. After 5 interactions: begin mixing in content-based similarity (restaurants similar to ones they've engaged with)

---

## Engagement signal weights

Reference for all ranking logic across Following and Discover tabs:

| Action                    | Weight (relative to like) | Why                                                  |
| ------------------------- | ------------------------- | ---------------------------------------------------- |
| Follow (from a post)      | 8.0x                      | Longest-term signal — high intent                    |
| Save location (from post) | 5.0x                      | Direct visit intent — strongest food-specific signal |
| Share                     | 3.0x                      | External endorsement                                 |
| Save post                 | 2.5x                      | Plan to revisit                                      |
| Comment (substantive)     | 1.5x                      | Engagement quality                                   |
| Like                      | 1.0x                      | Baseline                                             |
| Profile tap               | 0.5x                      | Mild interest                                        |

**Engagement velocity matters**: engagement in the first 1–3 hours after posting is weighted more heavily than the same engagement 48 hours later (mirrors Xiaohongshu's traffic pool escalation).

---

## Industry reference

| App               | Following feed                                            | Discovery feed                                                        | Key differentiator                                                           |
| ----------------- | --------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Instagram**     | Interest graph + recency decay; saves/shares > likes      | ML model: engagement rate, interest, freshness                        | Shifted from social graph to interest graph                                  |
| **TikTok**        | Completion rate #1 signal; shares > comments > likes      | Cold-start seed audience → escalating pools                           | Aggressive A/B testing per user                                              |
| **Xiaohongshu**   | CES score: follow(8x) > share/comment(4x) > save/like(1x) | Traffic pools: cold start → escalation by engagement rate; nearby tab | Quality (40%) > interaction (30%) > account authority (20%) > trending (10%) |
| **Yelp**          | N/A (review app, not social feed)                         | Neighbourhood-trending, editor picks, cuisine-of-moment               | Collaborative filtering on taste profiles                                    |
| **Zomato**        | Follows-based recency + interaction history               | Regional popularity, trending dishes, curated collections             | Search drives ~65% of discovery                                              |
| **Rekkus target** | Follows + recency decay + saves/shares/food rating        | Trending locally + nearby + new quality                               | Saves as primary food-intent signal                                          |

### Key insight: Xiaohongshu (most relevant reference)

Xiaohongshu is the closest analogue to Rekkus — lifestyle/food discovery with user reviews, waterfall grid layout, location-tagged posts, and a mix of social + algorithmic feed. Key learnings:

- **Traffic pool escalation**: New posts start with a small test audience (~200 views). If engagement rate clears a threshold, the post advances to a larger pool. This is why early engagement velocity matters so much. We can replicate this at small scale by tracking per-post engagement rate and surfacing high-performing new posts faster.
- **CES score**: Comments (4x) and shares (4x) far outweigh likes (1x). Saves (1x in XHS) should weight higher for a food app given visit intent.
- **Quality dominates**: 40% of score is content quality — comprehensive, authentic, well-written reviews with good photos beat low-effort posts regardless of recency.
- **Saves are the strongest food-specific signal**: Users save restaurant reviews they plan to act on. A save = "I want to go here."
- **Nearby tab**: A dedicated location-based feed tab. Worth building for Rekkus (maps to our Places tab but in feed form).
- **Search drives discovery**: 65% of XHS content discovery now happens via search, not the feed. This is why SEARCH.md improvements directly impact feed-like discovery.

### Key insight: TikTok

Completion rate (did the user read the full review / view all photos?) is the strongest engagement signal. For Rekkus, proxy signals:

- Time spent on post detail screen
- Tapping the location pill
- Saving the location (strongest proxy — visit intent)
  These aren't tracked yet but worth building toward.

### Key insight: Instagram

Recency alone creates FOMO. A ranked feed (best content first, within a time window) keeps quality high and removes pressure to check constantly.

---

## Freshness vs quality

| Scenario                       | Rule                                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| New restaurant (< 2 weeks old) | 2x freshness boost for first 14 days                                  |
| Established restaurant         | Quality only — no freshness boost                                     |
| High-save post (> 50 saves)    | Never demote regardless of age                                        |
| Engagement velocity            | Engagement in first 3 hours weighted 1.5x same engagement at 48 hours |
| Trending moment                | Query-specific freshness (new opening, viral dish) overrides quality  |

---

## Tuning log

| Date       | Change                                                                                                                                                                | Reason                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Launch     | Following and Discover tabs — visual only, same data                                                                                                                  | Placeholder until social graph is built                |
| 2026-05-08 | Discover tab: 4-pool weighted scoring (trendingLocal 35%, nearby 30%, quality 25%, global 10%) + cuisine diversity rule                                               | Data-backed Discover replacing visual-only placeholder |
| 2026-05-08 | Following tab: engagement-ranked (likes + food≥4.5 boost); ready for social graph filter                                                                              | Baseline ranking before social graph                   |
| 2026-05-08 | Search history personalisation: user's recent search_query events mapped to cuisine affinities via CUISINE_SYNONYMS, applied as +1.5 boost weight in Discover scoring | Learn and adapt to user taste patterns                 |

---

## Improvement backlog

### High impact

- [ ] **Social graph**: `follows` table (`follower_id`, `following_id`) — backend for Follow/Unfollow; feeds the Following tab
- [ ] **Recency-ranked Following feed**: Supabase query for posts from followed users, ordered `created_at DESC`, ranked by engagement score
- [ ] **Save location as feed signal**: Surface posts where the current user has saved the restaurant — strongest intent proxy
- [ ] **Trending Discover feed**: Top saved/liked posts in last 7 days, filtered to user's city (scoring scaffolded; needs post_save/post_like events)
- [ ] **Nearby posts pool**: Posts tagged within 10 km of user GPS in Discover (city-level proxy in place; needs useUserLocation GPS)

### Medium impact

- [ ] **Interest onboarding**: Cuisine preference selection on first launch for cold-start personalisation
- [ ] **Time decay scoring**: Half-life model on Following feed
- [ ] **Engagement velocity boost**: Weight early engagement (first 3 hours) 1.5x
- [x] **Cuisine diversity rule**: No more than 2 consecutive posts of same cuisine_type
- [x] **New & quality pool**: Recent posts (< 14 days) with food rating ≥ 4.0 and < 50 likes — gives new reviewers visibility (food≥4.0 quality score; age filter needs created_at on Post)
- [ ] **Empty Following state**: Suggested people + CTA when feed is empty

### Low impact / future

- [ ] Traffic pool escalation: track per-post engagement rate; fast-escalate high performers to wider audience
- [ ] Engagement signals tracking: time-on-post, location-pill tap, save-location as ranking inputs
- [ ] Infinite scroll / pagination (currently loads all posts at once)
- [ ] Pull-to-refresh with new post indicator ("12 new posts")
- [ ] Creator authority score: prolific reviewers with high avg food ratings get slight distribution lift
- [x] Cuisine interest graph: user's search history by cuisine type influences Discover weighting (via useSearchHistory + analytics_events)
- [ ] "Nearby" discovery tab (separate from Places) — Xiaohongshu-style location feed
