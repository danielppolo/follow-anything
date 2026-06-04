#!/usr/bin/env -S node --experimental-strip-types
import { pathToFileURL } from 'node:url'
import { runCli } from '../src/cli.ts'

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''
if (import.meta.url === invoked) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
