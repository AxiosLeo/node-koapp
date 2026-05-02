---
name: koapp-controller
description: Organize route handlers into reusable classes by extending the @axiosleo/koapp Controller base class. Use when grouping related handlers, reusing response helpers (this.success/failed/result/response/error/log), sharing state across handlers, or scaffolding service modules for a koapp project.
---

# @axiosleo/koapp Controller

Source: [`src/controller.js`](../../../src/controller.js).

`Controller` is a thin base class that mirrors the
[response helpers](../koapp-response/SKILL.md) as instance methods. Extend
it to keep related handlers together and share auxiliary state.

## Import

```javascript
const { Controller } = require('@axiosleo/koapp');
```

## Instance API

| Method | Equivalent function | Notes |
| --- | --- | --- |
| `this.success(data?, headers?)` | `success(data, headers)` | 200 OK JSON envelope |
| `this.failed(data?, code?, status?, headers?)` | `failed(data, code, status, headers)` | Non-2xx JSON envelope |
| `this.result(data, status?, headers?)` | `result(data, status, headers)` | Raw body pass-through |
| `this.response(data, code, status?, headers?)` | `response(data, code, status, headers)` | Full control envelope |
| `this.error(status, msg, headers?)` | `error(status, msg, headers)` | Shortcut error envelope |
| `this.log(...data)` | `debug.log` from `@axiosleo/cli-tool` | Conditional logging |

All `this.success / failed / result / response / error` throw, same as the
functional helpers. See **koapp-response** for envelope details.

## Basic usage

```javascript
const { Controller, Router } = require('@axiosleo/koapp');

class HealthController extends Controller {
  async ping(context) {
    this.log('ping from', context.request_id);
    this.success({ pong: true });
  }

  async version() {
    this.success({ version: require('../package.json').version });
  }
}

const health = new HealthController();
const router = new Router('/health');
router.get('/ping', (ctx) => health.ping(ctx));
router.get('/version', () => health.version());
```

## Why use Controller over plain functions?

- **Shared state**: load DB handles, caches, or config once in the
  constructor and reuse across methods.
- **Inheritance**: define a `BaseController` with common middlewares or
  helpers, then extend it per module (the `init` scaffolding template at
  [`assets/tmpl/services/src/modules/controller.ts.tmpl`](../../tmpl/services/src/modules/controller.ts.tmpl) does this).
- **Testability**: easier to mock a controller instance than free-floating
  functions.

## Binding handlers to routes

`Controller` methods expect a `context` argument and may use `this`, so bind
them explicitly when registering with the router:

```javascript
router.get('/users/{:id}', (ctx) => controller.find(ctx));
router.post('/users', (ctx) => controller.create(ctx));

// or with arrow methods
class UsersController extends Controller {
  find = async (ctx) => {
    const id = Number(ctx.params.id);
    this.success({ id });
  };
}
```

Pure wrappers `(ctx) => controller.method(ctx)` preserve `this` and avoid
`.bind` clutter.

## Error handling

Since `this.success / failed / ...` throw, any code after them does not
run. The workflow catches the throw and writes the response. Keep try /
catch only where you intend to shape a different error:

```javascript
async create(context) {
  try {
    const user = await this.db.users.insert(context.body);
    this.success({ id: user.id });
  } catch (err) {
    if (err.code === 'DUP_ENTRY') {
      this.failed({ email: context.body.email }, '409;Email Already Registered', 409);
    }
    throw err;  // let the workflow convert to 500
  }
}
```

## Logging

`this.log` is wired to `debug.log` from `@axiosleo/cli-tool`. Enable it by
running with `DEBUG=1` (or the cli-tool equivalent), or by setting
`debug: true` on the application.

```javascript
this.log('loading user', context.params.id);
```

## Composing with validators

Validation stays on the router:

```javascript
router.push('post', '/users', (ctx) => controller.create(ctx), {
  body: {
    rules: {
      name: 'required|string',
      email: 'required|email'
    }
  }
});
```

The validator runs before the handler, so by the time `controller.create`
executes you already have a validated `context.body`.

## Generator output

Running `npx @axiosleo/koapp gen -d ./meta -o ./services/src/modules`
produces `.controller.ts` files that extend a project-local
`BaseController`. That `BaseController` typically extends `Controller` and
adds database handles:

```typescript
import { Controller } from '@axiosleo/koapp';
import { mainDB } from '../services/db';

export class BaseController extends Controller {
  protected mainDB = mainDB;
}
```

## Common pitfalls

- Forgetting to pass `context` into instance methods: `router.get('/x', controller.handler)` loses `this` when the router calls the method as a free function. Use arrow wrappers.
- Returning `this.success(...)` from a handler is redundant - the throw short-circuits execution.
- Controllers are long-lived across requests; never stash per-request data on `this`. Use `context` or local variables instead.

## See also

- Response helper details: **koapp-response**
- Grouping controllers under a router tree: **koapp-router**
- Concrete controller recipes: [examples.md](examples.md)
