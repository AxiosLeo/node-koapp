---
name: koapp-router
description: Define routes, path parameters, validators, and nested routers with the @axiosleo/koapp Router class. Use when declaring HTTP/WebSocket/TCP routes in koapp, adding path params like /users/{:id}, composing nested routers, attaching per-route middlewares or after-handlers, validating params/query/body with validatorjs rules, or using shortcut helpers (get/post/put/patch/delete/any).
---

# @axiosleo/koapp Router

Source: [`src/router.js`](../../../src/router.js).

`Router` is the single route-definition primitive for all three application
types (`KoaApplication`, `SocketApplication`, `WebSocketApplication`). A
router can be flat or a tree of sub-routers, and it carries middlewares,
handlers, after-handlers, and validators.

## Constructor

```javascript
const { Router } = require('@axiosleo/koapp');

const router = new Router(prefix, options);
```

| Arg | Type | Default | Notes |
| --- | --- | --- | --- |
| `prefix` | `string` | `''` | Path prefix like `/api/v1` or `/users/{:id}` |
| `options.method` | `string` | `''` | HTTP method. Use `'any'` for all methods. Empty string disables the route |
| `options.handlers` | `Function[]` | `[]` | Async handler functions `async (context) => { ... }` |
| `options.middlewares` | `Function[]` | `[]` | Run before handlers |
| `options.afters` | `Function[]` | `[]` | Run after handlers (even on thrown response) |
| `options.validators` | `object` | `{}` | `{ params, query, body }` - each `{ rules, messages? }` |

Any unknown keys on `options` are kept on the router instance as-is.

## Path params

Use `{:name}` for path parameters. Legacy `:name` also works but `{:name}`
is preferred:

```javascript
new Router('/users/{:id}/posts/{:postId}', {
  method: 'GET',
  handlers: [async (context) => {
    const { id, postId } = context.params;
  }]
});
```

Wildcards:

- `/*` - matches one segment (captured as `params.<next>` if named)
- `/**` - matches one segment without capture
- `/***` - matches any remaining path, ideal for fallback handlers

## HTTP method shortcuts

Each method shortcut creates a nested sub-router:

```javascript
const root = new Router('/api');

root.get('/users', listUsers);
root.post('/users', createUser, {
  body: { rules: { name: 'required|string', email: 'required|email' } }
});
root.put('/users/{:id}', updateUser);
root.patch('/users/{:id}', patchUser);
root.delete('/users/{:id}', deleteUser);
root.any('/health', healthcheck);
```

Under the hood every shortcut delegates to `router.push(method, prefix, handler, validator)`.

## Custom methods

```javascript
root.push('copy', '/resources/{:id}', async (context) => { ... });
```

The framework uppercases and stores the method; match it by sending the
same method string.

## Combining multiple methods

```javascript
root.push('get|post', '/multi', async (context) => {
  // handles both GET and POST
});
```

## Nested routers

```javascript
const api = new Router('/api');
const v1 = new Router('/v1');
const users = new Router('/users');

users.get('/{:id}', async (context) => { ... });

v1.add(users);           // /api/v1/users/{:id}
api.add(v1);
```

`router.add(...subrouters)` attaches other Router instances. If the first
argument is a string prefix, sub-routers are added under it:

```javascript
api.add('/admin', adminUserRouter, adminRoleRouter);
```

The helper `router.new(prefix, options)` creates and mounts a sub-router
in one call:

```javascript
api.new('/internal', { middlewares: [authMiddleware] });
```

## Middlewares and afters

```javascript
const root = new Router(null, {
  middlewares: [
    async (context) => {
      console.log(`[${context.method}] ${context.pathinfo}`);
    }
  ],
  afters: [
    async (context) => {
      console.log('response:', context.response);
    }
  ]
});
```

- Middlewares inherit down the tree (children + grandchildren see them)
- Afters also inherit and run after **any** handler in the subtree
- Throwing inside a handler still runs afters

## Request validation

Validation uses [validatorjs](https://github.com/mikeerickson/validatorjs) rules.

```javascript
root.new('/items/{:id}', {
  method: 'PUT',
  handlers: [updateItem],
  validators: {
    params: {
      rules: { id: 'required|integer' }
    },
    query: {
      rules: { include: 'in:profile,settings' }
    },
    body: {
      rules: {
        name: 'required|string',
        price: 'required|numeric|min:0'
      },
      messages: {
        required: 'The :attribute field is required.'
      }
    }
  }
});
```

On failure the framework throws `HttpError(400, <first-error-message>)`
which the workflow converts into a `400` response.

Common validatorjs rules: `required`, `string`, `integer`, `numeric`, `email`,
`url`, `min:N`, `max:N`, `in:a,b,c`, `regex:/pattern/`, `boolean`, `array`.

## The catch-all fallback

To handle anything that did not match:

```javascript
root.any('/***', async (context) => {
  result('Not Found', 404, { 'Content-Type': 'text/plain' });
});
```

`'/***'` matches any remaining path. The framework falls back to the
deepest matching `/***` route when no exact match is found.

## Method resolution order

For a request `PUT /users/42`:

1. Walk the router tree by path segments, preferring static matches over `*` / `**` / `***`
2. When multiple candidates remain, prefer the one whose `method` list includes the request method (or `ANY`)
3. If nothing matches, follow the nearest `/***` fallback
4. If even that misses, the framework lets the next Koa middleware run (typically 404)

## Common pitfalls

- Leaving `method: ''` (or unset) on a `router.push` creates a route that
  matches no HTTP method - requests fall through to fallback handlers.
  Always use `'any'` or a concrete method unless you know you want this.
- `new Router('/')` and `new Router('')` behave differently; prefer `null`
  or `''` for the root.
- Path params must use `{:name}` inside route segments - `{:name}` **must
  be the entire segment**, not a substring (`/a-{:x}` does not work).
- Validators bubble with the router; nested routers inherit parent middlewares
  and afters, so avoid double-registering auth middlewares.

## See also

- Richer, copy-paste examples: [examples.md](examples.md)
- Building a complete HTTP server around the router: **koapp-apps**
- Sending responses from handlers: **koapp-response**
