# @axiosleo/koapp Quick Start

Minimum viable HTTP app using `@axiosleo/koapp`.

## 1. Install

```bash
npm install @axiosleo/koapp
```

## 2. Hello World server

```javascript
'use strict';

const { KoaApplication, Router, success } = require('@axiosleo/koapp');

const router = new Router('/', {
  method: 'any',
  handlers: [
    async (context) => {
      success({ message: 'Hello, koapp!' });
    }
  ]
});

const app = new KoaApplication({
  port: 8088,
  listen_host: 'localhost',
  routers: [router]
});

app.start();
```

Run it:

```bash
node server.js
# open http://localhost:8088/
```

## 3. Scaffolding a project

`npx @axiosleo/koapp init <name>` asks which template to write. The default
is a single HTTP service. There is no code generator; routes are the samples
shipped with the template, and further modules are written by hand.

| Flag | Result |
| --- | --- |
| `-t simple-ts` (default) | TypeScript koapp service, sample routes, no database |
| `-t simple-js` | The same service in CommonJS, no compile step |
| `-t monorepo` | pnpm workspace. `apps/services` is a TypeScript API with Session admin routes, an `/openapi` surface guarded by Bearer Api-Keys, and a SQLite metadata store. Business modules follow `src/modules/<name>/<name>.{router,controller,model}.ts` |

```bash
npx @axiosleo/koapp init my-app -t simple-ts
# init offers to run `pnpm install` and `pnpm dev` for you; otherwise:
cd my-app
pnpm install
pnpm dev
```

## 4. Next steps

Once the skeleton is running, consult the specialized skills:

- Adding multiple routes and path params → **koapp-router**
- Switching to TCP or WebSocket → **koapp-apps**
- Structured responses, error envelopes → **koapp-response**
- Organizing handlers → **koapp-controller**
- Request-body validation → **koapp-router** (router-level) or **koapp-model**
- Streaming events to the browser → **koapp-sse**
