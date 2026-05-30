'use strict'
const {
  BACKLOG_HEADER,
  duplicateBacklogIds,
  hasExpectedBacklogSchema,
} = require('../lib/backlog')
const { exists } = require('../lib/files')

const DEFAULT_EVIDENCE_RULES = new Map([
  ['B-021', ['scripts/check-markdown-links.js', 'package.json']],
  ['B-026', ['scripts/ops/lib/backlog.js', 'scripts/ops/check-operations.js']],
  ['B-030', ['operations/RELEASE.md', 'scripts/check-platform.js']],
  ['B-032', ['app.config.js', 'scripts/check-hygiene.js']],
  ['B-033', ['scripts/ops/check-operations.js', 'docs/architecture/ARCHITECTURE.md']],
  ['B-035', ['operations/DATA_MODE.md', 'lib/config.ts', 'scripts/check-hygiene.js']],
  ['B-036', ['docs/security/SECURITY.md', 'scripts/ops/check-operations.js']],
  ['B-037', ['docs/architecture/API_GOVERNANCE.md', 'scripts/check-hygiene.js']],
  ['B-038', ['docs/architecture/CACHE_GOVERNANCE.md', 'lib/services/googlePlaces.ts']],
  ['B-039', ['operations/COSTS.md', 'operations/RELEASE.md', 'scripts/ops/check-operations.js']],
  ['B-040', ['operations/FEATURE_FLAGS.md', 'lib/featureFlags.ts', 'scripts/ops/lib/feature-flags.js']],
  ['B-041', ['docs/architecture/TESTING.md', 'package.json']],
  ['B-042', ['docs/architecture/DEPENDENCIES.md', 'package.json']],
  ['B-043', ['docs/architecture/NAMING.md', 'docs/architecture/ARCHITECTURE.md', 'scripts/ops/check-operations.js']],
  ['B-044', ['operations/EXPERIMENTS.md', 'scripts/ops/check-operations.js']],
  ['B-045', ['docs/security/MEDIA_PIPELINE.md', 'docs/security/SECURITY.md', 'scripts/ops/check-operations.js']],
  ['B-046', ['product/SEARCH.md', 'scripts/ops/check-operations.js']],
  ['B-047', ['operations/OBSERVABILITY.md', 'scripts/ops/check-operations.js']],
  ['B-048', ['docs/architecture/PERFORMANCE.md', 'docs/architecture/ENGINEERING_GOVERNANCE.md', 'scripts/ops/check-operations.js']],
  ['B-049', ['operations/OPERATIONAL_CADENCE.md']],
  ['B-050', ['operations/CURRENT_STATE.md', 'scripts/ops/check-operations.js']],
  ['B-051', ['operations/INCIDENTS.md', 'operations/METRICS.md', 'operations/LAUNCHES.md']],
  ['B-052', ['operations/FOUNDER_OS.md', 'operations/OBSERVABILITY.md', 'scripts/ops/check-operations.js']],
  ['B-053', ['operations/AUTOMATION.md', 'scripts/ops/check-operations.js', 'package.json']],
  ['B-054', ['operations/AUTOMATION.md']],
  ['B-055', ['BACKLOG.md', 'scripts/ops/lib/backlog.js', 'scripts/ops/check-operations.js']],
  ['B-057', ['operations/RISK_REVIEW.md', 'operations/README.md', 'scripts/ops/check-operations.js']],
  ['B-058', ['operations/DEBT.md', 'operations/README.md', 'scripts/ops/check-operations.js']],
  ['B-059', ['REPO_MAP.md', 'docs/architecture/ENGINEERING_GOVERNANCE.md', 'scripts/ops/check-operations.js']],
  ['B-060', ['operations/FOUNDER_OS.md', 'scripts/ops/check-operations.js']],
  ['B-061', ['operations/AUTOMATION.md', 'scripts/ops/check-operations.js']],
  ['B-062', ['operations/CURRENT_STATE.md', 'operations/README.md', 'scripts/ops/check-operations.js']],
  ['B-063', ['business/INSTRUMENTATION.md', 'docs/analytics/ANALYTICS.md', 'scripts/ops/check-operations.js']],
  ['B-064', ['docs/GOVERNANCE_INDEX.md', 'docs/README.md', 'scripts/ops/check-operations.js']],
  ['B-065', ['scripts/ops/check-operations.js']],
  ['B-066', ['operations/EXPERIMENTS.md', 'scripts/ops/check-operations.js']],
  ['B-067', ['lib/featureFlags.ts', 'scripts/ops/check-operations.js']],
  ['B-068', ['scripts/ops/lib/backlog.js', 'scripts/ops/check-operations.js']],
  ['B-069', ['scripts/ops/check-operations.js']],
  ['B-070', ['scripts/ops/check-operations.js']],
  ['B-071', ['package.json', 'scripts/ops/check-operations.js']],
  ['B-072', ['scripts/ops/check-operations.js']],
  ['B-073', ['operations/JOBS.md', 'scripts/ops/check-operations.js']],
  ['B-074', ['scripts/ops/check-dead-code.js', 'package.json', 'scripts/ops/check-operations.js']],
  ['B-075', ['operations/PR_REVIEW.md', 'scripts/ops/pr-summary.js', 'package.json']],
  ['B-076', ['REPO_MAP.md', 'scripts/ops/check-operations.js']],
  ['B-077', ['lib/featureFlags.ts', 'scripts/ops/lib/feature-flags.js']],
  ['B-079', ['product/DISCOVERY.md', 'product/README.md']],
  ['B-080', ['product/RETENTION.md', 'product/README.md']],
  ['B-081', ['product/ACTIVATION.md', 'product/README.md']],
  ['B-082', ['product/NETWORK_EFFECTS.md', 'product/README.md']],
  ['B-083', ['product/GROWTH_LOOPS.md', 'product/README.md']],
  ['B-084', ['product/CONTRIBUTION_LOOPS.md', 'product/README.md']],
  ['B-085', ['product/TRUST.md', 'product/README.md']],
  ['B-086', ['product/QUALITY.md', 'product/README.md']],
  ['B-087', ['product/TASTE_GRAPH.md', 'product/README.md']],
  ['B-130', ['docs/architecture/DATA_GOVERNANCE.md', 'scripts/ops/check-operations.js']],
  ['B-131', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'scripts/ops/check-audit.js', 'lib/services/restaurants.ts']],
  ['B-132', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'lib/services/restaurants.ts']],
  ['B-133', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'lib/services/restaurants.ts']],
  ['B-134', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'lib/services/restaurants.ts']],
  ['B-135', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'lib/services/restaurants.ts']],
  ['B-136', ['lib/analytics.ts', 'scripts/ops/lib/policy-checks.js']],
  ['B-142', ['lib/services/media.ts', 'components/post-create/StepMedia.tsx', 'scripts/check-hygiene.js']],
  ['B-143', ['lib/services/media.ts', 'docs/security/MEDIA_PIPELINE.md']],
  ['B-144', ['docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-operations.js']],
  ['B-145', ['docs/security/MEDIA_PIPELINE.md', 'lib/services/media.ts']],
  ['B-146', ['docs/security/MEDIA_PIPELINE.md', 'operations/COSTS.md']],
  ['B-147', ['docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-job-monitors.js']],
  ['B-148', ['operations/COSTS.md', 'scripts/ops/check-operations.js']],
  ['B-149', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js', 'package.json']],
  ['B-150', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js']],
  ['B-151', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js']],
  ['B-152', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js']],
  ['B-153', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js', 'lib/services/googlePlaces.ts']],
  ['B-154', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js', 'lib/hooks/useSearch.ts']],
  ['B-155', ['product/SEARCH.md', 'scripts/ops/check-search-governance.js', 'lib/utils/cuisineSynonyms.ts']],
  ['B-156', ['operations/OBSERVABILITY.md', 'components/ErrorBoundary.tsx', 'scripts/ops/check-observability.js']],
  ['B-157', ['operations/RELEASE.md', 'scripts/ops/check-observability.js', 'package.json']],
  ['B-158', ['docs/analytics/ANALYTICS.md', 'docs/analytics/EVENTS.md', 'lib/analytics.ts']],
  ['B-159', ['lib/analytics.ts', 'lib/contexts/AuthContext.tsx', 'scripts/ops/check-observability.js']],
  ['B-160', ['lib/analytics.ts', 'components/post-create/StepMedia.tsx', 'features/settings/EditProfileScreen.tsx']],
  ['B-161', ['operations/JOBS.md', 'scripts/ops/check-job-monitors.js', 'scripts/ops/check-observability.js']],
  ['B-162', ['operations/COSTS.md', 'scripts/ops/check-observability.js']],
  ['B-163', ['operations/COSTS.md', 'scripts/ops/check-observability.js']],
  ['B-164', ['operations/OBSERVABILITY.md', 'scripts/ops/check-observability.js']],
  ['B-165', ['operations/COSTS.md', 'docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-observability.js']],
  ['B-166', ['operations/LAUNCHES.md', 'scripts/ops/check-observability.js']],
  ['B-167', ['business/INSTRUMENTATION.md', 'scripts/ops/check-observability.js']],
  ['B-168', ['operations/FOUNDER_OS.md', 'scripts/ops/check-operations.js', 'scripts/ops/check-observability.js']],
  ['B-169', ['operations/FOUNDER_OS.md', 'operations/OBSERVABILITY.md', 'scripts/ops/check-observability.js']],
  ['B-170', ['.vscode/tasks.json', 'operations/FOUNDER_OS.md', 'scripts/ops/check-observability.js']],
  ['B-171', ['lib/contexts/AuthContext.tsx', 'docs/security/SECURITY.md', 'scripts/ops/check-security-foundations.js']],
  ['B-172', ['lib/services/media.ts', 'docs/security/MEDIA_PIPELINE.md', 'scripts/check-hygiene.js']],
  ['B-173', ['lib/analytics.ts', 'lib/services/moderation.ts', 'scripts/ops/check-security-foundations.js']],
  ['B-174', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'lib/services/moderation.ts', 'docs/moderation/MODERATION_OPERATIONS.md']],
  ['B-175', ['features/posts/PostDetailScreen.tsx', 'features/profile/UserProfileScreen.tsx', 'lib/services/moderation.ts']],
  ['B-176', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md', 'docs/security/COMPLIANCE.md']],
  ['B-177', ['docs/security/SECURITY.md', 'operations/INCIDENTS.md', 'docs/security/COMPLIANCE.md']],
  ['B-178', ['docs/security/SECURITY.md', 'operations/RELEASE.md', 'docs/security/COMPLIANCE.md']],
  ['B-179', ['docs/architecture/DEPENDENCIES.md', 'operations/RELEASE.md', 'scripts/ops/check-security-foundations.js']],
  ['B-180', ['docs/security/COMPLIANCE.md', 'operations/RELEASE.md', 'scripts/ops/check-security-foundations.js']],
  ['B-181', ['design/DESIGN_SPEC.md', 'design/UI_LIBRARY.md', 'operations/RELEASE.md']],
  ['B-182', ['docs/security/COMPLIANCE.md', 'docs/moderation/MODERATION_OPERATIONS.md', 'operations/RELEASE.md']],
  ['B-183', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
  ['B-184', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
  ['B-185', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
  ['B-186', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/security/COMPLIANCE.md', 'scripts/ops/check-audit.js']],
  ['B-187', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
  ['B-188', ['supabase/migrations/20240204000000_restaurant_history_and_repairs.sql', 'supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'lib/services/restaurants.ts']],
  ['B-189', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
  ['B-190', ['supabase/migrations/20240205000000_moderation_security_foundations.sql', 'docs/moderation/MODERATION_OPERATIONS.md']],
  ['B-191', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'lib/services/restaurants.ts', 'docs/architecture/ARCHITECTURE.md']],
  ['B-192', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'docs/architecture/CACHE_GOVERNANCE.md', 'scripts/ops/check-providers.js']],
  ['B-193', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'docs/adr/0002-provider-independent-restaurant-graph.md']],
  ['B-194', ['operations/JOBS.md', 'docs/security/COMPLIANCE.md', 'scripts/ops/check-job-monitors.js']],
  ['B-195', ['operations/COSTS.md', 'scripts/ops/check-providers.js', 'lib/services/googlePlaces.ts']],
  ['B-196', ['supabase/migrations/20240203000000_restaurant_compliance_graph.sql', 'docs/adr/0002-provider-independent-restaurant-graph.md']],
  ['B-197', ['docs/security/COMPLIANCE.md', 'supabase/migrations/20240203000000_restaurant_compliance_graph.sql']],
  ['B-198', ['operations/JOBS.md', 'scripts/ops/check-operations.js', 'scripts/ops/check-job-monitors.js']],
  ['B-199', ['docs/analytics/ANALYTICS.md', 'operations/OBSERVABILITY.md']],
  ['B-200', ['lib/services/googlePlaces.ts']],
  ['B-201', ['lib/services/googlePlaces.ts']],
  ['B-202', ['lib/services/googlePlaces.ts']],
  ['B-203', ['lib/services/googlePlaces.ts']],
  ['B-204', ['lib/hooks/useSearch.ts', 'product/SEARCH.md', 'scripts/ops/check-google-cost-reduction.js']],
  ['B-205', ['docs/security/MEDIA_PIPELINE.md', 'docs/security/COMPLIANCE.md', 'scripts/ops/check-google-cost-reduction.js']],
  ['B-206', ['docs/security/MEDIA_PIPELINE.md', 'lib/services/media.ts', 'scripts/ops/check-google-cost-reduction.js']],
  ['B-207', ['docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-google-cost-reduction.js']],
  ['B-208', ['docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-google-cost-reduction.js']],
  ['B-209', ['docs/security/MEDIA_PIPELINE.md', 'docs/architecture/CACHE_GOVERNANCE.md', 'scripts/ops/check-google-cost-reduction.js']],
  ['B-210', ['operations/COSTS.md', 'docs/security/MEDIA_PIPELINE.md', 'scripts/ops/check-google-cost-reduction.js']],
  ['B-221', ['features/profile/ProfileScreen.tsx', 'lib/hooks/useSavedPosts.ts', 'lib/hooks/useLikedPosts.ts']],
  ['B-222', ['lib/services/users.ts', 'supabase/migrations/20240101000000_initial_schema.sql']],
  ['B-223', ['lib/hooks/usePagedList.ts', 'lib/services/posts.ts']],
  ['B-224', ['lib/services/notifications.ts', 'supabase/functions/send-push/index.ts']],
  ['B-225', ['features/auth/ForgotPasswordScreen.tsx', 'features/auth/ResetPasswordScreen.tsx']],
  ['B-226', ['features/settings/ConnectedAccountsScreen.tsx', 'lib/contexts/AuthContext.tsx']],
  ['B-227', ['app.config.js', 'lib/routes.ts']],
  ['B-228', ['lib/services/comments.ts', 'supabase/migrations/20240201000000_comment_threads.sql']],
  ['B-229', ['app.config.js', 'scripts/check-platform.js']],
  ['B-231', ['components/DishTagOverlay.tsx', 'supabase/migrations/20240117000000_dish_tags.sql']],
  ['B-232', ['components/post-create/DraggablePhotoStrip.tsx']],
  ['B-233', ['components/post-create/StepMedia.tsx']],
  ['B-234', ['lib/hooks/usePostVisitPrompt.ts']],
  ['B-235', ['features/search/SearchScreen.tsx', 'lib/hooks/useTrendingData.ts']],
  ['B-236', ['lib/hooks/useSearch.ts', 'supabase/migrations/20240202000000_search_query_expansion.sql']],
  ['B-237', ['lib/services/users.ts', 'supabase/migrations/20240101000000_initial_schema.sql']],
  ['B-238', ['features/posts/PostDetailScreen.tsx', 'supabase/migrations/20240125000000_post_reactions.sql']],
])

function isDocsPolicyOrRestructureItem(row) {
  return /\.md|docs?|documentation|restructure|governance|policy|strategy|plan|template|index|readme|adr|cadence|current-state|observability|foundation|maturity|requirements|review|taxonomy|debt|audit|extract|split|refactor/i.test(
    `${row.item} ${row.why}`,
  )
}

function checkBacklog(rows, result) {
  if (!hasExpectedBacklogSchema()) {
    result.failures.push(`BACKLOG.md must use the expanded schema: ${BACKLOG_HEADER}`)
  }

  const allowedImplementationTypes = new Set([
    'runtime-feature',
    'migration',
    'guardrail',
    'automation',
    'ops-workflow',
    'docs',
    'restructure',
    'audit',
    'policy',
    'none',
  ])

  for (const id of duplicateBacklogIds(rows)) {
    result.failures.push(`BACKLOG.md contains duplicate ID ${id}.`)
  }

  let prevIdNum = 0
  rows.forEach((row) => {
    const match = /^B-(\d+)$/.exec(row.id)
    if (!match) {
      result.failures.push(`${row.id} has an invalid ID format; expected B-NNN.`)
      return
    }
    const idNum = parseInt(match[1], 10)
    if (idNum <= prevIdNum) {
      result.failures.push(`${row.id} is out of order (previous was B-${String(prevIdNum).padStart(3, '0')}).`)
    }
    prevIdNum = idNum
    const anchor = `id="b-${match[1]}"`
    if (!row.line.includes(anchor)) {
      result.failures.push(`${row.id} anchor must match ${anchor}.`)
    }
  })

  const statusPattern = /^(\[[ x~]\]|Deprioritized)$/
  for (const row of rows) {
    if (row.cellCount !== 11) {
      result.failures.push(`${row.id} must have 11 table cells; found ${row.cellCount}.`)
    }
    if (!statusPattern.test(row.status)) {
      result.failures.push(`${row.id} has invalid status "${row.status}".`)
    }
    if (!row.problem) {
      result.failures.push(`${row.id} is missing a Problem statement.`)
    }
    if (!row.implementation) {
      result.failures.push(`${row.id} is missing an Implementations note.`)
    }
    if (!allowedImplementationTypes.has(row.implementationType)) {
      result.failures.push(`${row.id} has invalid Implementation Type "${row.implementationType}".`)
    }
    if (row.status === '[x]' && row.implementationType === 'none') {
      result.failures.push(`${row.id} is marked [x] but has Implementation Type none.`)
    }
    if (row.status === '[ ]' && !row.command.startsWith('Do: ')) {
      result.failures.push(`${row.id} is open but Suggested AI Command does not start with "Do: ".`)
    }
    if (row.implementation.startsWith('Shipped:') && row.status !== '[x]') {
      result.failures.push(`${row.id} has a shipped implementation but is not marked [x].`)
    }
    if (row.status === '[x]' && /^Not implemented yet\./i.test(row.implementation)) {
      result.failures.push(`${row.id} is marked [x] but its implementation still says not implemented.`)
    }
    if (
      row.status === '[x]' &&
      ['docs', 'restructure', 'audit', 'policy'].includes(row.implementationType) &&
      !isDocsPolicyOrRestructureItem(row)
    ) {
      result.failures.push(
        `${row.id} is shipped as ${row.implementationType}; confirm this is enough or reopen for implementation.`,
      )
    }
    if (row.status === '[x]') {
      result.failures.push(`${row.id} is marked [x] — move it to COMPLETED_ITEMS.md before committing.`)
    }
  }
}

function checkBacklogSpecificity(rows, result) {
  const vagueItemPattern = /\b(setup|governance|plan|strategy|requirements|docs?|system)\b$/i
  const bareDocPattern = /^`?(?:docs|product|design|business|operations)\//
  const missingCommands = []
  const vagueItems = []
  const weakCommands = []

  for (const row of rows) {
    if (!row.command) {
      missingCommands.push(row.id)
    }
    if (vagueItemPattern.test(row.item) || bareDocPattern.test(row.item)) {
      vagueItems.push(row.id)
    }
    if (
      row.command &&
      !/\b(implement|add|update|verify|remind Roy|document|reopen|ship|create|wire)\b/i.test(row.command)
    ) {
      weakCommands.push(row.id)
    }
  }

  if (missingCommands.length) {
    result.warnings.push(
      `Backlog specificity: ${missingCommands.length} rows should add Suggested AI Commands when next touched (${missingCommands.slice(0, 8).join(', ')}${missingCommands.length > 8 ? ', ...' : ''}).`,
    )
  }
  if (vagueItems.length) {
    result.warnings.push(
      `Backlog specificity: ${vagueItems.length} rows have vague item names to tighten when next touched (${vagueItems.slice(0, 8).join(', ')}${vagueItems.length > 8 ? ', ...' : ''}).`,
    )
  }
  if (weakCommands.length) {
    result.warnings.push(
      `Backlog specificity: ${weakCommands.length} commands should name the delivery action (${weakCommands.slice(0, 8).join(', ')}${weakCommands.length > 8 ? ', ...' : ''}).`,
    )
  }
}

function checkBacklogEvidence(backlogById, result, { evidenceRules = DEFAULT_EVIDENCE_RULES, existsFn = exists } = {}) {
  const verified = []
  const missingEvidence = []
  const docsOnly = []
  const needsImplementation = []

  for (const [id, files] of evidenceRules) {
    const row = backlogById.get(id)
    if (!row) continue
    const missing = files.filter((file) => !existsFn(file))
    if (missing.length === 0) {
      verified.push(id)
      if (row.status !== '[x]') {
        result.warnings.push(`${id} has implementation evidence but is not marked shipped.`)
      }
    } else {
      missingEvidence.push({ id, missing })
      if (row.status === '[x]') {
        result.warnings.push(`${id} is marked shipped but is missing evidence: ${missing.join(', ')}.`)
      }
    }
  }

  for (const row of backlogById.values()) {
    if (row.status !== '[x]') continue
    if (['docs', 'restructure', 'policy', 'audit'].includes(row.implementationType)) {
      docsOnly.push(row.id)
      if (!isDocsPolicyOrRestructureItem(row)) needsImplementation.push(row.id)
    }
  }

  return {
    verified,
    docsOnly,
    missingEvidence,
    needsImplementation,
  }
}

function checkAutomationRows(backlogById, result) {
  const implemented = new Map([
    ['B-065', 'stale-doc checks'],
    ['B-066', 'stale experiment checks'],
    ['B-067', 'stale feature detection'],
    ['B-068', 'backlog hygiene checks'],
    ['B-069', 'changelog/release-note generation'],
    ['B-070', 'migration tracking automation'],
    ['B-071', 'dependency health automation'],
    ['B-072', 'operational summary automation'],
    ['B-073', 'self-healing job policy'],
    ['B-074', 'dead-code detection'],
    ['B-075', 'PR summary/review checklist automation'],
    ['B-076', 'architecture drift detection'],
    ['B-077', 'feature-flag tracking'],
    ['B-078', 'human override requirements'],
  ])

  for (const [id, label] of implemented) {
    const row = backlogById.get(id)
    if (row && row.status !== '[x]') {
      result.warnings.push(`${id} (${label}) appears implemented by ops automation but is not marked shipped.`)
    }
  }
}

/**
 * Structural checks on BACKLOG.md raw content:
 * 1. No consecutive --- separators.
 * 2. No empty section headings (heading immediately followed by another heading or ---).
 */
function checkBacklogStructure(content, result) {
  const lines = content.split('\n')

  // Detect --- separators with only blank lines between them.
  let lastNonBlankWasSep = false
  let lastSepLine = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '---') {
      if (lastNonBlankWasSep) {
        result.failures.push(
          `BACKLOG.md has consecutive "---" separators (lines ${lastSepLine + 1} and ${i + 1}).`,
        )
      }
      lastNonBlankWasSep = true
      lastSepLine = i
    } else if (t !== '') {
      lastNonBlankWasSep = false
    }
  }

  // Detect empty section headings: a heading with no content (table row or prose)
  // before the next heading, ---, or end of file.
  let headingName = null
  let headingLineNo = 0
  let sectionHasContent = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isHeading = /^#{1,3} /.test(line)
    const isSeparator = line.trim() === '---'
    const isBlank = line.trim() === ''

    if (isHeading || isSeparator) {
      if (headingName !== null && !sectionHasContent) {
        result.failures.push(
          `BACKLOG.md section "${headingName}" (line ${headingLineNo}) is empty — add items or remove the heading.`,
        )
      }
      headingName = isHeading ? line.trim().replace(/^#{1,3} /, '') : null
      headingLineNo = i + 1
      sectionHasContent = false
    } else if (!isBlank) {
      sectionHasContent = true
    }
  }
  if (headingName !== null && !sectionHasContent) {
    result.failures.push(
      `BACKLOG.md section "${headingName}" (line ${headingLineNo}) is empty — add items or remove the heading.`,
    )
  }
}

/**
 * Checks that COMPLETED_ITEMS.md rows are in ascending numeric ID order,
 * so new completed items are always inserted at the correct position.
 */
function checkCompletedItemsOrder(content, result) {
  const idPattern = /<a id="b-(\d+)([a-z]*)"><\/a>/g
  let prevKey = -1
  let match
  while ((match = idPattern.exec(content)) !== null) {
    const base = parseInt(match[1], 10)
    const suffix = match[2]
    const key = base + (suffix ? (suffix.charCodeAt(0) - 96) / 100 : 0)
    if (key <= prevKey) {
      result.failures.push(
        `COMPLETED_ITEMS.md ID B-${match[1]}${match[2]} is out of ascending order — insert it at the correct position.`,
      )
    }
    prevKey = key
  }
}

function summarizeBacklog(rows) {
  return {
    total: rows.length,
    openP0: rows.filter((row) => row.status === '[ ]' && row.priority === 'P0').length,
    openP1: rows.filter((row) => row.status === '[ ]' && row.priority === 'P1').length,
    shipped: rows.filter((row) => row.status === '[x]').length,
  }
}

module.exports = {
  checkBacklog,
  checkBacklogSpecificity,
  checkBacklogEvidence,
  checkAutomationRows,
  checkBacklogStructure,
  checkCompletedItemsOrder,
  summarizeBacklog,
  isDocsPolicyOrRestructureItem,
  DEFAULT_EVIDENCE_RULES,
}
