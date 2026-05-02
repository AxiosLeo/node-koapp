# KoaApplication (HTTP)

Source: [`src/apps/koa.js`](../../../src/apps/koa.js).

`KoaApplication` wraps Koa with session, body parser, static server, and the
framework's routing workflow. It is the default choice for REST APIs.

## Constructor signature

```javascript
const { KoaApplication } = require('@axiosleo/koapp');

const app = new KoaApplication(config);
```

## Full config with defaults

```javascript
new KoaApplication({
  port: 8080,                  // Port to listen on
  listen_host: 'localhost',    // Use '0.0.0.0' for public access
  debug: false,                // Verbose logging
  routers: [],                 // Array of Router instances
  app_id: '',                  // Optional stable app ID
  session_key: 'koa.sess',     // Session cookie name
  session: {
    maxAge: 1296000000,        // 15 days
    overwrite: true,
    httpOnly: true,
    signed: true,
    rolling: false,
    renew: true,
    secure: false              // Enable in production (HTTPS)
  },
  static: {
    rootDir: path.join(process.cwd(), './public')
    // uploadDir: './public/upload'  // optional
  },
  body_parser: {},             // passed to koa-bodyparser
  sse: false                   // or { pingInterval: 60000, closeEvent: 'close' }
});
```

Pass `session: false` to disable the session middleware, and `static: false`
to disable the built-in static server.

## Starting the server

```javascript
app.start();                  // async
```

`start()` emits a `starting` event and calls `this.koa.listen(port, listen_host)`.
No arguments needed - everything comes from config.

## Accessing the underlying Koa instance

The raw Koa app is at `app.koa`. Use it to mount additional middlewares:

```javascript
app.koa.use(async (ctx, next) => {
  const t = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.url} - ${Date.now() - t}ms`);
});
```

Mount custom middlewares **before** `app.start()` so they're in the chain.

## Context inside handlers

When a route handler runs, it receives an object shaped like
`KoaContext<TParams, TBody, TQuery>`:

| Property | Meaning |
| --- | --- |
| `context.app` | The `KoaApplication` instance |
| `context.koa` | The raw Koa `ctx` (`ctx.request`, `ctx.response`, `ctx.session`, etc.) |
| `context.url` | `ctx.req.url` |
| `context.method` | Uppercased HTTP method |
| `context.params` | Path params from `/{:name}` |
| `context.query` | Parsed query string |
| `context.body` | Parsed request body (via koa-bodyparser) |
| `context.request_id` | Auto-generated uuid |
| `context.router` | Matched `RouterInfo` |

## Response envelope

The built-in response handler wraps JSON responses:

```json
{
  "request_id": "...",
  "timestamp": 1714651200000,
  "code": "200;Success",
  "message": "Success",
  "data": { }
}
```

Call `success(data)` / `failed(...)` / `result(raw, status, headers)` from
`require('@axiosleo/koapp')` to emit responses. They **throw** the response
object; the workflow catches and writes it. See **koapp-response** for
details.

## File uploads

`@koa/multer` is the recommended uploader:

```javascript
const multer = require('@koa/multer');

router.post('/upload', async (context) => {
  const upload = multer();
  await upload.any()(context.koa, async () => {});
  const file = context.koa.request.files[0];
  context.koa.set('content-type', file.mimetype);
  context.koa.body = file.buffer;
  context.koa.attachment(file.originalname);
});
```

Install with `npm install @koa/multer` (and `@types/koa__multer` for TS).

## Sessions

When `session` config is present, the framework signs the cookie with
`app.app_id`. Access inside handlers:

```javascript
router.get('/login', async (context) => {
  context.koa.session.user = { id: 1 };
  context.koa.session.save();
  context.koa.redirect('/');
});
```

## Static files

If `static.rootDir` points to a readable directory, `koa-static-server`
serves its contents. For file downloads from a custom handler, set the
content type and use `ctx.body = fs.createReadStream(path)`.

## Events

`KoaApplication` emits `starting` before listening and `response` for every
processed request. Override behavior by listening to `response`:

```javascript
app.on('response', (context) => {
  // context.response holds the HttpResponse; the built-in listener writes it
});
```

Internally the built-in `response` listener writes the final Koa response,
so avoid removing it unless you intend to fully customize output.

## Troubleshooting

- `ECONNREFUSED` on localhost from external clients → set `listen_host: '0.0.0.0'`
- Sessions lost across restarts → provide a stable `app_id` so signing key is stable
- Request body always undefined → ensure the request `Content-Type` matches what `koa-bodyparser` accepts (JSON / urlencoded / text)
- CORS → install and mount `@koa/cors` via `app.koa.use(...)` before `start()`
