'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const {
  TEMPLATES,
  DEFAULT_TEMPLATE,
  templateChoices,
  resolveTemplateDir,
  scaffold
} = require('../src/cli/scaffold');

const APP_NAME = 'demo-app';

function walk(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    if (entry.name === '.agents' || entry.name === 'node_modules') {
      return;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
      return;
    }
    acc.push(full);
  });
  return acc;
}

describe('cli/scaffold', function () {
  this.timeout(10000);

  const roots = [];

  after(() => {
    roots.forEach((dir) => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  function outputDir(template) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `koapp-scaffold-${template}-`));
    roots.push(dir);
    return path.join(dir, APP_NAME);
  }

  it('lists simple-ts first as the default template', () => {
    expect(DEFAULT_TEMPLATE).to.equal('simple-ts');
    expect(TEMPLATES.map((item) => item.id)).to.deep.equal([
      'simple-ts',
      'simple-js',
      'monorepo'
    ]);
    expect(templateChoices()[0]).to.deep.equal({
      name: 'simple-ts',
      message: 'Simple TypeScript app (default)'
    });
  });

  it('rejects an unknown template before writing files', () => {
    expect(() => resolveTemplateDir('nope')).to.throw(/Unknown template/);
  });

  it('renders the simple TypeScript app without a database', async () => {
    const dir = outputDir('simple-ts');
    await scaffold({ template: 'simple-ts', name: APP_NAME, dir });

    expect(fs.existsSync(path.join(dir, 'package.json'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, 'tsconfig.json'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, 'src/bootstrap.ts'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, 'src/routes/example.router.ts'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, '.agents/skills/koapp/SKILL.md'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, 'bin/monoapp.js'))).to.equal(false);

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg.name).to.equal(APP_NAME);
    expect(pkg.dependencies).to.not.have.property('better-sqlite3');

    const app = fs.readFileSync(path.join(dir, 'src/app.ts'), 'utf8');
    expect(app).to.include(`app_id: '${APP_NAME}'`);
    assertNoPlaceholders(dir);
    assertNoDatabase(dir);
  });

  it('renders the simple JavaScript app without a compile step', async () => {
    const dir = outputDir('simple-js');
    await scaffold({ template: 'simple-js', name: APP_NAME, dir });

    expect(fs.existsSync(path.join(dir, 'src/bootstrap.js'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, 'src/routes/example.router.js'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, 'tsconfig.json'))).to.equal(false);
    expect(fs.existsSync(path.join(dir, '.agents/skills/koapp/SKILL.md'))).to.equal(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(pkg.name).to.equal(APP_NAME);
    expect(pkg.scripts.start).to.equal('node src/bootstrap.js');
    expect(pkg.dependencies).to.not.have.property('better-sqlite3');
    assertNoPlaceholders(dir);
    assertNoDatabase(dir);
  });

  it('renders the monorepo and renames the cli entry', async () => {
    const dir = outputDir('monorepo');
    await scaffold({ template: 'monorepo', name: APP_NAME, dir });

    expect(fs.existsSync(path.join(dir, 'bin', `${APP_NAME}.js`))).to.equal(true);
    expect(fs.existsSync(path.join(dir, 'bin/monoapp.js'))).to.equal(false);
    expect(fs.existsSync(path.join(dir, 'apps/services/src/services/sqlite.ts'))).to.equal(true);
    expect(fs.existsSync(path.join(dir, '.agents/skills/koapp-router/SKILL.md'))).to.equal(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'apps/services/package.json'), 'utf8'));
    expect(pkg.name).to.equal(`${APP_NAME}-services`);
    expect(pkg.dependencies).to.have.property('better-sqlite3');

    const bin = fs.readFileSync(path.join(dir, 'bin', `${APP_NAME}.js`), 'utf8');
    expect(bin).to.include(`name: '${APP_NAME}'`);
    assertNoPlaceholders(dir);
  });
});

function assertNoPlaceholders(dir) {
  const files = walk(dir, []);
  expect(files.length).to.be.greaterThan(0);
  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');
    expect(content, file).to.not.include('${name}');
  });
}

function assertNoDatabase(dir) {
  const joined = walk(dir, []).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  expect(joined).to.not.include('better-sqlite3');
  expect(joined).to.not.include('sqlite');
  expect(joined).to.not.match(/\bcluster\b/);
}
