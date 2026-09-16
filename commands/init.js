'use strict';

const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { _search, _write, _mkdir, _move, _sync } = require('@axiosleo/cli-tool/src/helper/fs');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { Command, printer } = require('@axiosleo/cli-tool');
const { _render_with_file } = require('@axiosleo/cli-tool/src/helper/str');
const {
  DEFAULT_PNPM_PIN,
  readPnpmPin,
  corepackEnv,
  isCorepackLoadError,
  globalInstallCommand
} = require('../src/cli/pnpm');

function probePnpm(dir, env) {
  return spawnSync('pnpm', ['--version'], {
    cwd: dir,
    encoding: 'utf8',
    shell: true,
    env
  });
}

function probeOutput(result) {
  const errMsg = result.error && result.error.message ? result.error.message : '';
  return `${result.stderr || ''}${result.stdout || ''}${errMsg}`;
}

function runCommand(command, dir, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: dir,
      shell: true,
      stdio: 'inherit',
      env
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`The command "${command}" exited with code "${code}"`));
      }
    });
  });
}

function printPnpmRecovery(dir) {
  printer.info('The scaffold is already written. To run pnpm later:');
  printer.info('  npm install -g corepack@latest && corepack enable');
  printer.info('  # or switch to Node 22+ / 24 (see .nvmrc)');
  printer.info(`  cd ${dir} && pnpm install`);
}

class InitCommand extends Command {
  constructor() {
    super({
      name: 'init',
      desc: 'Initialize a new application'
    });
    this.addArgument('name', 'Application name', 'required');
    this.addOption('dir', 'd', 'output dir', 'optional', process.cwd());
  }

  /**
   * @param {*} args
   * @param {*} options
   */
  async exec(args, options) {
    let name = args.name;

    printer.info(`Will initialize ${name} application`);

    let dir = path.join(options.dir, name + '/');
    printer.info(`Output dir: ${dir}`);
    printer.info('Initializing...');
    await _mkdir(dir);

    const tmplDir = path.join(__dirname, '../assets/monorepo/');
    const files = await _search(tmplDir, 'tmpl');

    await _foreach(files, async (file) => {
      let f = file.substring(0, file.length - 5);
      f = f.replace(tmplDir, '');
      f = path.join(dir, f);
      let c = await _render_with_file(file, { name });
      await _write(f, c);
    });

    await _move(path.join(dir, 'bin/monoapp.js'), path.join(dir, `bin/${name}.js`));
    await _sync(path.join(__dirname, '../assets/skills'), path.join(dir, '.agents/skills'));

    printer.success('Initialized successfully');

    const pin = readPnpmPin(dir) || DEFAULT_PNPM_PIN;
    const env = corepackEnv(process.env);
    const installHint = globalInstallCommand(pin);
    let probe = probePnpm(dir, env);

    if (probe.status !== 0) {
      const output = probeOutput(probe);
      if (isCorepackLoadError(output)) {
        printer.error('pnpm failed to run (Corepack could not load the pinned version).');
        printPnpmRecovery(dir);
        return;
      }
      printer.warning('pnpm is required but not found');
      if (await this.confirm('install pnpm?', true)) {
        printer.info(`running: ${installHint}`);
        try {
          await runCommand(installHint, dir, env);
        } catch (err) {
          printer.error(err && err.message ? err.message : String(err));
          printPnpmRecovery(dir);
          return;
        }
        probe = probePnpm(dir, env);
        if (probe.status !== 0) {
          printer.error('pnpm is still not usable after install.');
          printPnpmRecovery(dir);
          return;
        }
      } else {
        printer.info(`Please run: ${installHint}`);
        printer.info(`Then: cd ${dir} && pnpm install`);
        return;
      }
    }

    if (await this.confirm('install dependencies?', true)) {
      try {
        await runCommand('pnpm install', dir, env);
      } catch (err) {
        printer.error(err && err.message ? err.message : String(err));
        printPnpmRecovery(dir);
        return;
      }
    }

    if (await this.confirm('start services right now?')) {
      try {
        await runCommand('pnpm dev', dir, env);
      } catch (err) {
        printer.error(err && err.message ? err.message : String(err));
        printPnpmRecovery(dir);
      }
    }
  }
}

module.exports = InitCommand;
