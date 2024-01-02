'use strict';

const path = require('path');
const { Command, printer, debug } = require('@axiosleo/cli-tool');
const { _select_multi, _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { Emitter, _snake_case } = require('@axiosleo/cli-tool/src/helper/str');
const { _write, _exists, _read_json } = require('@axiosleo/cli-tool/src/helper/fs');
const { compile } = require('json-schema-to-typescript');

/**
 * import more features
 * @import const { Workflow } = require('@axiosleo/cli-tool');
 * @import const { Configuration } = require('@axiosleo/cli-tool');
 * @import const { helper: { fs, cmd, is, obj, str } } = require('@axiosleo/cli-tool');
 * @import const { debug } = require('@axiosleo/cli-tool');
 * @import const { locales } = require('@axiosleo/cli-tool');
 */
class GenTsCommand extends Command {
  constructor() {
    super({
      name: 'generate',
      desc: '',
      alias: ['gen']
    });
    this.addOption('meta', null, 'The meta info of the file to generate', 'optional', './meta.json');
    this.addOption('module', 'm', 'The module name of the file to generate', 'optional', 'index');
    this.addOption('dir', 'd', 'The directory where the file is generated', 'optional', process.cwd());
  }

  /**
   * @param {*} args 
   * @param {*} options 
   * @param {string[]} argList 
   * @param {import('@axiosleo/cli-tool').App} app 
   */
  async exec(_, options) {
    const name = await this.ask('Please enter the name of the file to generate', options.module);
    let fileName = name === 'index' ? `${name}.ts` : `${name}/index.ts`;
    const filePath = path.join(options.dir, fileName);
    printer.info(`generate ${fileName}`);

    if (!await this.confirm('Do you want to continue?', true)) {
      printer.error('canceled');
      return;
    }

    const methodsOption = ['Find', 'Page', 'Load', 'Create', 'Update', 'Patch', 'Delete', 'BatchCreate', 'BatchUpdate', 'BatchDelete'];
    const methods = await _select_multi('Please select the methods to generate', methodsOption, methodsOption);

    const emitter = new Emitter();
    emitter.emitln('import { KoaContext, Router, success, error, failed } from \'@axiosleo/koapp\';');
    emitter.emitln('import { QueryHandler } from \'@axiosleo/orm-mysql\';');
    emitter.emitln('import { _mysql } from \'@/services/db\';');
    emitter.emitln('import { helper } from \'@axiosleo/cli-tool\';').emitln();
    emitter.emitln('const { _foreach } = helper.cmd;');
    emitter.emitln();

    let meta = null;
    if (options.meta && await _exists(path.join(process.cwd(), options.meta))) {
      const schema = await _read_json(path.join(process.cwd(), options.meta));
      debug.log(schema, name);
      const interfaceName = await compile(schema, name, {
        bannerComment: '',
        style: {
          bracketSpacing: false,
          printWidth: 120,
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'none',
          useTabs: false,
        },
      });
      meta = {
        table: _snake_case(schema.title),
        properties: Object.keys(schema.properties).map(p => _snake_case(p))
      };
      emitter.emitln(interfaceName).emitln();
    }

    emitter.emitln(`const root = new Router('/${name}');`).emitln();

    await _foreach(methods, async (method) => {
      switch (method) {
        case 'Find': {
          emitter.emitln('root.new(\'/{:id}\', {', 'begin');
          emitter.emitln('method: \'get\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const id = parseInt(context.params.id || \'0\');', true);
          if (meta !== null) {
            emitter.emitln('const conn = _mysql();', true);
            emitter.emitln('const handler = new QueryHandler(conn);', true);
            emitter.emitln(`const item = await handler.table('${meta.table}').where('id', id).find();`, true);
            emitter.emitln('if (!item) {', 'up');
            emitter.emitln('error(404, \'Not Found\');', true);
            emitter.emitln('}', 'down');
            emitter.emitln('success(item);', true);
          } else {
            emitter.emitln('success({});', true);
          }
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'Page': {
          emitter.emitln('root.new(\'/page/{:page}\', {', 'begin');
          emitter.emitln('method: \'get\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const body = context.body || {};', true);
          if (meta !== null) {
            emitter.emitRows(
              'const size = body.size || 10;',
              'const page = parseInt(context.params.page) || 1;',
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              `const query = handler.table('${meta.table}');`,
              'if (body.fields) {',
              emitter.config.indent + 'query.attr(...body.fields);',
              '}',
              'const items = await query.page(size, size * (page - 1)).select();',
              'success(items);'
            );
          } else {
            emitter.emitln('success([]);', true);
          }
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'Load': {
          emitter.emitln('root.new(\'/list/{:last_id}\', {', 'begin');
          emitter.emitln('method: \'get\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const body = context.body || {};', true);
          if (meta) {
            emitter.emitRows(
              'const order = context.query.order || \'desc\';',
              'const last_id = parseInt(context.params.last_id) || 0;',
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              `const query = handler.table('${meta.table}');`,
              'if (body.fields) {',
              emitter.config.indent + 'query.attr(...body.fields);',
              '}',
              'if (order === \'desc\') {',
              emitter.config.indent + 'query.orderBy(\'id\', \'desc\');',
              emitter.config.indent + 'query.where(\'id\', last_id, \'<\');',
              '} else {',
              emitter.config.indent + 'query.orderBy(\'id\', \'asc\');',
              emitter.config.indent + 'query.where(\'id\', last_id, \'>\');',
              '}',
              'const items = await query.select();',
              'success(items);'
            );
          } else {
            emitter.emitln('success([]);', true);
          }
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'Create': {
          emitter.emitln('root.new(\'/create\', {', 'begin');
          emitter.emitln('method: \'post\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const body = context.body || {};', true);
          if (meta) {
            emitter.emitRows(
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              `const res = await handler.table('${meta.table}').insert(body);`,
              'res.insertId ? success() : failed(body, \'500;Create Failed\');'
            );
          } else {
            emitter.emitln('success();', true);
          }
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'Update': {
          emitter.emitln('root.new(\'/{:id}\', {', 'begin');
          emitter.emitln('method: \'put\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const id = parseInt(context.params.id || \'0\');', true);
          emitter.emitln('const body = context.body || {};', true);
          if (meta) {
            emitter.emitRows(
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              `const res = await handler.table('${meta.table}').where('id', id).update(body);`,
              'res.affectedRows || res.changedRows ? success() : failed(body, \'500;Update Failed\');'
            );
          } else {
            emitter.emitln('success();', true);
          }
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'Patch': {
          emitter.emitln('root.new(\'/{:id}/{:field_name}/{:value}\', {', 'begin');
          emitter.emitln('method: \'patch\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const id = parseInt(context.params.id || \'0\');', true);
          emitter.emitln('const field_name = context.params.field_name;', true);
          emitter.emitln('const body = context.body || {};', true);
          emitter.emitln('const value = body.value || undefined;', true);
          if (meta) {
            emitter.emitRows(
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              `const res = await handler.table('${meta.table}').where('id', id).update({ [field_name]: value });`,
              'res.affectedRows || res.changedRows ? success() : failed(body, \'500;Update Failed\');'
            );
          } else {
            emitter.emitln('success();', true);
          }
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'Delete': {
          emitter.emitln('root.new(\'/{:id}\', {', 'begin');
          emitter.emitln('method: \'delete\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const id = parseInt(context.params.id || \'0\');', true);
          if (meta) {
            emitter.emitRows(
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              `const res = await handler.table('${meta.table}').where('id', id).delete();`,
              'res.affectedRows ? success() : failed({}, \'500;Delete Failed\');'
            );
          } else {
            emitter.emitln('success();', true);
          }
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'BatchCreate': {
          emitter.emitln('root.new(\'/batch/create\', {', 'begin');
          emitter.emitln('method: \'post\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const body = context.body || [];', true);
          if (meta) {
            emitter.emitRows(
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              'await _foreach(body, async (item: Product) => {',
              emitter.config.indent + `await handler.table('${meta.table}').insert(item);`,
              '});'
            );
          }
          emitter.emitln('success({});', true);
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'BatchUpdate': {
          emitter.emitln('root.new(\'/batch/update\', {', 'begin');
          emitter.emitln('method: \'put\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const body = context.body || [];', true);
          if (meta) {
            emitter.emitRows(
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              'await _foreach(body, async (item: Product) => {',
              emitter.config.indent + `await handler.table('${meta.table}').where('id', item.id).update(item);`,
              '});'
            );
          }
          emitter.emitln('success({});', true);
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        case 'BatchDelete': {
          emitter.emitln('root.new(\'/batch/delete\', {', 'begin');
          emitter.emitln('method: \'delete\',', true);
          emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
          emitter.emitln('const body = context.body || [];', true);
          if (meta) {
            emitter.emitRows(
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              'await _foreach(body, async (item: Product) => {',
              emitter.config.indent + `await handler.table('${meta.table}').where('id', item.id).delete();`,
              '});'
            );
          }
          emitter.emitln('success({});', true);
          emitter.emitln('}]', 'end');
          emitter.emitln('});', 'end');
          break;
        }
        default:
          break;
      }
      emitter.emitln();
    });

    emitter.emitln('export default root;');
    await _write(filePath, emitter.output());
  }
}

module.exports = GenTsCommand;
