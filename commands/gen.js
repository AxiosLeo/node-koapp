'use strict';

const { Command, printer } = require('@axiosleo/cli-tool');

/**
 * import more features
 * @import const { Workflow } = require('@axiosleo/cli-tool');
 * @import const { Configuration } = require('@axiosleo/cli-tool');
 * @import const { helper: { fs, cmd, is, obj, str } } = require('@axiosleo/cli-tool');
 * @import const { debug } = require('@axiosleo/cli-tool');
 * @import const { locales } = require('@axiosleo/cli-tool');
 */
class GenCommand extends Command {
  constructor() {
    super({
      name: 'gen',
      desc: ''
    });
    // this.addArgument('name', 'desc', 'required', null);
    // this.addOption('name', 'n', 'desc', 'required', null);
  }
  async exec(args, options, argList, app) {
    printer.println('this is gen command');
  }
}

module.exports = GenCommand;
