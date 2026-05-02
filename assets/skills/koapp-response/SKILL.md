---
name: koapp-response
description: Send structured responses from @axiosleo/koapp handlers using success/failed/result/response/error helpers and HttpError/HttpResponse classes. Use when returning JSON envelopes, custom HTTP status codes, raw HTML/text, error responses, or when setting response headers from a koapp route handler or controller method.
---

# @axiosleo/koapp Response Helpers

Source: [`src/response.js`](../../../src/response.js).

`@axiosleo/koapp` uses **throw-based response helpers**: you call one of the
helpers and it throws a typed object that the framework's workflow catches
and writes to the wire. This keeps route handlers linear (no need to
`return`) and lets middlewares/afters run consistently.

## Import

```javascript
const {
  success,
  failed,
  result,
  response,
  error,
  HttpError,
  HttpResponse
} = require('@axiosleo/koapp');
```

## Helper reference

| Helper | Signature | Purpose |
| --- | --- | --- |
| `success(data?, headers?)` | `(data: any, headers: Record<string,string>) => never` | 200 OK, JSON envelope with `code: '200;Success'` |
| `failed(data?, code?, status?, headers?)` | `(data: any, code?: string, status?: number, headers?) => never` | Non-2xx with JSON envelope; defaults `code: '501;Internal Server Error'`, `status: 501` |
| `response(data, code?, status?, headers?, format?)` | Full control JSON envelope | Explicit `code`, `status`, `headers`, `format` (`'json' | 'text'`) |
| `result(data, status?, headers?)` | Raw body pass-through | Bypass the JSON envelope and write `data` as-is |
| `error(status, msg, headers?)` | Error with empty payload | Shortcut for `response({}, '<status>;<msg>', status, headers)` |

All helpers **never return** - they throw.

## JSON envelope

`success`, `failed`, `response`, and `error` produce the framework's
standard envelope:

```json
{
  "request_id": "uuid",
  "timestamp": 1714651200000,
  "code": "200;Success",
  "message": "Success",
  "data": { }
}
```

`code` follows the `"<status>;<message>"` convention:

- `"200;Success"`
- `"400;Bad Request"`
- `"404;Not Found"`
- `"500;Internal Server Error"`

Both parts are mirrored into `data` (so `message` is still readable when
clients only unpack `code`). Custom codes are free-form strings.

## Raw pass-through with `result()`

Use `result()` when you need to emit HTML, plain text, binary, or a pre-built
JSON body without the envelope wrapping:

```javascript
const { result } = require('@axiosleo/koapp');

router.get('/page', async () => {
  result('<h1>Hello</h1>', 200, { 'Content-Type': 'text/html' });
});

router.get('/raw-json', async () => {
  result(JSON.stringify({ hello: 'world' }), 200, {
    'Content-Type': 'application/json'
  });
});
```

`result()` sets `notResolve: true` internally so the envelope is skipped.

## Error helpers

```javascript
const { failed, error } = require('@axiosleo/koapp');

router.post('/login', async (context) => {
  const user = await findUser(context.body.email);
  if (!user) {
    error(404, 'User Not Found');
  }
  if (!verify(context.body.password, user.password)) {
    failed({ email: context.body.email }, '401;Unauthorized', 401);
  }
  // ... success response ...
});
```

## HttpError for validation / system errors

`HttpError` is primarily used internally (e.g. by `Model` when validation
fails), but handlers may throw it to short-circuit with a plain error
body:

```javascript
const { HttpError } = require('@axiosleo/koapp');

router.get('/guarded', async (context) => {
  if (!context.koa.session.user) {
    throw new HttpError(401, 'Please log in', { 'WWW-Authenticate': 'Bearer' });
  }
});
```

The framework catches it in the workflow and writes
`status=401`, the message, and any headers.

## HttpResponse class

`HttpResponse` is the class behind all helpers. You normally won't
instantiate it directly, but it's useful to know its shape:

```javascript
new HttpResponse({
  status: 200,
  data: { ... },
  code: '200;Success',
  headers: { 'X-Whatever': '1' },
  format: 'json',      // or 'text'
  notResolve: false    // if true, skip the envelope
});
```

## Status code presets (TypeScript)

The type definitions in `index.d.ts` list convenient string literals:

```
'200;Success'
'400;Bad Data'
'400;Invalid Signature'
'401;Unauthorized'
'403;Not Authorized'
'404;Not Found'
'409;Data Already Exists'
'500;Internal Server Error'
'501;Failed'
'000;Unknown Error'
```

Any `"<number>;<text>"` string is valid - the presets are just common ones.

## Setting headers per response

Every helper accepts a `headers` argument:

```javascript
success({ ok: true }, {
  'X-Request-Source': 'public-api',
  'Cache-Control': 'no-store'
});

result(buffer, 200, {
  'Content-Type': 'application/pdf',
  'Content-Disposition': 'attachment; filename="report.pdf"'
});
```

## Direct Koa response

Inside an `HTTP` handler you can still write to `context.koa` directly when
you need streaming, redirects, or pipelining:

```javascript
router.get('/redirect', async (context) => {
  context.koa.redirect('/elsewhere');
});

router.get('/stream', async (context) => {
  context.koa.type = 'application/octet-stream';
  context.koa.body = fs.createReadStream(file);
});
```

Mixing raw Koa output with the throw helpers: the **last** to write wins.
If you need raw streaming, skip the helpers entirely.

## Common pitfalls

- Forgetting `success/failed/result/...` throws, leading to code that runs
  after the "response" line. Treat them as terminal.
- Calling `success` in a middleware (not a handler) stops execution just
  like in a handler - the workflow still catches and emits the response.
- `failed(data, status)` does **not** work - the second arg is `code`, not
  `status`. Use `failed(data, '400;Bad Data', 400)` or switch to
  `response(data, '400;Bad Data', 400)`.
- Returning `success(...)` from a handler is redundant (it throws) and
  confusing to readers - do not `return` helper calls.

## See also

- Organize handlers into classes with wrapped helpers: **koapp-controller**
- Validate body/params before responding: **koapp-router**
- Concrete response recipes: [examples.md](examples.md)
