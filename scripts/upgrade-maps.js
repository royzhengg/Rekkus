#!/usr/bin/env node
/**
 * upgrade-maps.js
 *
 * Safely upgrades react-native-maps by:
 *   1. Installing the target version via npm
 *   2. Inspecting the new podspecs to find the correct Google Maps pod name
 *   3. Updating package.json (exact pin) and ios/Podfile
 *   4. Deleting ios/Podfile.lock (so CocoaPods resolves fresh)
 *   5. Running pod install
 *
 * Usage:
 *   node scripts/upgrade-maps.js                    # show available versions, no changes
 *   node scripts/upgrade-maps.js --to 1.21.0        # dry-run: show what would change
 *   node scripts/upgrade-maps.js --to 1.21.0 --run  # apply all changes + pod install
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { execSync, spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const PKG_PATH = path.join(ROOT, 'package.json')
const PODFILE_PATH = path.join(ROOT, 'ios', 'Podfile')
const PODLOCK_PATH = path.join(ROOT, 'ios', 'Podfile.lock')
const MAPS_NODE = path.join(ROOT, 'node_modules', 'react-native-maps')

const args = process.argv.slice(2)
const targetVersion = (() => {
  const idx = args.indexOf('--to')
  return idx !== -1 ? args[idx + 1] : null
})()
const shouldRun = args.includes('--run')
const help = args.includes('--help') || args.includes('-h')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: 'inherit', cwd: ROOT, ...opts })
}

function capture(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function bold(s) { return `\x1b[1m${s}\x1b[0m` }
function green(s) { return `\x1b[32m${s}\x1b[0m` }
function yellow(s) { return `\x1b[33m${s}\x1b[0m` }
function red(s) { return `\x1b[31m${s}\x1b[0m` }
function dim(s) { return `\x1b[2m${s}\x1b[0m` }

function fail(msg) {
  console.error(red(`\n✖  ${msg}\n`))
  process.exit(1)
}

// ─── Podspec detection ───────────────────────────────────────────────────────

/**
 * Reads all .podspec files in node_modules/react-native-maps and returns
 * the pod name that provides Google Maps support (depends on GoogleMaps SDK
 * or compiles AirGoogleMaps source files).
 *
 * Returns { googlePodName, applePodName } where googlePodName may be null
 * if the installed version doesn't have a separate Google podspec (pre-split).
 */
function detectPodNames() {
  const specs = fs.readdirSync(MAPS_NODE)
    .filter(f => f.endsWith('.podspec'))
    .map(f => ({
      file: f,
      content: fs.readFileSync(path.join(MAPS_NODE, f), 'utf8'),
    }))

  if (specs.length === 0) fail('No .podspec files found in node_modules/react-native-maps.')

  function extractName(content) {
    const m = content.match(/s\.name\s*=\s*["']([^"']+)["']/)
    return m ? m[1] : null
  }

  function isGoogleSpec(content) {
    return (
      content.includes('GoogleMaps') ||
      content.includes('AirGoogleMaps') ||
      content.includes('HAVE_GOOGLE_MAPS')
    )
  }

  function isGoogleSubspec(content) {
    // Old subspec style: s.subspec 'Google' do ...
    return /s\.subspec\s+['"]Google['"]/i.test(content)
  }

  let googlePodName = null
  let applePodName = null

  for (const { content } of specs) {
    const name = extractName(content)
    if (!name) continue

    if (isGoogleSpec(content)) {
      if (isGoogleSubspec(content)) {
        // Old-style: subspec inside the main pod → use `PodName/Google`
        googlePodName = `${name}/Google`
      } else {
        // New-style: separate podspec entirely
        googlePodName = name
      }
    } else {
      applePodName = name
    }
  }

  // Fallback: single podspec that includes both (very old versions)
  if (!googlePodName && specs.length === 1) {
    const { content } = specs[0]
    const name = extractName(content)
    googlePodName = isGoogleSpec(content) ? name : null
    applePodName = name
  }

  return { googlePodName, applePodName }
}

// ─── Podfile parsing ─────────────────────────────────────────────────────────

/** Returns the current Google pod entry line from the Podfile, or null. */
function currentPodfileLine() {
  const content = fs.readFileSync(PODFILE_PATH, 'utf8')
  const match = content.match(/^\s*pod\s+['"]react-native[^'"]*maps[^'"]*['"].*:path.*react-native-maps.*$/m)
  return match ? match[0].trim() : null
}

/** Replaces the Google pod line in the Podfile with a new pod name. */
function updatePodfile(newPodName) {
  let content = fs.readFileSync(PODFILE_PATH, 'utf8')

  // Remove old block comment + pod line (if our comment block is present)
  content = content.replace(
    /  # react-native-maps.*?\n(?:  #[^\n]*\n)*  pod ['"]react-native[^'"]*maps[^'"]*['"][^\n]*\n/s,
    buildPodBlock(newPodName)
  )

  // Fallback: replace just the pod line if no comment block found
  if (!content.includes(newPodName)) {
    content = content.replace(
      /^\s*pod ['"]react-native[^'"]*maps[^'"]*['"][^\n]*/m,
      buildPodBlock(newPodName).trimEnd()
    )
  }

  fs.writeFileSync(PODFILE_PATH, content, 'utf8')
}

function buildPodBlock(podName) {
  const installedVersion = installedMapsVersion()
  return `  # react-native-maps v${installedVersion} ships Google Maps support as a separate podspec.
  # The old \`react-native-maps/Google\` subspec was removed in this version.
  # If upgrading react-native-maps, check whether this pod name has changed again
  # before bumping the version in package.json.
  pod '${podName}', :path => '../node_modules/react-native-maps'
`
}

// ─── package.json helpers ────────────────────────────────────────────────────

function currentPkgVersion() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'))
  const raw = pkg.dependencies['react-native-maps'] ?? ''
  return raw.replace(/^[\^~]/, '')
}

function installedMapsVersion() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(MAPS_NODE, 'package.json'), 'utf8'))
    return p.version
  } catch {
    return null
  }
}

function pinVersionInPackageJson(version) {
  const raw = fs.readFileSync(PKG_PATH, 'utf8')
  const updated = raw.replace(
    /"react-native-maps":\s*"[\^~]?[^"]+"/,
    `"react-native-maps": "${version}"`
  )
  fs.writeFileSync(PKG_PATH, updated, 'utf8')
}

// ─── npm helpers ─────────────────────────────────────────────────────────────

function fetchAvailableVersions() {
  try {
    const out = capture('npm view react-native-maps versions --json')
    return JSON.parse(out)
  } catch {
    return []
  }
}

function latestVersion() {
  try {
    return capture('npm view react-native-maps version')
  } catch {
    return null
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (help) {
  console.log(`
${bold('upgrade-maps')} — safely upgrade react-native-maps with automatic pod detection

${bold('Usage:')}
  node scripts/upgrade-maps.js                     List versions, show current state
  node scripts/upgrade-maps.js --to <version>      Dry-run: show what would change
  node scripts/upgrade-maps.js --to <version> --run Apply changes + pod install

${bold('Options:')}
  --to <version>   Target version (e.g. 1.21.0)
  --run            Apply all changes (npm install, Podfile update, pod install)
  --help           Show this message
`)
  process.exit(0)
}

console.log(bold('\n🗺  react-native-maps upgrade tool\n'))

const pkgCurrent = currentPkgVersion()
const installed = installedMapsVersion()
const latest = latestVersion()

console.log(`  Current in package.json : ${bold(pkgCurrent)}`)
console.log(`  Installed in node_modules: ${bold(installed ?? 'none')}`)
console.log(`  Latest on npm            : ${bold(latest ?? 'unknown')}`)
console.log(`  Current Podfile line     : ${dim(currentPodfileLine() ?? 'not found')}`)
console.log()

if (!targetVersion) {
  // Just show info and recent versions
  const versions = fetchAvailableVersions()
  const recent = versions.slice(-10)
  console.log(`  Recent versions: ${recent.join('  ')}`)
  console.log()
  console.log(dim('  Run with --to <version> to see what would change, add --run to apply.\n'))
  process.exit(0)
}

// Validate target
const allVersions = fetchAvailableVersions()
if (!allVersions.includes(targetVersion)) {
  fail(`Version ${targetVersion} not found on npm. Run without --to to list available versions.`)
}

if (targetVersion === pkgCurrent) {
  console.log(yellow(`  Already on ${targetVersion}. Nothing to do.\n`))
  process.exit(0)
}

console.log(`  Upgrading: ${bold(pkgCurrent)} → ${bold(targetVersion)}`)
console.log()

if (!shouldRun) {
  // Dry-run: install to a temp location to inspect podspecs
  console.log(dim('  [dry-run] Fetching podspec info from npm…'))
  const tmpDir = path.join(ROOT, '.temp', 'maps-inspect')
  fs.mkdirSync(tmpDir, { recursive: true })
  try {
    execSync(
      `npm pack react-native-maps@${targetVersion} --pack-destination "${tmpDir}" --quiet`,
      { cwd: ROOT, encoding: 'utf8' }
    )
    const tarball = fs.readdirSync(tmpDir).find(f => f.endsWith('.tgz'))
    if (!tarball) fail('Could not download tarball for inspection.')
    execSync(`tar -xzf "${path.join(tmpDir, tarball)}" -C "${tmpDir}" --strip-components=1`, { encoding: 'utf8' })

    const specs = fs.readdirSync(tmpDir)
      .filter(f => f.endsWith('.podspec'))
      .map(f => ({ file: f, content: fs.readFileSync(path.join(tmpDir, f), 'utf8') }))

    console.log()
    console.log('  Podspecs in new version:')
    for (const { file } of specs) {
      console.log(`    ${green('✔')}  ${file}`)
    }

    // Temporarily swap node_modules for detection
    const origMaps = fs.readdirSync(MAPS_NODE)
    const tmpSpecs = specs.map(({ file, content }) => {
      const dest = path.join(MAPS_NODE, file)
      const existed = origMaps.includes(file)
      const origContent = existed ? fs.readFileSync(dest, 'utf8') : null
      fs.writeFileSync(dest, content, 'utf8')
      return { dest, origContent, existed }
    })

    const { googlePodName } = detectPodNames()

    // Restore
    for (const { dest, origContent, existed } of tmpSpecs) {
      if (existed && origContent !== null) fs.writeFileSync(dest, origContent, 'utf8')
      else if (!existed) fs.unlinkSync(dest)
    }

    fs.rmSync(tmpDir, { recursive: true, force: true })

    console.log()
    console.log(`  Google pod name (new)    : ${bold(googlePodName ?? 'not found')}`)
    console.log(`  Current Podfile entry    : ${dim(currentPodfileLine() ?? 'not found')}`)
    console.log()

    if (!googlePodName) {
      console.log(yellow('  ⚠  Could not detect Google Maps pod in the new version.'))
      console.log(yellow('     Inspect the .podspec files manually before upgrading.\n'))
    } else {
      console.log('  Changes that would be made:')
      console.log(`    package.json  react-native-maps: ${yellow(pkgCurrent)} → ${green(targetVersion)} (exact pin)`)
      console.log(`    ios/Podfile   pod name → ${green(`'${googlePodName}'`)}`)
      console.log(`    ios/Podfile.lock  deleted (CocoaPods will resolve fresh)`)
      console.log()
      console.log(dim(`  Add ${bold('--run')} to apply these changes and run pod install.\n`))
    }
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fail(`Dry-run failed: ${err.message}`)
  }
  process.exit(0)
}

// ─── Apply changes ────────────────────────────────────────────────────────────

console.log(bold('  Step 1/4 — npm install\n'))
const installResult = run(`npm install react-native-maps@${targetVersion} --save-exact`)
if (installResult.status !== 0) fail('npm install failed.')

console.log()
console.log(bold('  Step 2/4 — Detect Google Maps pod name\n'))
const { googlePodName, applePodName } = detectPodNames()

console.log(`    Apple pod  : ${dim(applePodName ?? 'none')}`)
console.log(`    Google pod : ${bold(googlePodName ?? 'not found')}`)

if (!googlePodName) {
  fail(
    'Could not detect a Google Maps podspec in the installed version.\n' +
    '     Check node_modules/react-native-maps/*.podspec manually\n' +
    '     and update ios/Podfile by hand before running pod install.'
  )
}

console.log()
console.log(bold('  Step 3/4 — Update package.json + Podfile\n'))
pinVersionInPackageJson(targetVersion)
console.log(`    package.json  react-native-maps pinned to ${green(targetVersion)}`)

updatePodfile(googlePodName)
console.log(`    ios/Podfile   pod updated to ${green(`'${googlePodName}'`)}`)

if (fs.existsSync(PODLOCK_PATH)) {
  fs.unlinkSync(PODLOCK_PATH)
  console.log(`    ios/Podfile.lock  deleted`)
}

console.log()
console.log(bold('  Step 4/4 — pod install\n'))
const podResult = run('pod install --repo-update', { cwd: path.join(ROOT, 'ios') })
if (podResult.status !== 0) {
  console.log()
  fail(
    'pod install failed. package.json and Podfile have been updated — check the\n' +
    '     CocoaPods error above, fix the Podfile manually if needed, then re-run:\n' +
    '       cd ios && pod install'
  )
}

console.log()
console.log(green(bold(`  ✔  react-native-maps upgraded to ${targetVersion} successfully.\n`)))
console.log(dim('  Next: npx expo run:ios\n'))
