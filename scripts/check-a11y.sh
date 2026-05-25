#!/usr/bin/env bash
cd "$(dirname "$0")/.."
node scripts/check-a11y.js "$@"
