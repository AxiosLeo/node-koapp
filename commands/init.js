'use strict';

const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { Command, printer } = require('@axiosleo/cli-tool');
const {
  DEFAULT_PNPM_PIN,
  readPnpmPin,
  corepackEnv,
  isCorepackLoadError,
  globalInstallCommand
} = require('../src/cli/pnpm');
const {
  TEMPLATES,
  templateChoices,
  scaffold
} = require('../src/cli/scaffold');

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
    this.addOption('template', 't', 'Project template: simple-ts (default) | simple-js | monorepo', 'optional', null);
  }

  /**
   * @param {*} args
   * @param {*} options
   */
  async exec(args, options) {
    const name = args.name;
    const ids = TEMPLATES.map((item) => item.id);
    let template = options.template;
    if (!template) {
      // Object choices ignore select()'s default argument; index 0 (simple-ts) is highlighted.
      template = await this.select('Choose a template', templateChoices());
    } else if (ids.indexOf(template) === -1) {
      printer.error(`Unknown template "${template}". Choose one of: ${ids.join(', ')}`);
      return;
    }

    printer.info(`Will initialize ${name} application (${template})`);

    const dir = path.join(options.dir, name + '/');
    printer.info(`Output dir: ${dir}`);
    printer.info('Initializing...');
    await scaffold({ template, name, dir });

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
