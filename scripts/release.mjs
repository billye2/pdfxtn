// Cut a Web Store release: bump the patch version, build, and package a
// version-named zip. Run: npm run release  → release/pdf-mana-<version>.zip
//
// Always use this to (re)package — it guarantees the zip version increases, so
// the Web Store never rejects an upload for a non-incremented version.
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

execSync('npm version patch --no-git-tag-version', { stdio: 'inherit' });
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

console.log(`\n→ building v${version}`);
execSync('npm run build', { stdio: 'inherit' });

mkdirSync('release', { recursive: true });
const zip = `pdf-mana-${version}.zip`;
execSync(`zip -qr ../release/${zip} . -x '*.DS_Store'`, { cwd: 'dist', stdio: 'inherit' });
console.log(`\n✓ release/${zip}`);
