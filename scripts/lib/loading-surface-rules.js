function loadingSurfaceFailures(relativePath, source) {
  if (relativePath === 'components/ui/EmptyState.tsx') return []

  const failures = []
  const centredStyleIndicator =
    /styles\.[a-zA-Z]*[Cc]enter[a-zA-Z]*[^>]*>\s*(?:\{[^}]*\?\s*)?<ActivityIndicator/
  const centredInlineIndicator = [...source.matchAll(/<View\b[^>]*style=\{\{([\s\S]*?)\}\}[^>]*>([\s\S]{0,240}?)(?:<\/View>|$)/g)]
    .some(([, style, children]) => (
      /flex:\s*1/.test(style) &&
      /alignItems:\s*['"]center['"]/.test(style) &&
      /justifyContent:\s*['"]center['"]/.test(style) &&
      /<ActivityIndicator/.test(children)
    ))

  if (centredStyleIndicator.test(source) || centredInlineIndicator) {
    failures.push(
      `${relativePath}: [CENTRED_CONTENT_SPINNER] use content-shaped <Skeleton> loading or <EmptyState loading> for a shape-less blocking wait.`,
    )
  }

  return failures
}

module.exports = { loadingSurfaceFailures }
