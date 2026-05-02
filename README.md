# @axiosleo/koapp

[![NPM version](https://img.shields.io/npm/v/@axiosleo/koapp.svg?style=flat-square)](https://npmjs.org/package/@axiosleo/koapp)
[![npm download](https://img.shields.io/npm/dm/@axiosleo/koapp.svg?style=flat-square)](https://npmjs.org/package/@axiosleo/koapp)
[![CI Build Status](https://github.com/AxiosLeo/node-koapp/actions/workflows/ci.yml/badge.svg)](https://github.com/AxiosLeo/node-koapp/actions/workflows/ci.yml)
[![](https://codecov.io/gh/AxiosLeo/node-koapp/branch/master/graph/badge.svg)](https://codecov.io/gh/AxiosLeo/node-koapp)
[![License](https://img.shields.io/github/license/AxiosLeo/node-koapp?color=%234bc524)](LICENSE)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-koapp.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-koapp/refs/branch/master)

> A framework designed for rapid web application development with Node.js
>
> Built on [Koa](https://koajs.com/)

```bash
npm install @axiosleo/koapp
```

## Initialization

```bash
npx @axiosleo/koapp init <app-name> -d <optional-dir>

# Show help information
# npx @axiosleo/koapp init -h
```

## Quick Start

```javascript
const { KoaApplication, Router, success } = require("@axiosleo/koapp");

const handle = async (ctx) => {
  success({
    message: "Hello World!",
  });
};

const router = new Router("/test", {
  method: "any",
  handlers: [handle],
});

const app = new KoaApplication({
  port: 8088,
  listen_host: "localhost", // Use 0.0.0.0 for public access
  routers: [router],
});
app.start();

// Open http://localhost:8088/test
```

## AI Skills

`@axiosleo/koapp` ships a bundle of AI Agent Skills so tools like Cursor and
Claude Code can generate framework-correct code for you. Each skill is a
self-contained `SKILL.md` with YAML frontmatter, bundled under
`node_modules/@axiosleo/koapp/assets/skills/` after installation.

### Install into a project

```bash
# After: npm install @axiosleo/koapp
npx @axiosleo/koapp skills --install=cursor
npx @axiosleo/koapp skills --install=claude
```

This copies the skills into `./.cursor/skills/` or `./.claude/skills/` in the
current project, making them visible to the matching AI tool.

### Install for the current user

```bash
npx @axiosleo/koapp skills --install=cursor --scope=user
npx @axiosleo/koapp skills --install=claude --scope=user
```

Writes to `~/.cursor/skills/` or `~/.claude/skills/`, shared across every
project on this machine.

### Options

| Flag | Values | Default | Description |
| --- | --- | --- | --- |
| `--install`, `-i` | `cursor`, `claude` | required | Which tool's skills directory to target |
| `--scope`, `-s` | `project`, `user` | `project` | Where to write the skills |
| `--force`, `-f` | boolean | `false` | Overwrite existing skill directories without prompting |

### Bundled skills

| Skill | Purpose |
| --- | --- |
| `koapp` | Framework overview + navigation to other skills |
| `koapp-apps` | Choose and configure `KoaApplication` (HTTP), `SocketApplication` (TCP), or `WebSocketApplication` |
| `koapp-router` | Define routes, path params, validators, nested routers |
| `koapp-response` | Send responses via `success` / `failed` / `result` / `response` / `error` |
| `koapp-controller` | Organize handlers into classes by extending `Controller` |
| `koapp-model` | Validate and serialize structured data with `Model` |
| `koapp-sse` | Stream Server-Sent Events with `KoaSSEMiddleware` |

### How the installer picks the source

1. If `@axiosleo/koapp` is installed in the current project, skills are
   copied from `node_modules/@axiosleo/koapp/assets/skills/`.
2. If the project does not depend on `@axiosleo/koapp`, the CLI prompts to
   install it first.
3. If the local install is an older version without the skills assets, the
   CLI falls back to the skills shipped inside the `npx`-executed copy and
   reminds you to run `npm install @axiosleo/koapp@latest`.

### Uninstall

```bash
rm -rf ./.cursor/skills/koapp*    # or ./.claude/skills/koapp*
# user scope
rm -rf ~/.cursor/skills/koapp*    # or ~/.claude/skills/koapp*
```

## More Examples

- Request Validation

> See [validatorjs](https://github.com/mikeerickson/validatorjs) for more rule examples
>
> See `Router` examples for more usage: [tests/bootstrap.js](tests/bootstrap.js)

```javascript
const { Router } = require("@axiosleo/koapp");

const router = new Router("/test", {
  method: "any",
  validator: {
    // URL params, like `/test/{:id}`, where 'id' is required and must be an integer
    params: {
      id: "required|integer",
    },
    query: {
      name: "required|string",
    },
    body: {
      age: "required|integer",
    },
  },
  handlers: [],
});
```

- File Operations

```javascript
// npm install @koa/multer
// npm install -D @types/koa__multer

const multer = require("@koa/multer");

root.post("/upload", async (context) => {
  // Array of files
  const upload = multer();
  const func = upload.any();
  await func(context.koa, async () => {});
  const file = context.koa.request.files[0];
  context.koa.set("content-type", file.mimetype);
  context.koa.body = file.buffer;
  context.koa.attachment(file.originalname);
});
```

- Server-Sent Events (SSE)

```javascript
const { _foreach, _sleep } = require("@axiosleo/cli-tool/src/helper/cmd");

const test = async (context) => {
  await _foreach(["0", "1", "2", "3"], async (item, index) => {
    context.koa.sse.send({ data: { item, index } });
    await _sleep(1000);
  });
  context.koa.sse.end();
};

const { KoaSSEMiddleware } = require("@axiosleo/koapp");

root.any("/sse", async (context) => {
  const func = KoaSSEMiddleware();
  await func(context.koa, async () => {});
  context.koa.sse.send({ data: "hello, world!" });
  process.nextTick(test, context);
});
```

## License

This project is open-sourced software licensed under [MIT](LICENSE).

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-koapp.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-koapp/refs/branch/master/)
