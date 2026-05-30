#!/usr/bin/env node
'use strict'

const { spawn } = require('child_process')
const { argv } = require('./lib/args')

const scripts = argv()
if (scripts.length === 0) {
  console.error('Usage: node scripts/run-parallel.js <script1> <script2> ...')
  process.exit(1)
}

const isCI = process.env.CI === 'true'
const useColor = !isCI && process.stdout.isTTY

const COLORS = ['\x1b[36m', '\x1b[33m', '\x1b[35m', '\x1b[34m', '\x1b[32m', '\x1b[31m', '\x1b[37m']
const RESET = '\x1b[0m'

function color(text, index) {
  if (!useColor) return text
  return `${COLORS[index % COLORS.length]}${text}${RESET}`
}

const results = []
const startTime = Date.now()

const procs = scripts.map((script, i) => {
  const label = `[${script}]`
  const paddedLabel = label.padEnd(Math.max(...scripts.map((s) => s.length)) + 2 + 2)
  const coloredLabel = color(paddedLabel, i)

  const proc = spawn('npm', ['run', script], {
    shell: false,
    env: { ...process.env, FORCE_COLOR: '0' },
  })

  const lines = []

  function handleChunk(chunk) {
    const text = chunk.toString()
    const chunkLines = text.split('\n')
    for (let j = 0; j < chunkLines.length; j++) {
      const line = chunkLines[j]
      if (j === chunkLines.length - 1 && line === '') continue
      const out = `${coloredLabel} ${line}`
      lines.push(out)
      process.stdout.write(out + '\n')
    }
  }

  proc.stdout.on('data', handleChunk)
  proc.stderr.on('data', handleChunk)

  return new Promise((resolve) => {
    proc.on('close', (code) => {
      results.push({ script, code: code ?? 1 })
      resolve()
    })
    proc.on('error', (err) => {
      const msg = `${coloredLabel} spawn error: ${err.message}`
      process.stdout.write(msg + '\n')
      results.push({ script, code: 1 })
      resolve()
    })
  })
})

Promise.all(procs).then(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const failures = results.filter((r) => r.code !== 0)
  const passes = results.filter((r) => r.code === 0)

  process.stdout.write('\n')
  process.stdout.write(`run-parallel: ${passes.length}/${scripts.length} passed in ${elapsed}s\n`)

  if (failures.length > 0) {
    for (const f of failures) {
      process.stdout.write(`  FAIL  ${f.script}\n`)
    }
    process.exit(1)
  }
})
