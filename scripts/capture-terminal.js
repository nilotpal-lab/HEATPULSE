/**
 * HeatPulse — Terminal Output Screenshots
 *
 * Captures build, lint, project structure, and git history
 * as image files for the SIH QA screenshot set.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require('playwright')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs')

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots')
const PROJECT_DIR = path.join(__dirname, '..')

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

function runCommand(cmd, title) {
  const filePath = path.join(SCREENSHOTS_DIR, `${title}.png`)
  try {
    const output = execSync(cmd, {
      cwd: PROJECT_DIR,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim()

    // Create an HTML page with the output
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background: #1a1a2e; color: #e0e0e0; font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; font-size: 13px; padding: 20px; margin: 0; overflow: auto; }
    pre { white-space: pre-wrap; word-wrap: break-word; line-height: 1.5; }
    .title { color: #00d4ff; font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 8px; }
    .success { color: #4ade80; }
    .error { color: #f87171; }
    .warning { color: #fbbf24; }
  </style>
</head>
<body>
  <div class="title">${title}</div>
  <pre>${output.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`

    fs.writeFileSync(filePath.replace('.png', '.html'), html, 'utf8')
    console.log(`  📄 ${title}.html (source)`)
    return { filePath, html, title }
  } catch (err) {
    console.log(`  ❌ ${title}: ${err.message}`)
    return null
  }
}

async function captureTerminal(title, html, width = 960, height = 640) {
  const filePath = path.join(SCREENSHOTS_DIR, `${title}.png`)
  try {
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width, height } })
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.screenshot({ path: filePath, fullPage: true })
    await browser.close()
    console.log(`  ✅ ${title}.png`)
    return filePath
  } catch (err) {
    console.log(`  ❌ ${title}: ${err.message}`)
    return null
  }
}

async function main() {
  console.log('HeatPulse — Terminal Screenshots\n')

  // Build output
  const build = runCommand(
    'npx next build 2>&1',
    'build-output',
    960, 640
  )

  // Lint output
  const lint = runCommand(
    'npm run lint 2>&1',
    'lint-output',
    800, 300
  )

  // Project structure
  const structure = runCommand(
    'find . -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" | head -80',
    'project-structure',
    900, 700
  )

  // Git history
  const gitlog = runCommand(
    'git log --oneline -20',
    'commit-history',
    900, 400
  )

  // Capture terminal images
  console.log('\nCapturing terminal images...')
  if (build) await captureTerminal('build-output', build.html, 960, 640)
  if (lint) await captureTerminal('lint-output', lint.html, 800, 300)
  if (structure) await captureTerminal('project-structure', structure.html, 900, 700)
  if (gitlog) await captureTerminal('commit-history', gitlog.html, 900, 400)

  console.log('\nDone!')
}

main().catch(console.error)
