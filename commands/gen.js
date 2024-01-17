'use strict';

const os = require('os');
const path = require('path');
const { Command, printer } = require('@axiosleo/cli-tool');
const { _select_multi, _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { Emitter, _snake_case } = require('@axiosleo/cli-tool/src/helper/str');
const { _write, _exists, _read_json, _search, _read } = require('@axiosleo/cli-tool/src/helper/fs');
const { compile } = require('json-schema-to-typescript');
const is = require('@axiosleo/cli-tool/src/helper/is');

class GenTsCommand extends Command {
  constructor() {
    super({
      name: 'generate',
      desc: '',
      alias: ['gen']
    });
    this.addArgument('meta', 'The meta info of the file to generate', 'optional', './meta/');
    this.addOption('dir', 'd', 'The modules directory where the file is generated', 'optional', process.cwd());
  }

  /**
   * @param {*} args 
   * @param {*} options 
   * @param {string[]} argList 
   * @param {import('@axiosleo/cli-tool').App} app 
   */
  async exec(args, options) {
    const methodsOption = ['Find', 'Page', 'Load', 'Create', 'Update', 'Patch', 'Delete', 'BatchCreate', 'BatchUpdate', 'BatchDelete'];
    const methods = await _select_multi('Please select the methods to generate', methodsOption, methodsOption);
    if (await is.file(path.join(process.cwd(), args.meta))) {
      await this.generateFile({
        metaFile: args.meta,
        targetDir: path.resolve(options.dir),
        methods
      });
    } else {
      const files = await _search(path.join(process.cwd(), args.meta), 'json');
      await _foreach(files.map((f) => {
        return { metaFile: f, targetDir: path.resolve(options.dir), methods };
      }), this.generateFile);
    }
  }

  async generateFile(options) {
    const methods = options.methods;
    const emitter = new Emitter();
    emitter.emitln('import { KoaContext, Router, success, error, failed } from \'@axiosleo/koapp\';');
    emitter.emitln('import { QueryHandler } from \'@axiosleo/orm-mysql\';');
    emitter.emitln('import { _mysql } from \'@/services/db\';');
    emitter.emitln('import { helper } from \'@axiosleo/cli-tool\';').emitln();
    emitter.emitln('const { _foreach } = helper.cmd;');
    emitter.emitln();

    let meta = null;
    let filePath = null;
    let name = null;
    if (options.metaFile) {
      const schema = await _read_json(options.metaFile);
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
      name = _snake_case(schema.title);
      filePath = path.join(options.targetDir, `${name}.ts`);
      meta = {
        table: name,
        properties: Object.keys(schema.properties).map(p => _snake_case(p))
      };
      emitter.emitln(interfaceName);
    } else {
      name = path.basename(options.metaFile);
      filePath = path.join(options.targetDir, name, 'index.ts');
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
          emitter.emitln('root.new(\'/{:id}/{:field_name}\', {', 'begin');
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
          emitter.emitln('const ids = context.body || [];', true);
          if (meta) {
            emitter.emitRows(
              'const conn = _mysql();',
              'const handler = new QueryHandler(conn);',
              'await _foreach(ids, async (id: number) => {',
              emitter.config.indent + `await handler.table('${meta.table}').where('id', id).delete();`,
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

    const routesFile = path.join(options.targetDir, 'index.ts');
    if (await _exists(routesFile)) {
      printer.yellow('generate file on ').println(filePath);
      let content = await _read(routesFile);
      let rows = content.split(os.EOL);
      const existRoute = rows.find((r) => r.indexOf(`root.add(${name})`) > -1);
      if (!existRoute) {
        rows.splice(1, 0, `import ${name} from './${name}';`);
        rows.splice(rows.length - 2, 0, `root.add(${name});`);
        await _write(routesFile, rows.join(os.EOL));
      }
    }
  }
}

module.exports = GenTsCommand;
