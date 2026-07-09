// Cut a Web Store release in two phases.
//
//   npm run release            bump version → build → zip → "Release vX" commit → tag vX
//   npm run release:publish    push main + tag → GitHub release with the zip attached
//   npm run release -- --zip-only   just bump/build/zip (no git), the legacy behavior
//
// Versioning (since v1.2.1): each component counts 0–9 and carries into the
// next — 1.2.8 → 1.2.9 → 1.3.0 → 1.3.1 … 1.9.9 → 2.0.0. Not semver; the
// version is a simple odometer so the Web Store number stays short.
//
// The split keeps the remote, irreversible steps (push, gh release) behind an
// explicit second command so the release commit can be reviewed first. Always
// package through this script — it guarantees the zip version increases, so the
// Web Store never rejects an upload for a non-incremented version.
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const zipOnly = args.includes('--zip-only');
const publish = args.includes('--publish');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const readVersion = () => JSON.parse(readFileSync('package.json', 'utf8')).version;

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// Odometer bump: every component counts 0–9, carrying into the next.
function bumpVersion(version) {
  let [maj, min, pat] = version.split('.').map(Number);
  pat += 1;
  if (pat > 9) {
    pat = 0;
    min += 1;
  }
  if (min > 9) {
    min = 0;
    maj += 1;
  }
  return `${maj}.${min}.${pat}`;
}

// The given version's section: everything between its "## [X.Y.Z]" heading and
// the next "## [" heading (or EOF), trimmed. Null if the heading is missing.
function changelogSection(version) {
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const escaped = version.replaceAll('.', '\\.');
  const m = changelog.match(
    new RegExp(
      `^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|$(?![\\s\\S]))`,
      'm',
    ),
  );
  return m ? m[1].trim() : null;
}

// ---- Phase 2: publish (push + GitHub release) --------------------------------

if (publish) {
  const version = readVersion();
  const tag = `v${version}`;
  const zip = `release/pdf-mana-${version}.zip`;

  if (!git('tag', '-l', tag))
    fail(`tag ${tag} does not exist — run "npm run release" first`);
  if (!existsSync(zip)) fail(`${zip} not found — run "npm run release" first`);
  const notes = changelogSection(version);
  if (!notes) fail(`CHANGELOG.md has no "## [${version}]" section`);
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  } catch {
    fail('gh is not authenticated — run "gh auth login"');
  }
  let exists = false;
  try {
    execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' });
    exists = true;
  } catch {
    // not found — good
  }
  if (exists) fail(`GitHub release ${tag} already exists`);

  // Push before gh release create so gh finds the tag on the remote
  // (--verify-tag then guarantees it never invents one).
  console.log(`→ pushing main + ${tag}`);
  execFileSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', tag], { stdio: 'inherit' });
  console.log(`→ creating GitHub release ${tag}`);
  execFileSync(
    'gh',
    ['release', 'create', tag, zip, '--title', tag, '--verify-tag', '--notes-file', '-'],
    { stdio: ['pipe', 'inherit', 'inherit'], input: notes },
  );
  console.log(`\n✓ published ${tag} — now upload ${zip} to the Web Store dashboard`);
  process.exit(0);
}

// ---- Phase 1: cut the release -------------------------------------------------

if (!zipOnly) {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main') fail(`releases are cut from main (currently on "${branch}")`);

  const next = bumpVersion(readVersion());
  if (!changelogSection(next)) {
    fail(`CHANGELOG.md has no "## [${next}]" section — write the changelog entry first`);
  }
  if (git('tag', '-l', `v${next}`)) fail(`tag v${next} already exists`);

  const releaseFiles = ['package.json', 'package-lock.json', 'CHANGELOG.md'];
  const dirty = git('status', '--porcelain')
    .split('\n')
    .filter((l) => l && !releaseFiles.includes(l.slice(3)));
  if (dirty.length) {
    console.warn(
      `⚠ uncommitted changes NOT included in the release commit:\n  ${dirty.join('\n  ')}`,
    );
  }
  console.log('ℹ if UI changed since the last release, run "npm run visual" first');
}

execSync(`npm version ${bumpVersion(readVersion())} --no-git-tag-version`, {
  stdio: 'inherit',
});
const version = readVersion();

console.log(`\n→ building v${version}`);
execSync('npm run build', { stdio: 'inherit' });

mkdirSync('release', { recursive: true });
const zip = `pdf-mana-${version}.zip`;
execSync(`zip -qr ../release/${zip} . -x '*.DS_Store'`, {
  cwd: 'dist',
  stdio: 'inherit',
});
console.log(`\n✓ release/${zip}`);

if (!zipOnly) {
  // Pathspec form so nothing outside these three files is swept into the
  // commit (unstaged edits to them ARE included — the CHANGELOG entry is
  // the point).
  execFileSync(
    'git',
    [
      'commit',
      '-m',
      `Release v${version}`,
      '--',
      'package.json',
      'package-lock.json',
      'CHANGELOG.md',
    ],
    { stdio: 'inherit' },
  );
  execFileSync('git', ['tag', '-a', `v${version}`, '-m', `Release v${version}`], {
    stdio: 'inherit',
  });
  console.log(`\n✓ committed + tagged v${version}`);
  console.log('  review the commit, then: npm run release:publish');
}
