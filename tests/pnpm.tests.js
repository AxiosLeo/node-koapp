'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const {
  DEFAULT_PNPM_PIN,
  NPMMIRROR,
  parsePnpmPin,
  readPnpmPin,
  corepackEnv,
  isCorepackLoadError,
  globalInstallCommand
} = require('../src/cli/pnpm');

function mkdtemp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('cli/pnpm', () => {
  describe('parsePnpmPin()', () => {
    it('reads a pnpm@version field', () => {
      expect(parsePnpmPin('pnpm@10.33.4')).to.equal('10.33.4');
    });

    it('keeps a hash suffix after the version', () => {
      expect(parsePnpmPin('pnpm@10.33.4+sha512.abc')).to.equal('10.33.4+sha512.abc');
    });

    it('returns null for other package managers or empty values', () => {
      expect(parsePnpmPin('yarn@4.1.0')).to.equal(null);
      expect(parsePnpmPin('pnpm')).to.equal(null);
      expect(parsePnpmPin('')).to.equal(null);
      expect(parsePnpmPin(null)).to.equal(null);
      expect(parsePnpmPin(undefined)).to.equal(null);
    });
  });

  describe('readPnpmPin()', () => {
    it('matches the monorepo template pin', () => {
      const tmpl = fs.readFileSync(
        path.join(__dirname, '../assets/monorepo/package.json.tmpl'),
        'utf8'
      );
      expect(tmpl).to.include(`"packageManager": "pnpm@${DEFAULT_PNPM_PIN}"`);
      expect(tmpl).to.include('"pnpm": ">=10"');
    });

    it('reads packageManager from package.json', () => {
      const dir = mkdtemp('koapp-pnpm-pin-');
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
        name: 'demo',
        packageManager: 'pnpm@10.33.4'
      }));
      expect(readPnpmPin(dir)).to.equal('10.33.4');
    });

    it('returns null when package.json is missing', () => {
      const dir = mkdtemp('koapp-pnpm-missing-');
      expect(readPnpmPin(dir)).to.equal(null);
    });
  });

  describe('corepackEnv()', () => {
    it('skips the Corepack download prompt and uses npmmirror by default', () => {
      const env = corepackEnv({ PATH: '/usr/bin', HOME: '/tmp' });
      expect(env.COREPACK_ENABLE_DOWNLOAD_PROMPT).to.equal('0');
      expect(env.COREPACK_NPM_REGISTRY).to.equal(NPMMIRROR);
      expect(env.PATH).to.equal('/usr/bin');
    });

    it('does not override an existing COREPACK_NPM_REGISTRY', () => {
      const env = corepackEnv({ COREPACK_NPM_REGISTRY: 'https://registry.npmjs.org' });
      expect(env.COREPACK_NPM_REGISTRY).to.equal('https://registry.npmjs.org');
      expect(env.COREPACK_ENABLE_DOWNLOAD_PROMPT).to.equal('0');
    });
  });

  describe('isCorepackLoadError()', () => {
    it('detects the Node/Corepack VM import failure from the screenshot', () => {
      const stderr = [
        'node:internal/modules/esm/utils:231',
        '  throw new ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING();',
        "TypeError [ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING]: A dynamic import callback was not specified."
      ].join('\n');
      expect(isCorepackLoadError(stderr)).to.equal(true);
    });

    it('returns false for unrelated output', () => {
      expect(isCorepackLoadError('command not found: pnpm')).to.equal(false);
      expect(isCorepackLoadError('')).to.equal(false);
      expect(isCorepackLoadError(null)).to.equal(false);
    });
  });

  describe('globalInstallCommand()', () => {
    it('pins the requested version instead of npm latest', () => {
      expect(globalInstallCommand('10.33.4')).to.equal('npm install -g pnpm@10.33.4');
      expect(globalInstallCommand(DEFAULT_PNPM_PIN)).to.equal('npm install -g pnpm@10.33.4');
    });
  });
});
