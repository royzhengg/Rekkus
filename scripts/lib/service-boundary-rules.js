const protectedLayer = /^(?:app|features|lib\/hooks|lib\/contexts)\//
const forbiddenImport =
  /from ['"](?:@\/lib\/supabase|@supabase\/supabase-js|(?:\.\.\/)+lib\/supabase|(?:\.\.\/)+supabase)['"]/

function hasForbiddenServiceImport(source) {
  return forbiddenImport.test(source)
}

function serviceBoundaryFailures(file, source, allowlisted = false) {
  if (!protectedLayer.test(file)) return []
  const forbidden = hasForbiddenServiceImport(source)
  if (allowlisted && !forbidden) {
    return [`FAIL [ALLOWLIST] ${file}: direct Supabase debt is gone; remove its allowlist entry.`]
  }
  if (forbidden && !allowlisted) {
    return [`FAIL [SUPABASE] ${file}: direct Supabase/provider import (use lib/services/).`]
  }
  return []
}

module.exports = { hasForbiddenServiceImport, serviceBoundaryFailures }
