function errorSurfaceFailures(relativePath, source) {
  if (relativePath === 'components/ui/ErrorMessage.tsx') return []

  const failures = []
  if (/\bstyles\.(?:errorBox|errorText)\b/.test(source)) {
    failures.push(`${relativePath}: [CUSTOM_ERROR_SURFACE] render routine failures with <ErrorMessage>.`)
  }
  if (/<Text\b[^>]*>\s*\{\s*(?:error|[A-Za-z]+Error)\s*\}\s*<\/Text>/m.test(source)) {
    failures.push(`${relativePath}: [INLINE_ERROR_TEXT] render routine failures with <ErrorMessage>.`)
  }
  if (/Alert\.alert\(\s*['"](?:Error|Could not[^'"]*|[^'"]*failed)['"]/m.test(source)) {
    failures.push(`${relativePath}: [FAILURE_ALERT] show routine failures with <ErrorMessage>; keep alerts for permission or confirmation prompts.`)
  }
  if (
    /(?:setNotice|setNoticeSheet|onShowNotice)\s*\(\s*\{[^}]{0,180}?title:\s*(?:['"](?:Could not[^'"]*|[^'"]*failed|[^'"]*unavailable)['"]|[^\n}]*\?\s*['"][^'"]*failed['"])/m.test(source)
  ) {
    failures.push(`${relativePath}: [FAILURE_NOTICE] dismiss-only failure notices are deprecated; render <ErrorMessage> or provide a recovery action.`)
  }
  return failures
}

module.exports = { errorSurfaceFailures }
