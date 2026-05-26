const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '..')
const sourceRoots = ['app', 'features', 'components', 'lib', 'types', 'constants', 'scripts', 'supabase']
const skipDirs = new Set(['node_modules', '.git', '.expo', 'Pods', 'build', '.temp'])
const serviceRoleKeyName = 'SUPABASE_' + 'SERVICE_ROLE_KEY'
const sensitiveEnvPattern = /(?:SUPABASE_[A-Z_]*SERVICE|SERVICE_ROLE|SECRET|PRIVATE|TOKEN|API_SECRET)/i
const knownDirectServiceAccess = new Set([
  'features/auth/SignupProfileScreen.tsx',
  'features/posts/PostDetailScreen.tsx',
  'features/profile/ProfileScreen.tsx',
  'features/restaurants/RestaurantDetailScreen.tsx',
  'features/search/SearchScreen.tsx',
  'features/settings/EditProfileScreen.tsx',
  'features/messages/ConversationScreen.tsx',
  'features/messages/ConversationInfoScreen.tsx',
  'features/messages/CreateGroupScreen.tsx',
])
const failures = []

const gitignore = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')
if (!gitignore.split(/\r?\n/).includes('.temp/')) {
  failures.push('.gitignore must ignore .temp/ because it contains generated scratch output.')
}

const trackedTempFiles = execFileSync('git', ['ls-files', '--', '.temp'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim()
if (trackedTempFiles) {
  failures.push('.temp/ contains tracked generated output; remove it from version control.')
}

function walk(relativeRoot, visitor) {
  const absoluteRoot = path.join(repoRoot, relativeRoot)
  if (!fs.existsSync(absoluteRoot)) return

  const stack = [absoluteRoot]
  while (stack.length) {
    const current = stack.pop()
    const name = path.basename(current)
    const stat = fs.statSync(current)

    if (stat.isDirectory()) {
      if (skipDirs.has(name)) continue
      for (const child of fs.readdirSync(current)) stack.push(path.join(current, child))
      continue
    }

    visitor(current)
  }
}

for (const root of sourceRoots) {
  walk(root, (filePath) => {
    const relativePath = path.relative(repoRoot, filePath)
    const baseName = path.basename(filePath)

    // .DS_Store is ignored by git; do not fail local checks when macOS recreates it.
    if (baseName === '.DS_Store') return

    if (/ [23](?:\.|$)/.test(baseName)) {
      failures.push(`${relativePath} looks like a duplicate generated/backup artifact.`)
    }

    if (/\.[jt]sx?$/.test(filePath)) {
      const source = fs.readFileSync(filePath, 'utf8')

      if (
        source.includes(serviceRoleKeyName) &&
        !relativePath.startsWith(`supabase${path.sep}functions${path.sep}`)
      ) {
        failures.push(
          `${relativePath} references ${serviceRoleKeyName} outside Edge Functions.`
        )
      }

      if (/^features\//.test(relativePath) && source.includes('@/lib/mocks')) {
        failures.push(`${relativePath} imports mocks directly; route through a data-source boundary.`)
      }

      if (/^app\//.test(relativePath) && source.includes('@/lib/mocks')) {
        failures.push(`${relativePath} imports mocks directly; route through a data-source boundary.`)
      }

      if (
        /^(app|features)\//.test(relativePath) &&
        /supabase\.from\(|fetch\(['"`]https?:\/\//.test(source) &&
        !knownDirectServiceAccess.has(relativePath)
      ) {
        failures.push(`${relativePath} performs direct service/API access; route external calls through lib/services.`)
      }

      if (!relativePath.startsWith(`supabase${path.sep}functions${path.sep}`)) {
        const expoPublicMatches = [...source.matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)].map((match) => match[0])
        for (const name of expoPublicMatches) {
          if (sensitiveEnvPattern.test(name)) {
            failures.push(`${relativePath} references sensitive-looking public env ${name}.`)
          }
        }
      }

      if (
        /ImagePicker\.launchImageLibraryAsync/.test(source) &&
        !/validatePicked(?:PostImages|PostMedia|AvatarImage|MessageAttachment)/.test(source)
      ) {
        failures.push(`${relativePath} uses ImagePicker without shared media validation.`)
      }
    }
  })
}

for (const legacyRoute of ['app/(tabs)/post.tsx', 'app/(tabs)/places.tsx']) {
  const routePath = path.join(repoRoot, legacyRoute)
  if (!fs.existsSync(routePath)) continue
  const source = fs.readFileSync(routePath, 'utf8')
  if (!source.includes('Redirect')) {
    failures.push(`${legacyRoute} exists but is not a redirect wrapper.`)
  }
}

const appEnv = process.env.EXPO_PUBLIC_APP_ENV
const dataMode = process.env.EXPO_PUBLIC_DATA_MODE
if ((appEnv === 'beta' || appEnv === 'production') && dataMode !== 'live') {
  failures.push(`${appEnv} builds must set EXPO_PUBLIC_DATA_MODE=live.`)
}

const tsconfigPath = path.join(repoRoot, 'tsconfig.json')
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'))
if (!tsconfig.compilerOptions?.jsx) {
  failures.push(
    'tsconfig.json must declare "jsx" explicitly in compilerOptions — do not rely solely on expo/tsconfig.base inheritance (causes IDE false errors).'
  )
}

if (failures.length > 0) {
  console.error('Hygiene guardrails failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Hygiene guardrails passed.')
