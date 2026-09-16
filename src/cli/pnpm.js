'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_PNPM_PIN = '10.33.4';
const NPMMIRROR = 'https://registry.npmmirror.com';

/**
 * Parse a Corepack `packageManager` field into a pnpm version pin.
 * @param {unknown} packageManager
 * @returns {string|null}
 */
function parsePnpmPin(packageManager) {
  if (typeof packageManager !== 'string') {
    return null;
  }
  const match = packageManager.trim().match(/^pnpm@(.+)$/);
  return match ? match[1] : null;
}

/**
 * Read `packageManager` from `dir/package.json` and return the pnpm pin.
 * @param {string} dir
 * @returns {string|null}
 */
function readPnpmPin(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    return parsePnpmPin(pkg && pkg.packageManager);
  } catch (_err) { // eslint-disable-line no-unused-vars
    return null;
  }
}

/**
 * Env for Corepack-backed `pnpm` during `koapp init`.
 * Skips the extra download prompt and uses the same registry as the template `.npmrc`.
 * An existing `COREPACK_NPM_REGISTRY` on the caller is left intact.
 *
 * @param {NodeJS.ProcessEnv} [baseEnv]
 * @returns {NodeJS.ProcessEnv}
 */
function corepackEnv(baseEnv = process.env) {
  return {
    ...baseEnv,
    COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
    COREPACK_NPM_REGISTRY: baseEnv.COREPACK_NPM_REGISTRY || NPMMIRROR
  };
}

/**
 * @param {unknown} output
 * @returns {boolean}
 */
function isCorepackLoadError(output) {
  return String(output || '').includes('ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING');
}

/**
 * @param {string} pin
 * @returns {string}
 */
function globalInstallCommand(pin) {
  return `npm install -g pnpm@${pin}`;
}

module.exports = {
  DEFAULT_PNPM_PIN,
  NPMMIRROR,
  parsePnpmPin,
  readPnpmPin,
  corepackEnv,
  isCorepackLoadError,
  globalInstallCommand
};
