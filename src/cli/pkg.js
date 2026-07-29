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
 * @param {string} dir
 * @param {string} pm
 * @returns {boolean}
 */
function isWorkspaceRoot(dir, pm) {
  if (pm === 'pnpm') {
    return fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'));
  }
  if (pm === 'yarn' || pm === 'npm' || pm === 'bun') {
    const pkg = readPackageJson(dir);
    return !!(pkg && (pkg.workspaces || pkg.workspace));
  }
  return false;
}

/**
 * Detect the package manager and project root for `fromDir`.
 *
 * Precedence while walking upward:
 * 1. `packageManager` field in package.json (name@version prefix)
 * 2. pnpm-lock.yaml / pnpm-workspace.yaml
 * 3. yarn.lock
 * 4. bun.lockb / bun.lock
 * 5. package-lock.json
 *
 * Defaults to `{ pm: 'npm', rootDir: fromDir, isWorkspaceRoot: false }`.
 *
 * @param {string} fromDir
 * @returns {{ pm: string, rootDir: string, isWorkspaceRoot: boolean }}
 */
function detectPackageManager(fromDir) {
  let dir = path.resolve(fromDir);
  const { root } = path.parse(dir);
  let searching = true;

  while (searching) {
    const pkg = readPackageJson(dir);
    if (pkg && typeof pkg.packageManager === 'string') {
      const pm = pkg.packageManager.split('@')[0].trim();
      if (pm) {
        return {
          pm,
          rootDir: dir,
          isWorkspaceRoot: isWorkspaceRoot(dir, pm)
        };
      }
    }

    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))
      || fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return { pm: 'pnpm', rootDir: dir, isWorkspaceRoot: isWorkspaceRoot(dir, 'pnpm') };
    }
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) {
      return { pm: 'yarn', rootDir: dir, isWorkspaceRoot: isWorkspaceRoot(dir, 'yarn') };
    }
    if (fs.existsSync(path.join(dir, 'bun.lockb'))
      || fs.existsSync(path.join(dir, 'bun.lock'))) {
      return { pm: 'bun', rootDir: dir, isWorkspaceRoot: isWorkspaceRoot(dir, 'bun') };
    }
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) {
      return { pm: 'npm', rootDir: dir, isWorkspaceRoot: isWorkspaceRoot(dir, 'npm') };
    }

    if (dir === root) {
      searching = false;
    } else {
      dir = path.dirname(dir);
    }
  }

  return {
    pm: 'npm',
    rootDir: path.resolve(fromDir),
    isWorkspaceRoot: false
  };
}

/**
 * Build the shell command used to add a dependency.
 *
 * @param {string} pm
 * @param {string} pkgName
 * @param {{ isWorkspaceRoot?: boolean }} [opts]
 * @returns {string}
 */
function buildInstallCommand(pm, pkgName, opts = {}) {
  const { isWorkspaceRoot: workspaceRoot = false } = opts;
  switch (pm) {
    case 'pnpm':
      return workspaceRoot
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
  detectPackageManager,
  buildInstallCommand
};
