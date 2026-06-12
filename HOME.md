# Rekkus Knowledge Base

## Authority

| Doc | Role |
|---|---|
| [[AGENTS]] | AI/operator behaviour, engineering rules, canonical patterns |
| [[PRODUCT]] | Strategic product truth |
| [[BACKLOG]] | Execution order and operational roadmap |
| [[REPO_MAP]] | File and folder map |

---

## Domains

| Area | Entry Point | Key Supporting Docs |
|---|---|---|
| Architecture | [[docs/architecture/ARCHITECTURE\|ARCHITECTURE]] | [[docs/architecture/DEPENDENCIES\|Dependencies]], [[docs/architecture/NAMING\|Naming]], [[docs/architecture/TESTING\|Testing]] |
| Product | [[product/FEATURES\|FEATURES]] | [[product/SEARCH\|Search]], [[product/FEED\|Feed]], [[product/DISCOVERY\|Discovery]] |
| Search | [[product/SEARCH\|SEARCH]] | [[docs/lessons/search\|Search Lessons]], [[lib/search/pipeline.ts\|pipeline.ts]] |
| Design | [[design/DESIGN_SPEC\|DESIGN_SPEC]] | [[design/TOKENS\|Tokens]], [[design/UX_Copywriting_Guide\|Copy Guide]], [[design/ACCESSIBILITY\|Accessibility]] |
| Analytics | [[docs/analytics/ANALYTICS\|ANALYTICS]] | [[docs/analytics/EVENTS\|Events]], [[docs/analytics/KPIS\|KPIs]], [[docs/analytics/FUNNELS\|Funnels]] |
| Operations | [[operations/RELEASE\|RELEASE]] | [[operations/INCIDENTS\|Incidents]], [[operations/FEATURE_FLAGS\|Feature Flags]], [[operations/METRICS\|Metrics]] |
| Security | [[docs/security/SECURITY\|SECURITY]] | [[docs/security/COMPLIANCE\|Compliance]], [[docs/security/DISASTER_RECOVERY\|DR]] |
| Business | [[business/GTM\|GTM]] | [[business/MONETIZATION\|Monetization]], [[business/GROWTH\|Growth]], [[business/CREATOR_STRATEGY\|Creator Strategy]] |
| Lessons | [[docs/LESSONS\|LESSONS]] | [[docs/lessons/search\|search]], [[docs/lessons/architecture\|architecture]], [[docs/lessons/hooks\|hooks]] |
| ADRs | [[docs/adr/README\|ADR Index]] | Use template: [[templates/ADR\|ADR Template]] |

---

## Open Backlog

```dataview
TASK FROM "BACKLOG"
WHERE !completed
LIMIT 25
```

---

## Recent ADRs

```dataview
LIST FROM "docs/adr"
WHERE file.name != "README" AND file.name != "0000-template"
SORT file.name DESC
LIMIT 10
```

---

## Quick Nav

- New ADR → [[templates/ADR|ADR Template]] (`Cmd+Shift+T` in a new file under `docs/adr/`)
- New Lesson → [[templates/Lesson|Lesson Template]]
- New Backlog Item → [[templates/Backlog Item|Backlog Item Template]]
- New Product Doc → [[templates/Product Doc|Product Doc Template]]
- Graph View → `Cmd+G`
- Bookmarks → `Cmd+Shift+K`
- Search → `Cmd+Shift+F`
- Backlinks → `Cmd+Shift+B`
