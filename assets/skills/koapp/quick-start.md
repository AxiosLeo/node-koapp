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

## 3. Scaffolding a full project

The CLI ships a project scaffold: a pnpm monorepo whose `apps/services`
package is a TypeScript koapp API (Session-authenticated admin routes, an
`/openapi` surface guarded by Bearer Api-Keys, and a SQLite metadata store).
Business modules follow the
`src/modules/<name>/<name>.{router,controller,model}.ts` convention and are
written by hand - there is no code generator.

```bash
npx @axiosleo/koapp init my-app
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
