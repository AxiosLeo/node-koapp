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

The CLI ships a project generator that wires up TypeScript, a DB layer, Docker,
and module scaffolding:

```bash
npx @axiosleo/koapp init my-app
cd my-app
npm install
npm run start:services
```

## 4. Generating CRUD modules from JSON Schema

After `init`, place `*.schema.json` files under `./meta/` and run:

```bash
npx @axiosleo/koapp gen -d ./meta -o ./services/src/modules
```

Each schema produces `name.model.ts`, `name.controller.ts`, `name.router.ts`.

## 5. Next steps

Once the skeleton is running, consult the specialized skills:

- Adding multiple routes and path params → **koapp-router**
- Switching to TCP or WebSocket → **koapp-apps**
- Structured responses, error envelopes → **koapp-response**
- Organizing handlers → **koapp-controller**
- Request-body validation → **koapp-router** (router-level) or **koapp-model**
- Streaming events to the browser → **koapp-sse**
