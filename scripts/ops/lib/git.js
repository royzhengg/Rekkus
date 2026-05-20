const { execFileSync } = require('child_process')

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function changedFiles() {
  const output = git(['status', '--short'])
  if (!output) return []

  return output
    .split('\n')
    .map((line) => line.slice(3).trim())
    .map((file) => file.replace(/^"|"$/g, ''))
    .filter(Boolean)
}

function recentCommits(limit = 8) {
  const output = git(['log', `--max-count=${limit}`, '--pretty=format:%h %s'])
  if (!output) return []
  return output.split('\n').filter(Boolean)
}

module.exports = {
  changedFiles,
  recentCommits,
}

