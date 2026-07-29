'use strict';

const os = require('os');
const path = require('path');
const { Command, printer } = require('@axiosleo/cli-tool');
const {
  _exists,
  _is_dir,
  _mkdir,
  _copy,
  _remove
} = require('@axiosleo/cli-tool/src/helper/fs');
const { _exec } = require('@axiosleo/cli-tool/src/helper/cmd');
const {
  resolveLocalPkgDir,
  detectPackageManager,
  buildInstallCommand
} = require('../src/cli/pkg');

const PKG_NAME = '@axiosleo/koapp';
const TARGET_DIRS = {
  cursor: '.cursor/skills',
  claude: '.claude/skills'
};

function readPkgVersion(pkgDir) {
  try {
    return require(path.join(pkgDir, 'package.json')).version;
  } catch (_err) { // eslint-disable-line no-unused-vars
    return null;
  }
}

class SkillsCommand extends Command {
  constructor() {
    super({
      name: 'skills',
      desc: 'Install @axiosleo/koapp AI Skills into Cursor or Claude'
    });
    this.addOption('install', 'i', 'Target AI tool: cursor | claude', 'required');
    this.addOption('scope', 's', 'Install scope: project (default) | user', 'optional', 'project');
    this.addOption('force', 'f', 'Overwrite existing skills without prompting', 'optional', false);
    this.addOption('add-dep', 'a', `Also add ${PKG_NAME} to the project if missing`, 'optional', false);
  }

  resolveDestDir(target, scope) {
    const sub = TARGET_DIRS[target];
    if (!sub) {
      return null;
    }
    const base = scope === 'user' ? os.homedir() : process.cwd();
    return path.join(base, sub);
  }

  useRunnerAssets(state, reminder) {
    state.sourceDir = path.join(state.runnerPkgDir, 'assets/skills');
    state.usingRunner = true;
    if (reminder) {
      state.updateReminder = reminder;
      printer.warning('[skills] ' + reminder).println();
    }
    return state;
  }

  async resolveFromLocal(state, localPkgDir) {
    state.localPkgDir = localPkgDir;
    state.localVer = readPkgVersion(localPkgDir);
    const localSkills = path.join(localPkgDir, 'assets/skills');
    if (await _exists(localSkills) && await _is_dir(localSkills)) {
      state.sourceDir = localSkills;
      if (state.localVer && state.runnerVer && state.localVer !== state.runnerVer) {
        printer.warning(
          `[skills] running ${PKG_NAME}@${state.runnerVer}, local install is ${state.localVer}`
        ).println();
      } else if (state.localVer) {
        printer.info(`[skills] installing from local ${PKG_NAME}@${state.localVer}`).println();
      }
      return state;
    }
    return this.useRunnerAssets(
      state,
      `Local ${PKG_NAME}${state.localVer ? '@' + state.localVer : ''} does not ship skills assets. ` +
      `Installed from runner ${PKG_NAME}${state.runnerVer ? '@' + state.runnerVer : ''} instead. ` +
      'Please update your local dependency: npm install ' + PKG_NAME + '@latest'
    );
  }

  async resolveSourceDir(addDep = false) {
    const runnerPkgDir = path.resolve(__dirname, '..');
    const cwd = process.cwd();
    const runnerVer = readPkgVersion(runnerPkgDir);
    const pmInfo = detectPackageManager(cwd);
    const installCmd = buildInstallCommand(pmInfo.pm, PKG_NAME, {
      isWorkspaceRoot: pmInfo.isWorkspaceRoot
    });

    const state = {
      runnerPkgDir,
      runnerVer,
      localPkgDir: null,
      localVer: null,
      sourceDir: null,
      updateReminder: null,
      usingRunner: false
    };

    const localPkgDir = resolveLocalPkgDir(PKG_NAME, cwd);
    if (localPkgDir) {
      return this.resolveFromLocal(state, localPkgDir);
    }

    // Warn when cwd is inside a workspace but has no package.json of its own
    if (pmInfo.rootDir !== path.resolve(cwd) && !(await _exists(path.join(cwd, 'package.json')))) {
      printer.warning(
        `[skills] no package.json in ${cwd}; detected project root at ${pmInfo.rootDir}`
      ).println();
    }

    printer.info(`[skills] ${PKG_NAME} is not installed under ${cwd}`).println();

    if (!addDep) {
      printer.info(
        `[skills] using runner assets. To add the dependency later: ${installCmd}`
      ).println();
      return this.useRunnerAssets(state);
    }

    const shouldInstall = await this.confirm(
      `Install ${PKG_NAME} now via \`${installCmd}\`?`,
      true
    );
    if (!shouldInstall) {
      printer.info(
        `[skills] skipped install. Using runner assets. Hint: ${installCmd}`
      ).println();
      return this.useRunnerAssets(state);
    }

    try {
      await _exec(installCmd, pmInfo.rootDir);
    } catch (err) {
      const reason = err && err.message ? err.message : String(err);
      printer.error(`[skills] install failed: ${reason}`).println();
      printer.info('[skills] falling back to runner assets.').println();
      return this.useRunnerAssets(state);
    }

    const freshPkgDir = resolveLocalPkgDir(PKG_NAME, cwd);
    if (freshPkgDir) {
      return this.resolveFromLocal(state, freshPkgDir);
    }

    printer.warning(
      `[skills] ${PKG_NAME} install completed but package was not found; using runner assets.`
    ).println();
    return this.useRunnerAssets(state);
  }

  async copySkill(src, dst, force) {
    if (await _exists(dst)) {
      if (!force) {
        const overwrite = await this.confirm(
          `Skill "${path.basename(dst)}" already exists at ${dst}. Overwrite?`,
          false
        );
        if (!overwrite) {
          return false;
        }
      }
      await _remove(dst, true);
    }
    await _copy(src, dst, true);
    return true;
  }

  async installSkills(sourceDir, destDir, force) {
    await _mkdir(destDir);
    const fs = require('fs');
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    const skillDirs = entries.filter((e) => e.isDirectory());
    let installed = 0;
    let skipped = 0;
    for (const entry of skillDirs) {
      const src = path.join(sourceDir, entry.name);
      const dst = path.join(destDir, entry.name);
      const ok = await this.copySkill(src, dst, force);
      if (ok) {
        printer.success('[skills] installed: ').println(entry.name);
        installed++;
      } else {
        printer.yellow('[skills] skipped : ').println(entry.name);
        skipped++;
      }
    }
    return { installed, skipped, total: skillDirs.length };
  }

  /**
   * @param {*} args
   * @param {*} options
   */
  async exec(args, options) {
    const target = options.install;
    const scope = options.scope === 'user' ? 'user' : 'project';
    const force = options.force === true || options.force === 'true';
    const addDep = options['add-dep'] === true || options['add-dep'] === 'true';

    if (!target || !TARGET_DIRS[target]) {
      printer.error(`[skills] --install must be one of: ${Object.keys(TARGET_DIRS).join(', ')}`).println();
      return;
    }

    const destDir = this.resolveDestDir(target, scope);
    printer.info(`[skills] target : ${target} (${scope} scope)`).println();
    printer.info(`[skills] destDir: ${destDir}`).println();

    const state = await this.resolveSourceDir(addDep);
    printer.info(`[skills] source : ${state.sourceDir}`).println();

    if (!await _exists(state.sourceDir)) {
      printer.error(`[skills] source directory not found: ${state.sourceDir}`).println();
      return;
    }

    const { installed, skipped, total } = await this.installSkills(state.sourceDir, destDir, force);

    printer.println();
    printer.success(`[skills] Done. ${installed} installed, ${skipped} skipped, ${total} total.`).println();
    printer.info(`[skills] location: ${destDir}`).println();

    if (state.updateReminder) {
      printer.println();
      printer.warning('[skills] reminder: ' + state.updateReminder).println();
    }
  }
}

SkillsCommand.resolveLocalPkgDir = resolveLocalPkgDir;
SkillsCommand.detectPackageManager = detectPackageManager;
SkillsCommand.buildInstallCommand = buildInstallCommand;

module.exports = SkillsCommand;
