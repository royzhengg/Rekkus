const fs = require('fs')
const path = require('path')

const nm = path.resolve(__dirname, '..', 'node_modules')
if (!fs.existsSync(nm)) process.exit(0)

// macOS creates ".bin 2", ".bin 3" etc. when npm install is interrupted mid-write.
// These shadow the real .bin and cause expo/CLI resolution to fail silently.
const bad = fs.readdirSync(nm).filter(d => /^\.bin \d+$/.test(d))
for (const d of bad) {
  fs.rmSync(path.join(nm, d), { recursive: true, force: true })
  console.warn(`postinstall: removed corrupted node_modules dir "${d}"`)
}
