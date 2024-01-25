'use strict';

const fs = require('fs');
const { Command, printer } = require('@axiosleo/cli-tool');
const { error, Router, KoaApplication, result } = require('../');
const path = require('path');
const promisify = require('util').promisify;
const readdir = promisify(fs.readdir);
const { _exists, _is_file, _read, _is_dir } = require('@axiosleo/cli-tool/src/helper/fs');
const { _fixed } = require('@axiosleo/cli-tool/src/helper/str');

class HttpCommand extends Command {
  constructor() {
    super({
      name: 'http',
      desc: 'Start a http server quickly',
    });
    this.addArgument('dir', 'Static diractory', 'optional', process.cwd());
    this.addOption('port', 'p', 'Port', 'optional', 80);
  }

  async list(dir) {
    if (!await _exists(dir)) {
      return [];
    }
    if (!await _is_dir(dir)) {
      throw new Error('Only support dir path');
    }
    const tmp = await readdir(dir);
    let files = [];
    await Promise.all(tmp.map(async (filename) => {
      let filepath = path.join(dir, filename);
      let is_dir = await _is_dir(filepath);
      files.push({ filename, is_dir, filepath });
    }));
    return files;
  }

  /**
   * @param {*} args 
   * @param {*} options 
   * @param {string[]} argList 
   * @param {import('@axiosleo/cli-tool').App} app 
   */
  async exec(args, options) {
    printer.yellow('listening on ').green(`${options.port}`).println(' port');
    let dir = path.resolve(args.dir);
    const router = new Router('/***', {
      method: 'any',
      handlers: [async (context) => {
        let d = path.join(dir, context.url);
        printer.yellow(_fixed('[' + context.method + ']', 12, 'r')).green(context.url).println();
        if (!await _exists(d)) {
          error(404, 'Not Found');
        }
        if (await _is_file(d)) {
          let c = await _read(d);
          let tmp = context.url.split('/');
          result(c, 200, {
            'Content-disposition': 'attachment; filename=' + tmp[tmp.length - 1]
          });
        }
        let htmlContent = `<ul><li><a href="${path.join(context.url, '../')}">../</a></li>`;
        let files = await this.list(d);
        files.forEach(f => {
          let u = context.url.endsWith('/') ? context.url : context.url + '/';
          htmlContent += `<li><a href="${u + f.filename}">${f.filename}</a></li>`;
        });
        htmlContent += '</ul>';
        result(htmlContent, 200, { 'Content-Type': 'text/html' });
      }],
    });

    const app = new KoaApplication({
      port: parseInt(options.port),
      listen_host: '0.0.0.0',
      routers: [router],
      static: {
        rootDir: path.resolve(args.dir),
        index: 'index.html'
      }
    });
    app.start();
  }
}

module.exports = HttpCommand;