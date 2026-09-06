/**
 * Copies the flags we actually use out of `flag-icons` and into `public/flags/`.
 *
 *   npm run flags        (runs automatically before `npm run build`)
 *
 * They are static files rather than bundled assets on purpose: 1.3 MB of SVG
 * has no business in the JavaScript, and a game only ever shows a handful, so
 * nginx serving them individually is both smaller and lazier.
 *
 * `public/flags/` is generated and gitignored — the flags live in the package.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { COUNTRIES } from '../src/game/data/countries.generated.ts'

const url = (p: string) => fileURLToPath(new URL(p, import.meta.url))

const source = url('../node_modules/flag-icons/flags/4x3/')
const target = url('../public/flags/')

if (!existsSync(source)) {
  console.error('\n  flag-icons is not installed. Run `npm install`.\n')
  process.exit(1)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

const available = new Set(readdirSync(source))
const missing: string[] = []
let copied = 0
let bytes = 0

for (const country of COUNTRIES) {
  const file = `${country.flag}.svg`

  if (!country.flag || !available.has(file)) {
    missing.push(`${country.code} (${country.name})`)
    continue
  }
  copyFileSync(source + file, target + file)
  copied++
  bytes += statSync(target + file).size
}

if (missing.length > 0) {
  console.error(`\n  No flag for: ${missing.join(', ')}\n`)
  process.exit(1)
}

console.log(`\n  copied ${copied} flags into public/flags/ (${(bytes / 1e6).toFixed(2)} MB)\n`)
