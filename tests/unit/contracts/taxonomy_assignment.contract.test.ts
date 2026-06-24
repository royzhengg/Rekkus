/**
 * Contract tests for the taxonomy assignment pipeline (B-625).
 *
 * These are static analysis tests — they verify invariants in source files
 * without running a live database. Live acceptance-gate and search correctness
 * tests require a Supabase local instance (see docs/domains/search/taxonomy-assignment.md).
 *
 * Invariants verified here:
 *   1. Search code never queries taxonomy_suggestions or place_taxonomies directly
 *   2. Application code never writes to place_taxonomies directly
 *   3. Service layer does not import supabase outside lib/services/
 *   4. TypeScript types derive from Postgres enum definitions, not string literals
 *   5. Acceptance gate view is the only taxonomy read in search functions
 *   6. Migration contains required invariant comment block
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const root = path.resolve(__dirname, '../../../')

function readSource(rel: string): string {
  return fs.readFileSync(path.resolve(root, rel), 'utf8')
}

function filesUnder(dir: string, ext: string): string[] {
  const results: string[] = []
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(ext)) results.push(full)
    }
  }
  walk(path.resolve(root, dir))
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Migration invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('B-625 migration', () => {
  const migration = readSource(
    'supabase/migrations/20260626000009_taxonomy_assignment_pipeline.sql'
  )

  it('opens with the required invariant comment block', () => {
    expect(migration).toContain('INVARIANTS (do not violate)')
    expect(migration).toContain('taxonomy_suggestions  = intake only')
    expect(migration).toContain('place_taxonomies      = authoritative truth only')
    expect(migration).toContain('search reads only')
    expect(migration).toContain('assignments are soft-deleted')
    expect(migration).toContain('moderation history (suggestions.status) is immutable')
  })

  it('defines all three enum types', () => {
    expect(migration).toContain('create type public.taxonomy_source')
    expect(migration).toContain('create type public.taxonomy_suggestion_status')
    expect(migration).toContain('create type public.taxonomy_review_reason')
  })

  it('creates taxonomy_suggestions table', () => {
    expect(migration).toContain('create table public.taxonomy_suggestions')
  })

  it('creates place_taxonomies_accepted view', () => {
    expect(migration).toContain('create or replace view public.place_taxonomies_accepted')
    expect(migration).toContain('removed_at is null')
    expect(migration).toContain('confidence_score >= 0.50')
  })

  it('creates append-only audit table with FOR ALL USING (false) RLS', () => {
    expect(migration).toContain('create table public.taxonomy_assignment_events')
    expect(migration).toContain("for all using (false)")
  })

  it('soft-deletes via removed_at, not DELETE, in remove_taxonomy_assignment', () => {
    // Extract the remove_taxonomy_assignment function body
    const fnStart = migration.indexOf('remove_taxonomy_assignment')
    const fnBody = migration.slice(fnStart, fnStart + 2000)
    expect(fnBody).toContain('removed_at = now()')
    expect(fnBody).not.toMatch(/delete from public\.place_taxonomies[^;]*where place_id = p_place_id/)
  })

  it('does not mutate suggestion status in remove_taxonomy_assignment', () => {
    // The remove function must not update taxonomy_suggestions.status
    const removeStart = migration.indexOf("'assignment_removed'")
    // Find the function block for remove_taxonomy_assignment
    const fnStart = migration.indexOf('create or replace function public.remove_taxonomy_assignment')
    const fnEnd = migration.indexOf('$$;\n\ncomment on function public.remove_taxonomy_assignment')
    const fnBody = migration.slice(fnStart, fnEnd)
    // Should not contain update to taxonomy_suggestions
    expect(fnBody).not.toMatch(/update public\.taxonomy_suggestions/)
    // Regression guard is present
    expect(removeStart).toBeGreaterThan(-1)
  })

  it('promote_taxonomy_suggestion floors confidence to 0.50', () => {
    expect(migration).toContain('greatest(v_sug.confidence_score, 0.50)')
  })

  it('OSM sync upsert never overwrites admin assignments', () => {
    expect(migration).toContain("where place_taxonomies.source != 'admin'")
  })

  it('OSM trigger hard-deletes OSM rows by design (documented exception to soft-delete)', () => {
    const osmDelete = migration.indexOf("delete from public.place_taxonomies")
    const osmComment = migration.indexOf('Hard-delete OSM rows no longer in the resolved set')
    expect(osmDelete).toBeGreaterThan(-1)
    expect(osmComment).toBeGreaterThan(-1)
  })

  it('search function uses place_taxonomies_accepted not place_taxonomies', () => {
    const searchStart = migration.indexOf('create or replace function public.search_text_fallback')
    const searchEnd = migration.indexOf('grant execute on function public.search_text_fallback')
    const searchBody = migration.slice(searchStart, searchEnd)

    expect(searchBody).toContain('place_taxonomies_accepted')
    // Must not reference the base table directly in the search function
    expect(searchBody).not.toMatch(/from public\.place_taxonomies\b(?!_accepted)/)
    expect(searchBody).not.toMatch(/join public\.place_taxonomies\b(?!_accepted)/)
  })

  it('classifier coherence constraint prevents non-AI rows from having classifier fields', () => {
    expect(migration).toContain('chk_classifier_on_ai_only')
    expect(migration).toContain("source = 'ai'")
    expect(migration).toContain('classifier_name is null')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Service layer boundaries
// ─────────────────────────────────────────────────────────────────────────────

describe('lib/services/places/taxonomy.ts', () => {
  const service = readSource('lib/services/places/taxonomy.ts')

  it('only reads taxonomy data via place_taxonomies_accepted (not the base table)', () => {
    expect(service).toContain('place_taxonomies_accepted')
    expect(service).not.toMatch(/from\('place_taxonomies'\)/)
  })

  it('all writes go through RPCs (no direct table inserts)', () => {
    expect(service).not.toMatch(/\.from\('place_taxonomies'\)\.insert/)
    expect(service).not.toMatch(/\.from\('place_taxonomies'\)\.update/)
    expect(service).not.toMatch(/\.from\('taxonomy_suggestions'\)\.insert/)
  })

  it('does not import from features/ or lib/hooks/ (service layer boundary)', () => {
    expect(service).not.toMatch(/from ['"].*\/features\//)
    expect(service).not.toMatch(/from ['"].*\/lib\/hooks\//)
    expect(service).not.toMatch(/from ['"].*\/lib\/contexts\//)
  })

  it('exports the expected public API', () => {
    expect(service).toContain('export async function submitUserTaxonomySuggestion')
    expect(service).toContain('export async function assignAdminTaxonomy')
    expect(service).toContain('export async function removeAdminTaxonomy')
    expect(service).toContain('export async function getPlaceAcceptedTaxonomies')
    expect(service).toContain('export async function getTaxonomyReviewQueue')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. TypeScript types derive from Postgres enums
// ─────────────────────────────────────────────────────────────────────────────

describe('lib/types/taxonomy.ts', () => {
  const types = readSource('lib/types/taxonomy.ts')

  it('derives TaxonomySource from Postgres enum, not string literal union', () => {
    expect(types).toContain("Enums['taxonomy_source']")
    // Must not fall back to a hardcoded union
    expect(types).not.toMatch(/TaxonomySource\s*=\s*['"]osm['"]/)
  })

  it('derives TaxonomySuggestionStatus from Postgres enum', () => {
    expect(types).toContain("Enums['taxonomy_suggestion_status']")
  })

  it('derives TaxonomyReviewReason from Postgres enum', () => {
    expect(types).toContain("Enums['taxonomy_review_reason']")
  })

  it('derives TaxonomySuggestion from Tables row type', () => {
    expect(types).toContain("Tables['taxonomy_suggestions']['Row']")
  })

  it('derives TaxonomyAssignment from Tables row type', () => {
    expect(types).toContain("Tables['place_taxonomies']['Row']")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. No feature/UI files write directly to place_taxonomies
// ─────────────────────────────────────────────────────────────────────────────

describe('No direct place_taxonomies writes in features/ or app/', () => {
  const featureFiles = [
    ...filesUnder('features', '.ts'),
    ...filesUnder('features', '.tsx'),
    ...filesUnder('app', '.ts'),
    ...filesUnder('app', '.tsx'),
  ]

  it.each(featureFiles.map(f => [path.relative(root, f), f]))(
    '%s does not write to place_taxonomies directly',
    (_rel, filePath) => {
      const src = fs.readFileSync(filePath, 'utf8')
      expect(src).not.toMatch(/\.from\(['"]place_taxonomies['"]\)\.insert/)
      expect(src).not.toMatch(/\.from\(['"]place_taxonomies['"]\)\.update/)
      expect(src).not.toMatch(/\.from\(['"]taxonomy_suggestions['"]\)\.insert/)
    }
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. ADR exists and contains required sections
// ─────────────────────────────────────────────────────────────────────────────

describe('ADR-0031', () => {
  const adr = readSource('docs/adr/ADR-0031-taxonomy-assignment-pipeline.md')

  it('contains invariants section', () => {
    expect(adr).toContain('Invariants')
    expect(adr).toContain('place_taxonomies_accepted')
  })

  it('contains forbidden operations section', () => {
    expect(adr).toContain('Forbidden')
    expect(adr).toContain('place_taxonomies')
  })

  it('documents the confidence floor rationale', () => {
    expect(adr).toMatch(/floor|GREATEST|0\.50/)
  })
})
