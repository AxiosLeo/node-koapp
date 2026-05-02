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
  }

  resolveDestDir(target, scope) {
    const sub = TARGET_DIRS[target];
    if (!sub) {
      return null;
    }
    const base = scope === 'user' ? os.homedir() : process.cwd();
    return path.join(base, sub);
  }

  async resolveSourceDir() {
    const runnerPkgDir = path.resolve(__dirname, '..');
    const localPkgDir = path.join(process.cwd(), 'node_modules', ...PKG_NAME.split('/'));

    const runnerVer = readPkgVersion(runnerPkgDir);
    const state = {
      runnerPkgDir,
      runnerVer,
      localPkgDir,
      localVer: null,
      sourceDir: null,
      updateReminder: null,
      usingRunner: false
    };

    const localExists = await _exists(localPkgDir);
    if (localExists) {
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
      // local install exists but lacks skills assets
      state.sourceDir = path.join(runnerPkgDir, 'assets/skills');
      state.usingRunner = true;
      state.updateReminder =
        `Local ${PKG_NAME}${state.localVer ? '@' + state.localVer : ''} does not ship skills assets. ` +
        `Installed from runner ${PKG_NAME}${state.runnerVer ? '@' + state.runnerVer : ''} instead. ` +
        'Please update your local dependency: npm install ' + PKG_NAME + '@latest';
      printer.warning('[skills] ' + state.updateReminder).println();
      return state;
    }

    printer.warning(`[skills] ${PKG_NAME} is not installed in ${process.cwd()}`).println();
    const shouldInstall = await this.confirm(
      `Install ${PKG_NAME} now? (required for consistent skill content)`,
      true
    );
    if (!shouldInstall) {
      printer.info(`[skills] aborted. Run \`npm install ${PKG_NAME}\` and retry.`).println();
      return null;
    }
    await _exec(`npm install ${PKG_NAME}`, process.cwd());

    if (await _exists(localPkgDir)) {
      state.localVer = readPkgVersion(localPkgDir);
      const localSkills = path.join(localPkgDir, 'assets/skills');
      if (await _exists(localSkills) && await _is_dir(localSkills)) {
        state.sourceDir = localSkills;
        return state;
      }
      state.sourceDir = path.join(runnerPkgDir, 'assets/skills');
      state.usingRunner = true;
      state.updateReminder =
        `Freshly installed ${PKG_NAME}${state.localVer ? '@' + state.localVer : ''} lacks skills assets. ` +
        'Using runner assets. Please upgrade: npm install ' + PKG_NAME + '@latest';
      printer.warning('[skills] ' + state.updateReminder).println();
      return state;
    }
    printer.error(`[skills] ${PKG_NAME} install appears to have failed.`).println();
    return null;
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

    if (!target || !TARGET_DIRS[target]) {
      printer.error(`[skills] --install must be one of: ${Object.keys(TARGET_DIRS).join(', ')}`).println();
      return;
    }

    const destDir = this.resolveDestDir(target, scope);
    printer.info(`[skills] target : ${target} (${scope} scope)`).println();
    printer.info(`[skills] destDir: ${destDir}`).println();

    const state = await this.resolveSourceDir();
    if (!state) {
      return;
    }
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

module.exports = SkillsCommand;
