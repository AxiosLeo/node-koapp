---
name: koapp-sse
description: Stream Server-Sent Events (SSE) from a @axiosleo/koapp Koa route using the KoaSSEMiddleware. Use when pushing real-time events to a browser over HTTP, implementing progress bars, live logs, notifications, or EventSource endpoints with text/event-stream, including ctx.koa.sse.send/close/keepAlive APIs.
---

# @axiosleo/koapp Server-Sent Events Middleware

Source: [`src/middlewares/sse.js`](../../../src/middlewares/sse.js).

`KoaSSEMiddleware` upgrades a Koa request to a Server-Sent Events (SSE)
stream, setting the right headers and exposing `ctx.sse.send(...)` for
pushing events to the browser over plain HTTP.

Use SSE when:

- You need server → client streaming (notifications, logs, live charts)
- You do NOT need client → server streaming (use **koapp-apps** WebSocket instead)
- You want a simple, proxy-friendly transport - SSE works over HTTP/1.1

Browsers reconnect automatically; most reverse proxies handle it fine.

## Import

```javascript
const { KoaSSEMiddleware } = require('@axiosleo/koapp').middlewares;
```

## Middleware factory

```javascript
const middleware = KoaSSEMiddleware({
  pingInterval: 60000,  // ms between heartbeat comments (default 60s)
  closeEvent: 'close'   // event name sent on stream close
});
```

The factory returns a standard Koa middleware `(ctx, next) => {}`.

## Wiring into a router handler

Because the framework already dispatches routes via its workflow, invoke
the middleware **inside** the handler, passing `context.koa`:

```javascript
const { Router } = require('@axiosleo/koapp');
const { KoaSSEMiddleware } = require('@axiosleo/koapp').middlewares;

const router = new Router('/');

router.any('/sse', async (context) => {
  const sse = KoaSSEMiddleware();
  await sse(context.koa, async () => {});

  context.koa.sse.send({ data: 'hello, world!' });

  process.nextTick(async () => {
    for (let i = 0; i < 5; i++) {
      context.koa.sse.send({ id: i, event: 'tick', data: { i } });
      await new Promise((r) => setTimeout(r, 1000));
    }
    context.koa.sse.close();
  });
});
```

Key points:

1. Call `await sse(context.koa, async () => {})` - pass a no-op `next`.
2. After that, `context.koa.sse` exists.
3. Push events with `context.koa.sse.send(event)`; end with `.close()`.
4. Do **not** call `success / failed / result` in the same handler - SSE
   takes over the response body.

## Event shape

`sse.send(data)` accepts either a string or an object:

```javascript
// String payload - becomes `data:<text>\n\n`
context.koa.sse.send('hello');

// Object payload - id/event are optional
context.koa.sse.send({
  id: 42,
  event: 'progress',
  data: { percent: 75 }  // objects are JSON-stringified
});
```

Raw wire output:

```
id:42
event:progress
data:{"percent":75}

```

## Lifecycle methods

| Method | When to use |
| --- | --- |
| `ctx.sse.send(data)` | Push one event |
| `ctx.sse.keepAlive()` | Send a `:\n\n` comment to keep the connection warm (called automatically every `pingInterval` ms for all active streams) |
| `ctx.sse.close()` | Emit a final `{ event: closeEvent }` and end the stream |

The middleware maintains an internal `ssePool` and calls `keepAlive` on
every registered stream every `pingInterval` ms. Manual calls are rarely
needed.

## Reacting to client disconnect

The middleware listens to `close` / `error` events on the SSE stream and
calls an internal `close()` that:

1. Removes the stream from the pool
2. `unpipe()` + `destroy()` the stream
3. Ends the Koa response
4. Destroys the underlying socket

You can listen yourself too:

```javascript
context.koa.sse.on('close', () => {
  clearInterval(myPushLoop);
});
```

## Long-lived handlers

The handler function must remain alive while the SSE stream is open.
Don't `return` from it immediately; either keep pushing inline, or spawn a
background task and let it own the lifecycle:

```javascript
router.any('/logs', async (context) => {
  const sse = KoaSSEMiddleware();
  await sse(context.koa, async () => {});

  // Detach so the handler resolves but the stream stays open
  (async () => {
    for await (const line of tail('./app.log')) {
      context.koa.sse.send({ event: 'log', data: line });
    }
    context.koa.sse.close();
  })();
});
```

The framework's workflow will see the handler resolve, but the response
body (the SSE stream) remains open until you `close()` it or the client
disconnects.

## Browser client

```javascript
const source = new EventSource('/sse');

source.onmessage = (e) => {
  console.log('data:', e.data);
};

source.addEventListener('progress', (e) => {
  const payload = JSON.parse(e.data);
  console.log('progress:', payload.percent);
});

source.addEventListener('close', () => {
  console.log('server closed the stream');
  source.close();
});
```

Browsers automatically reconnect on network blips.

## Pairing with other koapp pieces

- Validate the upgrade with a router-level validator on `query`
  (e.g. auth token) - **koapp-router**
- Authenticate via session cookie - the middleware does not touch auth
- Control backpressure by only pushing when `context.koa.sse.writable`

## Common pitfalls

- Calling `success / failed / result / context.koa.body = ...` in the
  same handler conflicts with the SSE stream and yields incomplete output.
- Using HTTP/2 requires enabling SSE on the server side - the default
  Node HTTP/1.1 works out of the box.
- Firewall / proxy buffering can delay events. Set
  `X-Accel-Buffering: no` for nginx:
  ```javascript
  context.koa.set('X-Accel-Buffering', 'no');
  ```
  Do this **before** calling `sse(context.koa, ...)`.
- The middleware's global `setInterval` heartbeat keeps all open SSE
  connections warm; it does not leak across requests because each stream
  auto-removes itself from the pool on close.

## See also

- Real-time browser apps needing bi-directional traffic → **koapp-apps** (WebSocket)
- Progress indicators for long-running HTTP jobs → this skill + `Workflow` from `@axiosleo/cli-tool`
- Concrete SSE recipes: [examples.md](examples.md)
