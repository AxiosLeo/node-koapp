'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Resolve an installed package directory reachable from `fromDir`.
 * Uses Node's own resolution (walks up to workspace roots), then falls
 * back to a manual upward walk of `node_modules/<pkgName>`.
 *
 * @param {string} pkgName
 * @param {string} fromDir
 * @returns {string|null}
 */
function resolveLocalPkgDir(pkgName, fromDir) {
  try {
    const pkgJson = require.resolve(pkgName + '/package.json', { paths: [fromDir] });
    return path.dirname(pkgJson);
  } catch (_err) { // eslint-disable-line no-unused-vars
    // MODULE_NOT_FOUND — try a manual upward walk
  }

  let dir = path.resolve(fromDir);
  const { root } = path.parse(dir);
  let searching = true;
  while (searching) {
    const candidate = path.join(dir, 'node_modules', ...pkgName.split('/'));
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
    if (dir === root) {
      searching = false;
    } else {
      dir = path.dirname(dir);
    }
  }
  return null;
}

/**
 * Read package.json from a directory, returning null on any failure.
 * @param {string} dir
 * @returns {object|null}
 */
function readPackageJson(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
    return JSON.parse(raw);
  } catch (_err) { // eslint-disable-line no-unused-vars
    return null;
  }
}

/**
 * Walk up from `fromDir` and return the nearest directory that contains
 * a package.json, or null if none is found.
 *
 * @param {string} fromDir
 * @returns {string|null}
 */
function findNearestPackageDir(fromDir) {
  let dir = path.resolve(fromDir);
  const { root } = path.parse(dir);
  let searching = true;
  while (searching) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    if (dir === root) {
      searching = false;
    } else {
      dir = path.dirname(dir);
    }
  }
  return null;
}

/**
 * Parse the `packages:` list out of a pnpm-workspace.yaml without a YAML
 * dependency. Supports both block sequences and an inline array, and stops
 * at the next top-level key.
 *
 * @param {string} filePath
 * @returns {string[]}
 */
function parsePnpmWorkspaceGlobs(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_err) { // eslint-disable-line no-unused-vars
    return [];
  }
  const unquote = (s) => s.trim().replace(/^['"]|['"]$/g, '').trim();
  const globs = [];
  const lines = raw.split(/\r?\n/);
  let inPackages = false;
  for (const line of lines) {
    if (!inPackages) {
      const inline = line.match(/^packages:\s*\[(.*)\]\s*$/);
      if (inline) {
        return inline[1].split(',').map(unquote).filter((s) => s);
      }
      if (/^packages:\s*$/.test(line)) {
        inPackages = true;
      }
      continue;
    }
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }
    const item = line.match(/^\s+-\s*(.+?)\s*$/);
    if (!item) {
      break; // next top-level key
    }
    const value = unquote(item[1]);
    if (value) {
      globs.push(value);
    }
  }
  return globs;
}

/**
 * Read the workspace globs declared by `dir`, or null when `dir` is not a
 * workspace root for `pm`.
 *
 * @param {string} dir
 * @param {string} pm
 * @returns {string[]|null}
 */
function readWorkspaceGlobs(dir, pm) {
  if (pm === 'pnpm') {
    const wsFile = path.join(dir, 'pnpm-workspace.yaml');
    if (!fs.existsSync(wsFile)) {
      return null;
    }
    const globs = parsePnpmWorkspaceGlobs(wsFile);
    // An unparseable workspace file still governs its subtree
    return globs.length ? globs : ['**'];
  }
  const pkg = readPackageJson(dir);
  const field = pkg && (pkg.workspaces || pkg.workspace);
  if (!field) {
    return null;
  }
  const globs = Array.isArray(field) ? field : field.packages;
  return Array.isArray(globs) && globs.length ? globs : ['**'];
}

/**
 * Convert a workspace glob into an anchored RegExp. Supports `*` and `**`.
 *
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        source += '.*';
        i++;
      } else {
        source += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(char)) {
      source += '\\' + char;
    } else {
      source += char;
    }
  }
  return new RegExp('^' + source + '$');
}

/**
 * Is `targetDir` governed by the workspace rooted at `rootDir`?
 * The root itself always counts.
 *
 * @param {string} rootDir
 * @param {string[]} globs
 * @param {string} targetDir
 * @returns {boolean}
 */
function isWorkspaceMember(rootDir, globs, targetDir) {
  const from = path.resolve(rootDir);
  const to = path.resolve(targetDir);
  if (from === to) {
    return true;
  }
  const rel = path.relative(from, to).split(path.sep).join('/');
  if (!rel || rel.startsWith('..')) {
    return false;
  }
  let matched = false;
  for (const glob of globs) {
    const negated = glob.startsWith('!');
    const pattern = negated ? glob.slice(1) : glob;
    if (globToRegExp(pattern).test(rel)) {
      if (negated) {
        return false;
      }
      matched = true;
    }
  }
  return matched;
}

/**
 * Collect every package-manager marker between `fromDir` and the filesystem
 * root, ordered nearest first.
 *
 * Within a single directory: a `packageManager` field wins over lockfiles,
 * then pnpm, yarn, bun, npm lockfiles.
 *
 * @param {string} fromDir
 * @returns {Array<{ dir: string, pm: string, globs: string[]|null }>}
 */
function collectPmCandidates(fromDir) {
  const candidates = [];
  let dir = path.resolve(fromDir);
  const { root } = path.parse(dir);
  let searching = true;

  while (searching) {
    let pm = null;
    const pkg = readPackageJson(dir);
    if (pkg && typeof pkg.packageManager === 'string') {
      pm = pkg.packageManager.split('@')[0].trim() || null;
    }
    if (!pm) {
      if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))
        || fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
        pm = 'pnpm';
      } else if (fs.existsSync(path.join(dir, 'yarn.lock'))) {
        pm = 'yarn';
      } else if (fs.existsSync(path.join(dir, 'bun.lockb'))
        || fs.existsSync(path.join(dir, 'bun.lock'))) {
        pm = 'bun';
      } else if (fs.existsSync(path.join(dir, 'package-lock.json'))) {
        pm = 'npm';
      }
    }
    if (pm) {
      candidates.push({ dir, pm, globs: readWorkspaceGlobs(dir, pm) });
    }

    if (dir === root) {
      searching = false;
    } else {
      dir = path.dirname(dir);
    }
  }

  return candidates;
}

/**
 * Detect the package manager and project root governing `targetDir`.
 *
 * Selection, over every marker between `fromDir` and the filesystem root:
 * 1. The outermost workspace root that lists `targetDir` as a member wins,
 *    so a stray nested lockfile cannot override the workspace's own manager.
 * 2. Otherwise the nearest marker wins, which keeps independent nested
 *    projects on their own package manager.
 *
 * Defaults to `{ pm: 'npm', rootDir: fromDir, isWorkspaceRoot: false }`.
 *
 * @param {string} fromDir
 * @param {string} [targetDir] directory the dependency would be added to
 * @returns {{ pm: string, rootDir: string, isWorkspaceRoot: boolean }}
 */
function detectPackageManager(fromDir, targetDir = fromDir) {
  const candidates = collectPmCandidates(fromDir);

  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i];
    if (candidate.globs && isWorkspaceMember(candidate.dir, candidate.globs, targetDir)) {
      return { pm: candidate.pm, rootDir: candidate.dir, isWorkspaceRoot: true };
    }
  }

  if (candidates.length) {
    const nearest = candidates[0];
    return {
      pm: nearest.pm,
      rootDir: nearest.dir,
      isWorkspaceRoot: !!nearest.globs
    };
  }

  return {
    pm: 'npm',
    rootDir: path.resolve(fromDir),
    isWorkspaceRoot: false
  };
}

/**
 * Decide where and how to add a dependency when running from `fromDir`.
 * Prefers the nearest package.json (workspace member) over the monorepo root,
 * so `pnpm add -w` is only used when installing into the workspace root itself.
 *
 * @param {string} fromDir
 * @returns {{
 *   pm: string,
 *   rootDir: string,
 *   installDir: string,
 *   useWorkspaceFlag: boolean
 * }}
 */
function resolveInstallTarget(fromDir) {
  const nearestPkg = findNearestPackageDir(fromDir);
  const pmInfo = detectPackageManager(fromDir, nearestPkg || fromDir);
  const installDir = nearestPkg || pmInfo.rootDir;
  const useWorkspaceFlag =
    pmInfo.isWorkspaceRoot
    && path.resolve(installDir) === path.resolve(pmInfo.rootDir);

  return {
    pm: pmInfo.pm,
    rootDir: pmInfo.rootDir,
    installDir,
    useWorkspaceFlag
  };
}

/**
 * Build the shell command used to add a dependency.
 *
 * @param {string} pm
 * @param {string} pkgName
 * @param {{ useWorkspaceFlag?: boolean, isWorkspaceRoot?: boolean }} [opts]
 * @returns {string}
 */
function buildInstallCommand(pm, pkgName, opts = {}) {
  // isWorkspaceRoot kept as a deprecated alias of useWorkspaceFlag
  const useWorkspaceFlag = opts.useWorkspaceFlag === true
    || opts.isWorkspaceRoot === true;
  switch (pm) {
    case 'pnpm':
      return useWorkspaceFlag
        ? `pnpm add ${pkgName} -w`
        : `pnpm add ${pkgName}`;
    case 'yarn':
      return `yarn add ${pkgName}`;
    case 'bun':
      return `bun add ${pkgName}`;
    case 'npm':
    default:
      return `npm install ${pkgName}`;
  }
}

module.exports = {
  resolveLocalPkgDir,
  findNearestPackageDir,
  detectPackageManager,
  resolveInstallTarget,
  buildInstallCommand
};
