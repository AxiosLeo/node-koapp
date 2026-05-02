# SSE Examples

## Hello SSE

```javascript
const { KoaApplication, Router } = require('@axiosleo/koapp');
const { KoaSSEMiddleware } = require('@axiosleo/koapp').middlewares;

const router = new Router('/');
router.any('/sse', async (context) => {
  const sse = KoaSSEMiddleware();
  await sse(context.koa, async () => {});
  context.koa.sse.send({ data: 'hello, world!' });
  context.koa.sse.close();
});

new KoaApplication({ port: 8088, routers: [router] }).start();
```

Browser:

```javascript
new EventSource('http://localhost:8088/sse').onmessage = (e) => console.log(e.data);
```

## Pushing a progress bar

```javascript
const { _foreach, _sleep } = require('@axiosleo/cli-tool/src/helper/cmd');
const { Router } = require('@axiosleo/koapp');
const { KoaSSEMiddleware } = require('@axiosleo/koapp').middlewares;

const router = new Router('/');
router.any('/progress', async (context) => {
  const sse = KoaSSEMiddleware();
  await sse(context.koa, async () => {});

  process.nextTick(async () => {
    await _foreach(['0', '25', '50', '75', '100'], async (percent) => {
      context.koa.sse.send({ event: 'progress', data: { percent } });
      await _sleep(500);
    });
    context.koa.sse.close();
  });
});
```

Browser:

```javascript
const es = new EventSource('/progress');
es.addEventListener('progress', (e) => {
  const { percent } = JSON.parse(e.data);
  console.log('progress', percent);
});
```

## Live log tail

```javascript
const fs = require('fs');
const { Router } = require('@axiosleo/koapp');
const { KoaSSEMiddleware } = require('@axiosleo/koapp').middlewares;

const router = new Router('/');
router.any('/logs', async (context) => {
  const sse = KoaSSEMiddleware();
  await sse(context.koa, async () => {});

  const stream = fs.createReadStream('./app.log', { encoding: 'utf8' });
  stream.on('data', (chunk) => {
    for (const line of chunk.split('\n').filter(Boolean)) {
      context.koa.sse.send({ event: 'log', data: line });
    }
  });
  stream.on('end', () => context.koa.sse.close());
  context.koa.sse.on('close', () => stream.destroy());
});
```

## Broadcast to many SSE clients

The middleware does not group connections itself, but you can keep your
own registry:

```javascript
const subscribers = new Set();

router.any('/notifications', async (context) => {
  const sse = KoaSSEMiddleware();
  await sse(context.koa, async () => {});
  subscribers.add(context.koa.sse);
  context.koa.sse.on('close', () => subscribers.delete(context.koa.sse));
});

function broadcast(event, data) {
  for (const sse of subscribers) {
    try {
      sse.send({ event, data });
    } catch (err) {
      subscribers.delete(sse);
    }
  }
}

// Somewhere else in the app
broadcast('message', { text: 'New post published!' });
```

## With validator + auth

```javascript
router.push('any', '/secure-stream', async (context) => {
  const token = context.query.token;
  if (token !== process.env.STREAM_TOKEN) {
    const { error } = require('@axiosleo/koapp');
    error(401, 'Unauthorized');
  }

  const { KoaSSEMiddleware } = require('@axiosleo/koapp').middlewares;
  const sse = KoaSSEMiddleware({ pingInterval: 30000 });
  await sse(context.koa, async () => {});

  context.koa.sse.send({ event: 'hello', data: { at: Date.now() } });
}, {
  query: {
    rules: { token: 'required|string' }
  }
});
```

## Proxy-friendly headers

Place these **before** `sse(context.koa, ...)` so they reach the
response headers:

```javascript
router.any('/sse', async (context) => {
  context.koa.set('X-Accel-Buffering', 'no'); // nginx
  context.koa.set('Cache-Control', 'no-cache, no-transform');

  const { KoaSSEMiddleware } = require('@axiosleo/koapp').middlewares;
  const sse = KoaSSEMiddleware();
  await sse(context.koa, async () => {});
  // ...
});
```

## Sending JSON arrays one item at a time

```javascript
router.any('/items', async (context) => {
  const sse = KoaSSEMiddleware();
  await sse(context.koa, async () => {});

  const items = await db.table('items').select();
  for (const [idx, item] of items.entries()) {
    context.koa.sse.send({ id: idx, event: 'item', data: item });
  }
  context.koa.sse.close();
});
```

Browser:

```javascript
const es = new EventSource('/items');
es.addEventListener('item', (e) => console.log(JSON.parse(e.data)));
```
