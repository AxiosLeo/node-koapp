'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const {
  resolveLocalPkgDir,
  detectPackageManager,
  resolveInstallTarget,
  buildInstallCommand
} = require('../src/cli/pkg');

function mkdtemp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function touch(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function makePnpmWorkspace() {
  const root = mkdtemp('koapp-skills-ws-');
  writeJson(path.join(root, 'package.json'), {
    name: 'root',
    packageManager: 'pnpm@11.10.0'
  });
  touch(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  touch(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
  return root;
}

describe('cli/pkg', () => {
  describe('detectPackageManager()', () => {
    it('detects pnpm via packageManager field at workspace root', () => {
      const root = mkdtemp('koapp-skills-pnpm-');
      writeJson(path.join(root, 'package.json'), {
        name: 'root',
        packageManager: 'pnpm@11.10.0'
      });
      touch(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n');

      const info = detectPackageManager(root);
      expect(info.pm).to.equal('pnpm');
      expect(info.rootDir).to.equal(root);
      expect(info.isWorkspaceRoot).to.equal(true);
    });

    it('detects pnpm workspace root from a member directory (the failing case)', () => {
      const root = mkdtemp('koapp-skills-member-');
      writeJson(path.join(root, 'package.json'), {
        name: 'root',
        packageManager: 'pnpm@11.10.0'
      });
      touch(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
      touch(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "apps/*"\n');
      const member = path.join(root, 'apps');
      fs.mkdirSync(member);

      const info = detectPackageManager(member);
      expect(info.pm).to.equal('pnpm');
      expect(info.rootDir).to.equal(root);
      expect(info.isWorkspaceRoot).to.equal(true);
    });

    it('detects yarn via yarn.lock', () => {
      const root = mkdtemp('koapp-skills-yarn-');
      writeJson(path.join(root, 'package.json'), { name: 'yarn-app' });
      touch(path.join(root, 'yarn.lock'), '# yarn lockfile v1\n');

      const info = detectPackageManager(root);
      expect(info.pm).to.equal('yarn');
      expect(info.rootDir).to.equal(root);
    });

    it('prefers packageManager field over lockfiles', () => {
      const root = mkdtemp('koapp-skills-pref-');
      writeJson(path.join(root, 'package.json'), {
        name: 'pref',
        packageManager: 'bun@1.0.0'
      });
      touch(path.join(root, 'package-lock.json'), '{}');

      const info = detectPackageManager(root);
      expect(info.pm).to.equal('bun');
      expect(info.rootDir).to.equal(root);
    });

    it('defaults to npm when no markers are present', () => {
      const root = mkdtemp('koapp-skills-npm-');
      writeJson(path.join(root, 'package.json'), { name: 'bare' });

      const info = detectPackageManager(root);
      expect(info.pm).to.equal('npm');
      expect(info.rootDir).to.equal(root);
      expect(info.isWorkspaceRoot).to.equal(false);
    });
  });

  describe('resolveInstallTarget()', () => {
    it('installs into a workspace member package without -w', () => {
      const root = makePnpmWorkspace();
      const member = path.join(root, 'packages', 'api');
      writeJson(path.join(member, 'package.json'), { name: 'api', version: '0.0.0' });

      const target = resolveInstallTarget(member);
      expect(target.pm).to.equal('pnpm');
      expect(target.rootDir).to.equal(root);
      expect(target.installDir).to.equal(member);
      expect(target.useWorkspaceFlag).to.equal(false);
      expect(buildInstallCommand(target.pm, '@axiosleo/koapp', {
        useWorkspaceFlag: target.useWorkspaceFlag
      })).to.equal('pnpm add @axiosleo/koapp');
    });

    it('uses -w when cwd is the workspace root', () => {
      const root = makePnpmWorkspace();

      const target = resolveInstallTarget(root);
      expect(target.installDir).to.equal(root);
      expect(target.useWorkspaceFlag).to.equal(true);
      expect(buildInstallCommand(target.pm, '@axiosleo/koapp', {
        useWorkspaceFlag: target.useWorkspaceFlag
      })).to.equal('pnpm add @axiosleo/koapp -w');
    });

    it('falls back to workspace root when cwd has no package.json', () => {
      const root = makePnpmWorkspace();
      const nested = path.join(root, 'apps');
      fs.mkdirSync(nested);

      const target = resolveInstallTarget(nested);
      expect(target.installDir).to.equal(root);
      expect(target.useWorkspaceFlag).to.equal(true);
    });

    it('resolves nearest package.json above a nested cwd', () => {
      const root = makePnpmWorkspace();
      const member = path.join(root, 'packages', 'api');
      writeJson(path.join(member, 'package.json'), { name: 'api', version: '0.0.0' });
      const nested = path.join(member, 'src');
      fs.mkdirSync(nested, { recursive: true });

      const target = resolveInstallTarget(nested);
      expect(target.installDir).to.equal(member);
      expect(target.useWorkspaceFlag).to.equal(false);
    });
  });

  describe('buildInstallCommand()', () => {
    it('builds pnpm add -w for workspace roots', () => {
      expect(buildInstallCommand('pnpm', '@axiosleo/koapp', { useWorkspaceFlag: true }))
        .to.equal('pnpm add @axiosleo/koapp -w');
    });

    it('builds pnpm add without -w for non-workspace', () => {
      expect(buildInstallCommand('pnpm', '@axiosleo/koapp', { useWorkspaceFlag: false }))
        .to.equal('pnpm add @axiosleo/koapp');
    });

    it('builds yarn / bun / npm commands', () => {
      expect(buildInstallCommand('yarn', '@axiosleo/koapp')).to.equal('yarn add @axiosleo/koapp');
      expect(buildInstallCommand('bun', '@axiosleo/koapp')).to.equal('bun add @axiosleo/koapp');
      expect(buildInstallCommand('npm', '@axiosleo/koapp')).to.equal('npm install @axiosleo/koapp');
    });
  });

  describe('resolveLocalPkgDir()', () => {
    it('resolves a package via require.resolve from a nested cwd', () => {
      // Use this repo itself: require.resolve finds @axiosleo/cli-tool from any nested dir
      const nested = path.join(__dirname, 'fixtures-skills-nested');
      fs.mkdirSync(nested, { recursive: true });
      try {
        const found = resolveLocalPkgDir('@axiosleo/cli-tool', nested);
        expect(found).to.be.a('string');
        expect(fs.existsSync(path.join(found, 'package.json'))).to.equal(true);
      } finally {
        fs.rmSync(nested, { recursive: true, force: true });
      }
    });

    it('resolves a package hoisted at an ancestor node_modules from a nested cwd', () => {
      const root = mkdtemp('koapp-skills-walk-');
      const pkgDir = path.join(root, 'node_modules', '@scope', 'pkg');
      writeJson(path.join(pkgDir, 'package.json'), { name: '@scope/pkg', version: '1.0.0' });
      const nested = path.join(root, 'apps', 'svc');
      fs.mkdirSync(nested, { recursive: true });

      // Unique scoped name so ambient installs cannot interfere.
      // realpathSync normalizes macOS /var -> /private/var from require.resolve.
      const found = resolveLocalPkgDir('@scope/pkg', nested);
      expect(fs.realpathSync(found)).to.equal(fs.realpathSync(pkgDir));
    });

    it('returns null when the package is not installed', () => {
      const root = mkdtemp('koapp-skills-miss-');
      const found = resolveLocalPkgDir('@axiosleo/definitely-not-installed-xyz', root);
      expect(found).to.equal(null);
    });
  });
});
