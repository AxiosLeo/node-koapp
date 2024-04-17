'use strict';

const path = require('path');
// eslint-disable-next-line no-unused-vars
const { Command, printer, debug } = require('@axiosleo/cli-tool');
const {
  // _select_multi,
  _foreach
} = require('@axiosleo/cli-tool/src/helper/cmd');
const { Emitter, _snake_case, _upper_first, _caml_case } = require('@axiosleo/cli-tool/src/helper/str');
const { _write, _exists, _read_json, _search, _read } = require('@axiosleo/cli-tool/src/helper/fs');
const is = require('@axiosleo/cli-tool/src/helper/is');
const { _deep_clone } = require('@axiosleo/cli-tool/src/helper/obj');

class GenTsCommand extends Command {
  constructor() {
    super({
      name: 'generate',
      desc: 'Generate ts files from json schema files',
      alias: ['gen']
    });
    this.addArgument('name', 'Specify module name', 'optional');
    this.addOption('meta_dir', 'd', 'The koapp project directory. the project is generate by koapp-cli', 'optional', process.cwd());
    this.addOption('output', 'o', 'The output directory', 'optional', process.cwd());
  }

  /**
   * @param {{name:string}} args 
   * @param {dir:string} options 
   * @param {string[]} argList 
   * @param {import('@axiosleo/cli-tool').App} app 
   */
  async exec(args, options) {
    const methodsOption = ['Find', 'Page', 'Load', 'Create', 'Update', 'Patch', 'Delete', 'BatchCreate', 'BatchUpdate', 'BatchDelete'];
    let methods = [];
    if (args.name) {
      // methods = await _select_multi('Please select the methods to generate', methodsOption, methodsOption);
      methods = methodsOption;
      await this.generate({
        methods, schema: {
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          '$id': 'https://example.com/product.schema.json',
          'title': _caml_case(args.name),
          'description': '',
          'type': 'object',
          'properties': {},
          'required': []
        },
        targetDir: options.meta_dir,
        subDir: 'services/src/modules/',
        genFiles: ['model', 'controller', 'router']
      });
      return;
    }
    let metaDir = path.resolve(options.meta_dir);
    const outputDir = path.resolve(options.output);
    if (!await _exists(metaDir)) {
      printer.println().error('The meta directory must be exists. [' + metaDir + ']');
      return;
    }
    if (await is.file(metaDir)) {
      printer.println().error('The meta argument must be a directory');
      return;
    }
    let files = await _search(metaDir, 'json');
    if (!files.length) {
      printer.println().error('No json schema files found in the meta directory : ' + metaDir);
      return;
    }
    // methods = await _select_multi('Please select the methods to generate', methodsOption, methodsOption);
    methods = methodsOption;
    files = files.map((f) => {
      let genFiles = f.endsWith('.schema.json') ? ['model', 'controller', 'router'] : ['model'];
      return { metaFile: f, targetDir: outputDir, methods, genFiles };
    });
    if (!files.length) {
      return;
    }
    await _foreach(files, async (config) => {
      config.schema = await _read_json(config.metaFile);
      await this.generate(config);
    });
  }

  async generate(config) {
    const { methods, targetDir, genFiles, schema } = config;
    let name = null;
    let title = '';
    let reqSchema = null;
    let modelSchema = null;
    if (!schema.title) {
      throw new Error('Must be set title for schema');
    }
    title = schema.title.split(' ').map(c => _upper_first(c)).join('');
    // 去掉每个字段的 title 属性
    Object.keys(schema.properties).forEach((p) => {
      if (schema.properties[p].title) {
        let desc = `${schema.properties[p].title};${schema.properties[p].description || ''}`;
        delete schema.properties[p].title;
        schema.properties[p].description = desc;
      }
    });
    name = _snake_case(title);
    schema.fields = Object.keys(schema.properties).map(p => _snake_case(p));
    reqSchema = schema;
    modelSchema = _deep_clone(schema);
    // 为 modelSchema 增加 id, created_by, updated_by, created_at, updated_at 字段
    modelSchema.properties = {
      ...modelSchema.properties,
      id: {
        type: 'integer'
      },
      created_by: {
        type: 'integer'
      },
      updated_by: {
        type: 'integer'
      },
      created_at: {
        type: 'string',
        format: 'date-time'
      },
      updated_at: {
        type: 'string',
        format: 'date-time'
      },
      deleted_at: {
        type: 'string',
        format: 'date-time'
      }
    };
    modelSchema.required.push('id');

    const context = {
      name, // snake case
      title, // camel case
      methods, // array
      reqSchema,
      modelSchema,
      targetDir
    };

    await _foreach(genFiles, async (f) => {
      switch (f) {
        case 'model':
          await this.generateModel(context);
          break;
        case 'controller':
          await this.generateController(context);
          break;
        case 'router': {
          await this.generateRouter(context);
          const routesFile = path.join(targetDir, 'index.ts');
          if (!await _exists(routesFile)) {
            return;
          }
          let content = await _read(routesFile);
          let rows = content.split('\n');
          const existRoute = rows.find((r) => r.indexOf(`root.add(${name})`) > -1);
          if (!existRoute) {
            rows.splice(1, 0, `import ${name} from './${name}.router';`);
            rows.splice(rows.length - 2, 0, `root.add(${name});`);
            await _write(routesFile, rows.join('\n'));
          }
          break;
        }
        default:
          throw new Error('Invalid type for generate file ' + f);
      }
    });
  }

  async generateModel(context) {
    const { name, reqSchema, modelSchema, title } = context;
    const emitter = new Emitter();
    emitter.emitln('import { FromSchema } from \'json-schema-to-ts\';').emitln();
    emitter.emitln(`const ${title}ItemSchema = ${JSON.stringify(reqSchema, null, 2)} as const;`);
    emitter.emitln(`export type ${title}Item = FromSchema<typeof ${title}ItemSchema>;`);

    emitter.emitln(`const ${title}ModelSchema = ${JSON.stringify(modelSchema, null, 2)} as const;`);
    emitter.emitln(`export type ${title}Model = FromSchema<typeof ${title}ModelSchema>;`);

    await _write(path.join(context.targetDir, `${name}.model.ts`), emitter.output());
  }

  async generateController(context) {
    const { name, title, methods } = context;
    const filePath = path.join(context.targetDir, `${name}.controller.ts`);
    if (await _exists(filePath)) {
      printer.yellow('The file already exists: ').println(`${name}.controller.ts`);
      return;
    }
    const emitter = new Emitter();
    emitter.emitln('import { success, error, failed } from \'@axiosleo/koapp\';');
    emitter.emitln('import { helper } from \'@axiosleo/cli-tool\';');
    emitter.emitln('import { BaseController } from \'./controller\';');
    emitter.emitln('const { _foreach } = helper.cmd;').emitln();
    emitter.emitln(`import { ${title}Item, ${title}Model } from './${name}.model';`);

    emitter.emitln(`class ${title} extends BaseController {`, 'open');
    let isBegin = true;
    methods.forEach((method) => {
      let m = `generate${method}Method`;
      if (this[m]) {
        if (!isBegin) {
          emitter.emitln();
        }
        this[m].call(this, context, emitter);
        if (isBegin) {
          isBegin = false;
        }
      }
    });
    emitter.emitln('}', 'close').emitln();
    emitter.emitln(`export default new ${title}();`);

    await _write(filePath, emitter.output());
  }

  async generateRouter(context) {
    const { name, methods } = context;
    const emitter = new Emitter();
    emitter.emitln('import { KoaContext, Router } from \'@axiosleo/koapp\';');
    emitter.emitln(`import controller from './${name}.controller';`);
    emitter.emitln();

    emitter.emitln(`const root = new Router('/${name}');`).emitln();
    let isBegin = true;
    methods.forEach((method) => {
      let m = `generate${method}Router`;
      if (this[m]) {
        if (!isBegin) {
          emitter.emitln();
        }
        this[m].call(this, context, emitter);
        if (isBegin) {
          isBegin = false;
        }
      }
    });

    emitter.emitln().emitln('export default root;');

    await _write(path.join(context.targetDir, `${name}.router.ts`), emitter.output());
  }

  generateFindMethod(context, emitter) {
    const { name } = context;
    emitter.emitln('async find(id: number) {', 'begin');
    emitter.emitln(`const item = await this.mainDB.table('${name}').where('id', id).find();`, true);
    emitter.emitln('if (!item) {', 'begin');
    emitter.emitln('error(404, \'Not Found\');', true);
    emitter.emitln('}', 'end');
    emitter.emitln('success(item);', true);
    emitter.emitln('}', 'end');
  }

  generatePageMethod(context, emitter) {
    emitter.emitln('async page(page: number, size: number, fields?: string[]) {', 'begin');
    emitter.emitRows(
      `const query = this.mainDB.table('${context.name}');`,
      'if (fields) {',
      emitter.config.indent + 'query.attr(...fields);',
      '}',
      'const items = await query.page(size, size * (page - 1)).select();',
      'success(items);'
    );
    emitter.emitln('}', 'end');
  }

  generateLoadMethod(context, emitter) {
    emitter.emitln('async load(last_id: number, order: \'asc\' | \'desc\', fields?: string[]) {', 'begin');
    emitter.emitRows(
      `const query = this.mainDB.table('${context.name}');`,
      'if (fields) {',
      emitter.config.indent + 'query.attr(...fields);',
      '}',
      'const items = await query.where(\'id\', last_id, \'<\').orderBy(\'id\', order).select();',
      'success(items);'
    );
    emitter.emitln('}', 'end');
  }

  generateCreateMethod(context, emitter) {
    const { title } = context;
    emitter.emitln(`async create(data: ${title}Item) {`, 'begin');
    emitter.emitRows(
      `const res = await this.mainDB.table('${context.name}').insert(data);`,
      'res.insertId ? success() : failed(data, \'500;Create Failed\');'
    );
    emitter.emitln('}', 'end');
  }

  generateUpdateMethod(context, emitter) {
    const { title } = context;
    emitter.emitln(`async update(id: number, data: ${title}Item) {`, 'begin');
    emitter.emitRows(
      `const res = await this.mainDB.table('${context.name}').where('id', id).update(data);`,
      'res.affectedRows || res.changedRows ? success() : failed(data, \'500;Update Failed\');'
    );
    emitter.emitln('}', 'end');
  }

  generatePatchMethod(context, emitter) {
    emitter.emitln('async patch(id: number, field_name: string, value: any) {', 'begin');
    emitter.emitRows(
      `const res = await this.mainDB.table('${context.name}').where('id', id).update({ [field_name]: value });`,
      'res.affectedRows || res.changedRows ? success() : failed({ id, field_name, value }, \'500;Update Failed\');'
    );
    emitter.emitln('}', 'end');
  }

  generateDeleteMethod(context, emitter) {
    emitter.emitln('async delete(id: number) {', 'begin');
    emitter.emitRows(
      `const res = await this.mainDB.table('${context.name}').where('id', id).delete();`,
      'res.affectedRows ? success() : failed({}, \'500;Delete Failed\');'
    );
    emitter.emitln('}', 'end');
  }

  generateBatchCreateMethod(context, emitter) {
    const { title } = context;
    emitter.emitln(`async batchCreate(data: ${title}Item[]) {`, 'begin');
    emitter.emitRows(
      `await _foreach(data, async (item: ${title}Item) => {`,
      emitter.config.indent + `await this.mainDB.table('${context.name}').insert(item);`,
      '});'
    );
    emitter.emitln('success({});', true);
    emitter.emitln('}', 'end');
  }

  generateBatchUpdateMethod(context, emitter) {
    const { title } = context;
    emitter.emitln(`async batchUpdate(data: ${title}Model[]) {`, 'begin');
    emitter.emitRows(
      `await _foreach(data, async (item: ${title}Model) => {`,
      emitter.config.indent + `await this.mainDB.table('${context.name}').where('id', item.id).update(item);`,
      '});'
    );
    emitter.emitln('success({});', true);
    emitter.emitln('}', 'end');
  }

  generateBatchDeleteMethod(context, emitter) {
    emitter.emitln('async batchDelete(ids: number[]) {', 'begin');
    emitter.emitRows(
      'await _foreach(ids, async (id: number) => {',
      emitter.config.indent + `await this.mainDB.table('${context.name}').where('id', id).delete();`,
      '});'
    );
    emitter.emitln('success({});', true);
    emitter.emitln('}', 'end');
  }

  generateFindRouter(context, emitter) {
    emitter.emitln('root.new(\'/{:id}\', {', 'begin');
    emitter.emitln('method: \'get\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const id = parseInt(context.params.id || \'0\');', true);
    emitter.emitln('await controller.find(id);', true);
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generatePageRouter(context, emitter) {
    emitter.emitln('root.new(\'/page/{:page}\', {', 'begin');
    emitter.emitln('method: \'get\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const body = context.body || {};', true);
    emitter.emitRows(
      'const size = body.size || 10;',
      'const page = parseInt(context.params.page) || 1;',
      'await controller.page(page, size, body.fields);'
    );
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generateLoadRouter(context, emitter) {
    emitter.emitln('root.new(\'/list/{:last_id}\', {', 'begin');
    emitter.emitln('method: \'get\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const body = context.body || {};', true);
    emitter.emitRows(
      'const order = context.query.order || \'desc\';',
      'const last_id = parseInt(context.params.last_id) || 0;',
      'await controller.load(last_id, order, body.fields);'
    );
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generateCreateRouter(context, emitter) {
    emitter.emitln('root.new(\'/create\', {', 'begin');
    emitter.emitln('method: \'post\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const body = context.body || {};', true);
    emitter.emitln('await controller.create(body);', true);
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generateUpdateRouter(context, emitter) {
    emitter.emitln('root.new(\'/{:id}\', {', 'begin');
    emitter.emitln('method: \'put\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const id = parseInt(context.params.id || \'0\');', true);
    emitter.emitln('const body = context.body || {};', true);
    emitter.emitln('await controller.update(id, body);', true);
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generatePatchRouter(context, emitter) {
    emitter.emitln('root.new(\'/{:id}/{:field_name}\', {', 'begin');
    emitter.emitln('method: \'patch\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const id = parseInt(context.params.id || \'0\');', true);
    emitter.emitln('const field_name = context.params.field_name;', true);
    emitter.emitln('const body = context.body || {};', true);
    emitter.emitln('const value = body.value || undefined;', true);
    emitter.emitln('await controller.patch(id, field_name, value);', true);
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generateDeleteRouter(context, emitter) {
    emitter.emitln('root.new(\'/{:id}\', {', 'begin');
    emitter.emitln('method: \'delete\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const id = parseInt(context.params.id || \'0\');', true);
    emitter.emitln('await controller.delete(id);', true);
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generateBatchCreateRouter(context, emitter) {
    emitter.emitln('root.new(\'/batch/create\', {', 'begin');
    emitter.emitln('method: \'post\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const body = context.body || [];', true);
    emitter.emitln('await controller.batchCreate(body);', true);
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generateBatchUpdateRouter(context, emitter) {
    emitter.emitln('root.new(\'/batch/update\', {', 'begin');
    emitter.emitln('method: \'put\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const body = context.body || [];', true);
    emitter.emitln('await controller.batchUpdate(body);', true);
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }

  generateBatchDeleteRouter(context, emitter) {
    emitter.emitln('root.new(\'/batch/delete\', {', 'begin');
    emitter.emitln('method: \'delete\',', true);
    emitter.emitln('handlers: [async (context: KoaContext) => {', 'begin');
    emitter.emitln('const ids = context.body || [];', true);
    emitter.emitln('await controller.batchDelete(ids);', true);
    emitter.emitln('}]', 'end');
    emitter.emitln('});', 'end');
  }
}

module.exports = GenTsCommand;
