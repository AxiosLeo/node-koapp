'use strict';

const path = require('path');
const { _search, _write, _mkdir, _move, _sync } = require('@axiosleo/cli-tool/src/helper/fs');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { _render_with_file } = require('@axiosleo/cli-tool/src/helper/str');

const ASSETS_ROOT = path.join(__dirname, '../../assets');

/**
 * Ordered template catalog. The first entry is the interactive default:
 * cli-tool's select prompt highlights index 0 for object choices.
 */
const TEMPLATES = [
  {
    id: 'simple-ts',
    dir: 'simple/ts',
    message: 'Simple TypeScript app (default)'
  },
  {
    id: 'simple-js',
    dir: 'simple/js',
    message: 'Simple JavaScript app'
  },
  {
    id: 'monorepo',
    dir: 'monorepo',
    message: 'Full monorepo project'
  }
];

const DEFAULT_TEMPLATE = TEMPLATES[0].id;

/**
 * Choices for `Command#select`. `name` is the value returned to the caller.
 * @returns {{ name: string, message: string }[]}
 */
function templateChoices() {
  return TEMPLATES.map((item) => ({
    name: item.id,
    message: item.message
  }));
}

/**
 * @param {string} template
 * @returns {{ id: string, dir: string, message: string }|null}
 */
function findTemplate(template) {
  for (let i = 0; i < TEMPLATES.length; i++) {
    if (TEMPLATES[i].id === template) {
      return TEMPLATES[i];
    }
  }
  return null;
}

/**
 * Absolute directory of `*.tmpl` files for a template id.
 * @param {string} template
 * @returns {string}
 */
function resolveTemplateDir(template) {
  const found = findTemplate(template);
  if (!found) {
    const ids = TEMPLATES.map((item) => item.id).join(', ');
    throw new Error(`Unknown template "${template}". Choose one of: ${ids}`);
  }
  return path.join(ASSETS_ROOT, found.dir);
}

/**
 * Render every `*.tmpl` file under `tmplDir` into `outDir`.
 * `${name}` is substituted; the `.tmpl` suffix is stripped.
 * @param {string} tmplDir
 * @param {string} outDir
 * @param {{ name: string }} params
 */
async function renderTemplates(tmplDir, outDir, params) {
  const files = await _search(tmplDir, 'tmpl');
  await _foreach(files, async (file) => {
    const relative = path.relative(tmplDir, file).replace(/\.tmpl$/, '');
    const dest = path.join(outDir, relative);
    const content = await _render_with_file(file, params);
    await _write(dest, content);
  });
}

/**
 * Write a project from a template and copy the bundled koapp skills.
 * `_sync` is called with reback disabled so the package's `assets/skills`
 * is never overwritten from the generated tree.
 *
 * @param {{ template: string, name: string, dir: string }} options
 */
async function scaffold(options) {
  const tmplDir = resolveTemplateDir(options.template);
  await _mkdir(options.dir);
  await renderTemplates(tmplDir, options.dir, { name: options.name });
  if (options.template === 'monorepo') {
    await _move(
      path.join(options.dir, 'bin/monoapp.js'),
      path.join(options.dir, 'bin', `${options.name}.js`)
    );
  }
  await _sync(
    path.join(ASSETS_ROOT, 'skills'),
    path.join(options.dir, '.agents/skills'),
    '*',
    false
  );
}

module.exports = {
  TEMPLATES,
  DEFAULT_TEMPLATE,
  templateChoices,
  resolveTemplateDir,
  renderTemplates,
  scaffold
};
