/* eslint-disable no-unused-vars */
'use strict';

const path = require('path');
const { _search, _write, _mkdir } = require('@axiosleo/cli-tool/src/helper/fs');
const { _foreach, _exec } = require('@axiosleo/cli-tool/src/helper/cmd');
const { Command, printer, debug } = require('@axiosleo/cli-tool');
const { _render_with_file } = require('@axiosleo/cli-tool/src/helper/str');

class InitCommand extends Command {
  constructor() {
    super({
      name: 'init',
      desc: ''
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

    const tmplDir = path.join(__dirname, '../assets/tmpl/');
    const files = await _search(tmplDir, 'tmpl');

    await _foreach(files, async (file) => {
      let f = file.substring(0, file.length - 5);
      f = f.replace(tmplDir, '');
      f = path.join(dir, f);
      let c = await _render_with_file(file, { name });
      await _write(f, c);
    });
    printer.success('Initialized successfully');
    debug.log({ dir });
    if (!await this.confirm('install dependencies?', true)) {
      return;
    }
    await _exec('npm install', dir);
    if (!await this.confirm('start services right now?', true)) {
      return;
    }
    await _exec('npm run dev:services', dir);
  }
}

module.exports = InitCommand;
