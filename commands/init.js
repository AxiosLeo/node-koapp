/* eslint-disable no-unused-vars */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { _search, _write, _mkdir, _exists, _move, _sync } = require('@axiosleo/cli-tool/src/helper/fs');
const { _foreach, _exec } = require('@axiosleo/cli-tool/src/helper/cmd');
const { Command, printer, debug } = require('@axiosleo/cli-tool');
const { _render_with_file } = require('@axiosleo/cli-tool/src/helper/str');

function hasPnpm() {
  const result = spawnSync('pnpm', ['--version'], {
    encoding: 'utf8',
    shell: true
  });
  return result.status === 0;
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

    if (!hasPnpm()) {
      printer.warning('pnpm is required but not found');
      if (await this.confirm('install pnpm?', true)) {
        printer.info('running: npm install -g pnpm');
        await _exec('npm install -g pnpm', dir);
      } else {
        printer.info('Please run: npm install -g pnpm');
        process.exit(0);
      }
    }

    if (await this.confirm('install dependencies?', true)) {
      await _exec('pnpm install', dir);
    }

    if (await this.confirm('start services right now?')) {
      await _exec('pnpm dev', dir);
    }
  }
}

module.exports = InitCommand;
