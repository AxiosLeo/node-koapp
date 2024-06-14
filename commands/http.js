'use strict';

const fs = require('fs');
const { Command, printer } = require('@axiosleo/cli-tool');
const { error, Router, KoaApplication, result } = require('../');
const path = require('path');
const promisify = require('util').promisify;
const readdir = promisify(fs.readdir);
const {
  _exists,
  _is_file,
  _is_dir,
  _ext
} = require('@axiosleo/cli-tool/src/helper/fs');
const { _fixed } = require('@axiosleo/cli-tool/src/helper/str');

const mimeTypes = {
  'css': 'text/css',
  'gif': 'image/gif',
  'html': 'text/html',
  'ico': 'image/x-icon',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'js': 'text/javascript',
  'json': 'application/json',
  'pdf': 'application/pdf',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'swf': 'application/x-shockwave-flash',
  'tiff': 'image/tiff',
  'txt': 'text/plain',
  'wav': 'audio/x-wav',
  'wma': 'audio/x-ms-wma',
  'wmv': 'video/x-ms-wmv',
  'xml': 'text/xml'
};

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
   */
  async exec(args, options) {
    let dir = path.resolve(args.dir);
    const router = new Router('/***', {
      method: 'any',
      handlers: [async (context) => {
        const url = new URL(context.url, 'http://localhost');
        let d = path.join(dir, url.pathname);
        printer.yellow(_fixed('[' + context.method + ']', 12, 'r')).green(context.url).println();
        if (!await _exists(d)) {
          error(404, 'Not Found');
        }
        if (await _is_file(d)) {
          const extname = _ext(d);
          context.koa.type = extname;
          if (mimeTypes[extname]) {
            context.koa.headers['Content-Type'] = mimeTypes[extname];
          } else {
            let tmp = context.url.split('/');
            context.koa.headers['Content-disposition'] = 'attachment; filename=' + tmp[tmp.length - 1];
          }
          context.koa.headers['Content-Type'] = mimeTypes[extname];
          const stream = fs.createReadStream(d);
          context.koa.body = stream;
          return;
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
