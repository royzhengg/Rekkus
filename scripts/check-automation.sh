#!/usr/bin/env bash
cd "$(dirname "$0")/.."
node scripts/check-automation.js "$@"
