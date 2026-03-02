/**
 * Bumps the patch version in src/constants/buildInfo.ts
 * Run before every `eas update` to get a fresh build version.
 *
 * Usage:  node scripts/stamp-build.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'constants', 'buildInfo.ts');
const current = fs.readFileSync(file, 'utf-8');

const match = current.match(/v(\d+)\.(\d+)\.(\d+)/);
if (!match) {
  console.error('Could not parse current version');
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]) + 1;
const version = `v${major}.${minor}.${patch}`;

const content = `// Auto-generated — do not edit manually\n// Run: node scripts/stamp-build.js\nexport const BUILD_VERSION = '${version}';\n`;

fs.writeFileSync(file, content, 'utf-8');
console.log(`Version bumped: ${version}`);
