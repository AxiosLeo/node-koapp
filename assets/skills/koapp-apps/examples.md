# Application Examples

Copy-paste-ready boilerplate for each transport.

## HTTP server

```javascript
'use strict';

const { KoaApplication, Router, success, failed } = require('@axiosleo/koapp');

const router = new Router('/api', {
  middlewares: [
    async (context) => {
      console.log(`[${context.method}] ${context.pathinfo}`);
    }
  ]
});

router.get('/health', async () => {
  success({ status: 'ok' });
});

router.post('/echo', async (context) => {
  success({ received: context.body });
}, {
  body: {
    rules: { text: 'required|string' }
  }
});

router.get('/users/{:id}', async (context) => {
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) {
    failed({ id }, '400;Invalid id', 400);
  }
  success({ id, name: `User ${id}` });
});

const app = new KoaApplication({
  port: 8088,
  listen_host: '0.0.0.0',
  routers: [router]
});

app.start();
```

## TCP socket server

```javascript
'use strict';

const { SocketApplication, Router, success } = require('@axiosleo/koapp');

const router = new Router('/', {
  middlewares: [
    async (context) => {
      console.log(`[tcp:${context.connection_id}] ${context.method} ${context.pathinfo}`);
    }
  ]
});

router.any('/ping', async (context) => {
  success({ pong: true, connection_id: context.connection_id });
});

router.any('/chat/{:room}', async (context) => {
  // Broadcast the received message to everyone in the server
  context.app.broadcast({
    from: context.connection_id,
    room: context.params.room,
    body: context.body
  }, 'chat', 0, null);
  success({ delivered: true });
});

const app = new SocketApplication({
  port: 8081,
  routers: [router],
  ping: {
    open: true,
    interval: 1000 * 10,
    data: 'keep-alive'
  }
});

app.event.on('connection', (socket) => {
  console.log('client from', socket.remoteAddress);
});

app.start();
```

Matching TCP client:

```javascript
const net = require('net');

const client = net.createConnection({ port: 8081 });
client.write(JSON.stringify({
  path: '/chat/general',
  method: 'POST',
  body: { text: 'hi everyone' }
}) + '@@@@@@');

client.on('data', (buf) => {
  buf.toString()
    .split('@@@@@@')
    .filter(Boolean)
    .forEach((frame) => console.log(JSON.parse(frame)));
});
```

## WebSocket server

```javascript
'use strict';

const { WebSocketApplication, Router, success } = require('@axiosleo/koapp');

const router = new Router('/', {
  middlewares: [
    async (context) => {
      console.log(`[ws:${context.connection_id}] ${context.method} ${context.pathinfo}`);
    }
  ]
});

router.any('/chat/{:id}', async (context) => {
  context.app.broadcast({
    from: context.connection_id,
    chatId: context.params.id,
    body: context.body
  }, 'chat', 0, null);
  success({ sent: true });
});

const app = new WebSocketApplication({
  port: 8082,
  routers: [router],
  ping: { open: false }
});

setInterval(() => {
  app.broadcast({ tick: Date.now() }, 'tick', 0, null);
}, 5000);

app.start();
```

Matching browser client:

```javascript
const ws = new WebSocket('ws://localhost:8082/chat/42?token=abc');
ws.onopen = () => ws.send(JSON.stringify({ body: { text: 'hi' } }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Shared HTTP + WebSocket

```javascript
'use strict';

const http = require('http');
const { KoaApplication, WebSocketApplication, Router, success } = require('@axiosleo/koapp');

const httpRouter = new Router('/api');
httpRouter.get('/health', async () => success({ status: 'ok' }));

const koaApp = new KoaApplication({ port: 0, routers: [httpRouter] });
const server = http.createServer(koaApp.koa.callback());

const wsRouter = new Router('/');
wsRouter.any('/ws/{:id}', async (context) => {
  success({ echo: context.body, connectionId: context.connection_id });
});

const wsApp = new WebSocketApplication({
  server,
  routers: [wsRouter]
});

(async () => {
  await wsApp.start();          // binds the ws listener
  server.listen(3000, () => console.log('listening on 3000'));
})();
```
