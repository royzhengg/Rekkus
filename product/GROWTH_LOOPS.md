# Growth Loops

Owner: Product / growth

Growth should amplify real food utility: useful reviews, saved places, collections, and local discovery density.

## Candidate Loops

| Loop | Product Value | Notes |
| --- | --- | --- |
| Review sharing | Brings new users through useful dish/place context | Needs public web or share cards later. |
| Collaborative collections | Turns saved intent into identity and shared planning | Start with explicit collaborators and activity history; avoid open public editing. |
| Taste identity | Gives users a useful reason to share profiles | Use cuisine/dish/save patterns, not personality quizzes or AI labels first. |
| Follow graph | Helps people find trusted local reviewers | Avoid influencer-first ranking; social proof belongs in [SOCIAL_PROOF.md](SOCIAL_PROOF.md). |
| Contributor reputation | Helps new users trust useful local contributors | Reward specificity, saves driven, freshness, and moderation history. |
| Restaurant pages | Captures high-intent local demand | Keep Rekkus evidence above generic directory data. |
| App Store ratings | Converts satisfied users into launch trust | Prompt only after successful food-intent moments and respect cooldowns. |
| Share post/place via DM | Recipient opens app to view shared item → saves or posts → increases content density and graph | Each shared card is a contextual invite without an explicit invite prompt. |
| Group chats around dining plans | Coordinated visit → post/review → increases content density | Group chats created around food plans drive organic invites and new user acquisition. |

## Signals

- Share actions that lead to visits or signups.
- Saves from shared content.
- Follow conversion from useful profiles.
- Search demand by local cuisine or dish.

## Guardrails

- Do not chase growth loops before content density and saves work.
- Do not add viral mechanics that reduce trust or review quality.
- Keep growth work measurable and reversible.
- Notification-led growth must follow [NOTIFICATIONS.md](NOTIFICATIONS.md); no generic engagement pings.

## Roadmap Mapping

| Backlog | Smallest Reversible Step | Dependencies |
| --- | --- | --- |
| B-305 Collaborative collections | Private invite/collaborator metadata for existing collections. | Collection ownership, block/report rules. |
| B-306 Taste identity system | Profile taste summary from saved posts, saved places, cuisines, and dish tags. | Taste graph density and privacy copy. |
| B-307 Contributor reputation | Internal quality score for ranking diagnostics, not a public badge. | Moderation and analytics events. |
| B-309 Save graph improvements | Distinguish want-to-try, been-here, collection saves, and post saves in recommendations. | Existing save intent tables. |
| B-310 Onboarding personalization | Use topic follows and first saves as bounded boosts. | Profile setup and Discover ranking. |
| B-311 Notification relevance | Utility classes, settings, and cooldowns before new push types. | Notification settings and analytics. |
| B-313 Creator incentives | Non-vanity prompts for dish tags, best dish, and useful local reviews. | Contribution quality rules. |
| B-333/B-334 App Store growth | Metadata and review prompts tied to completed utility moments. | Release owner and store disclosure review. |
