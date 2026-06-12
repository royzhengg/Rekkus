# Operational Cadence

This doc owns the recurring review rhythm for keeping Rekkus current without adding heavy process.

## Daily

- Check current blockers in [CURRENT_STATE.md](CURRENT_STATE.md).
- Review release or migration work only when active.
- Capture new risks in [../BACKLOG.md](../BACKLOG.md) instead of loose notes.

## Weekly

- Review top backlog sequencing.
- Check stale docs, stale flags, stale experiments, and unresolved blockers.
- Review support, incidents, and metrics notes.
- Review Search Health from `lib/search/health.ts` / `get_search_quality_metrics(lookback_days)` before and after ranking changes.
- Confirm upcoming release work still has a rollback path.

### Search Health Thresholds

Use aggregate rows only. Do not export user IDs, per-session rows, precise coordinates, or raw provider payloads into operational notes.

| Metric | Watch | Incident |
| --- | ---: | ---: |
| Search success rate | <45% | <25% |
| Zero-result rate | >=15% | >=30% |
| CTR | <10% | <5% |
| Reformulation rate | >=35% | >=50% |

When a search metric enters watch, compare the last ranking/search change against its named metric and rollback path. When it enters incident, pause ranking experiments and open an incident note with the affected metric, suspected change, rollback owner, and evidence source.

## Monthly

- Review provider cost trends and quota pressure.
- Review dependency health.
- Review operational debt and technical debt.
- Revisit automation candidates in [AUTOMATION.md](AUTOMATION.md).

## Quarterly

- Review whether operational maturity should increase.
- Archive stale current-state notes.
- Confirm the master plan still maps to actionable backlog items.
