# Response Examples

## Success with data

```javascript
const { success } = require('@axiosleo/koapp');

router.get('/users/{:id}', async (context) => {
  success({ id: context.params.id, name: 'Alice' });
});
```

Wire output:

```json
{
  "request_id": "...",
  "timestamp": 1714651200000,
  "code": "200;Success",
  "message": "Success",
  "data": { "id": "1", "name": "Alice" }
}
```

## Success with custom headers

```javascript
success({ ok: true }, {
  'X-Correlation-Id': context.request_id,
  'Cache-Control': 'no-store'
});
```

## Failure with explicit status and code

```javascript
const { failed } = require('@axiosleo/koapp');

router.post('/login', async (context) => {
  const user = await db.users.findByEmail(context.body.email);
  if (!user) {
    failed({ email: context.body.email }, '404;User Not Found', 404);
  }
  if (!verify(context.body.password, user.password)) {
    failed({ email: context.body.email }, '401;Unauthorized', 401, {
      'WWW-Authenticate': 'Bearer realm="api"'
    });
  }
  success({ token: signJwt(user) });
});
```

## error() shortcut

```javascript
const { error } = require('@axiosleo/koapp');

router.get('/teapot', async () => {
  error(418, "I'm a teapot");
});
```

Emits:

```json
{
  "code": "418;I'm a teapot",
  "message": "I'm a teapot",
  "data": {}
}
```

## Raw HTML page

```javascript
const { result } = require('@axiosleo/koapp');

router.get('/', async () => {
  const html = `<!DOCTYPE html>
    <html>
      <head><title>Hi</title></head>
      <body><h1>Hello, world!</h1></body>
    </html>`;
  result(html, 200, { 'Content-Type': 'text/html; charset=utf-8' });
});
```

## Raw JSON without the envelope

```javascript
const { result } = require('@axiosleo/koapp');

router.get('/proxy/echo', async (context) => {
  result(JSON.stringify({ query: context.query, body: context.body }), 200, {
    'Content-Type': 'application/json'
  });
});
```

## File download

```javascript
const fs = require('fs');
const path = require('path');
const stat = require('util').promisify(fs.stat);

router.get('/files/{:name}', async (context) => {
  const filePath = path.resolve('./files', context.params.name);
  const info = await stat(filePath);
  context.koa.type = path.extname(filePath);
  context.koa.set('Content-Length', String(info.size));
  context.koa.set(
    'Content-Disposition',
    'attachment; filename=' + encodeURIComponent(context.params.name)
  );
  context.koa.body = fs.createReadStream(filePath);
});
```

The helpers are not used here because we stream straight to Koa.

## response() for full control

```javascript
const { response } = require('@axiosleo/koapp');

router.post('/batch', async (context) => {
  const { accepted, rejected } = await enqueue(context.body);
  response(
    { accepted, rejected },
    '202;Accepted',
    202,
    { 'X-Job-Count': String(accepted.length) },
    'json'
  );
});
```

## Throwing HttpError

```javascript
const { HttpError } = require('@axiosleo/koapp');

router.get('/secret', async (context) => {
  if (!context.koa.session.user) {
    throw new HttpError(401, 'Please log in');
  }
  const { success } = require('@axiosleo/koapp');
  success({ secret: 'shhh' });
});
```

The framework catches the thrown `HttpError` and writes
`status=401`, `message='Please log in'`.

## Validation-triggered errors

`Model` throws `HttpError(400, msg)` when rules fail, so using
`Model.create(data, rules)` inside a handler automatically yields a 400
response without any explicit `failed(...)` call:

```javascript
const { Model } = require('@axiosleo/koapp');

router.post('/sign-up', async (context) => {
  Model.create(context.body, {
    email: 'required|email',
    password: 'required|min:8'
  });
  const { success } = require('@axiosleo/koapp');
  success({ ok: true });
});
```

See **koapp-model** for more.

## Redirects

```javascript
router.get('/legacy', async (context) => {
  context.koa.redirect('/new-location');
});
```

Koa's redirect sets `Location` header and HTTP 302. The framework's
workflow will not overwrite the status once you write to `context.koa`
directly.

## Cookies via Koa

```javascript
router.get('/set-cookie', async (context) => {
  context.koa.cookies.set('remember_me', '1', { maxAge: 86400000 });
  const { success } = require('@axiosleo/koapp');
  success({ ok: true });
});
```
