#!/usr/bin/env node
const { changedFiles } = require('./lib/git')

const files = changedFiles()
const categories = {
  docs: files.filter((file) => /(^docs\/|^product\/|^business\/|^operations\/|\.md$)/.test(file)),
  app: files.filter((file) => /^(app|features|components|lib|constants|types)\//.test(file)),
  supabase: files.filter((file) => /^supabase\//.test(file)),
  risk: files.filter((file) => /security|release|migration|supabase|config|env|package|lock|BACKLOG/i.test(file)),
}

const lines = [
  '# PR Summary',
  '',
  '## Changed Files',
  '',
  `- Total: ${files.length}`,
  `- Docs/product/business/ops: ${categories.docs.length}`,
  `- App code: ${categories.app.length}`,
  `- Supabase: ${categories.supabase.length}`,
  `- Risk-sensitive: ${categories.risk.length}`,
  '',
  '## Review Checklist',
  '',
  '- Scope is small, reversible, and tied to a backlog/product problem.',
  '- Owner docs and BACKLOG.md match implementation truth.',
  '- Required checks were run for the touched surfaces.',
  '- Security, release, data, provider, and cost risks are named when touched.',
  '',
  '## Files',
  '',
  ...files.map((file) => `- ${file}`),
  '',
]

process.stdout.write(`${lines.join('\n')}\n`)
