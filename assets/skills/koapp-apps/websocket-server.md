# WebSocketApplication (WebSocket)

Source: [`src/apps/websocket.js`](../../../src/apps/websocket.js).

`WebSocketApplication` **extends `SocketApplication`** and swaps the TCP
transport for a `ws` WebSocket server. All connection management methods
(`broadcast`, `send`, `close`, `sendByConnectionId`,
`closeByConnectionId`, `getConnection`, `ping`) are inherited and adapted
to WebSocket semantics.

## Constructor

```javascript
const { WebSocketApplication } = require('@axiosleo/koapp');

const app = new WebSocketApplication({
  port: 8081,
  routers: [router],
  app_id: 'my-ws-service',
  ping: {
    open: false,
    interval: 1000 * 3,
    data: 'this is a ping message'
  }
});
```

Any additional options are forwarded to `new WebSocketServer(opts)` from
the `ws` package (`noServer`, `server`, `path`, `perMessageDeflate`, etc.) -
the app strips `ping`, `routers`, `debug`, and `app_id` before passing.

## Wire protocol

Each inbound message is a plain JSON string - **no delimiter**:

```json
{"path":"/chat/42","method":"GET","query":{"token":"abc"},"body":{"text":"hello"}}
```

Outbound frames are written via `ws.send(json)`.

Browser client example:

```javascript
const ws = new WebSocket('ws://localhost:8081');
ws.onopen = () => {
  ws.send(JSON.stringify({
    path: '/chat/42',
    method: 'GET',
    body: { text: 'hello' }
  }));
};
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Starting the server

```javascript
await app.start();
```

`start()` spins up `new WebSocketServer(options)`, logs the listening port,
emits `listen`, and wires `connection` / `message` / `close` / `error`
handlers.

## Context inside handlers

| Property | Meaning |
| --- | --- |
| `context.app` | The `WebSocketApplication` instance |
| `context.socket` | The `ws` `WebSocket` instance |
| `context.connection_id` | Tracked ID inside `app.connections` |
| `context.method` | Uppercase, inferred from upgrade request or inbound `method` field |
| `context.pathinfo` | Parsed from the URL in the upgrade request |
| `context.query` | From the upgrade URL `searchParams` (NOT the inbound body) |
| `context.body` | Full parsed inbound JSON |
| `context.headers` | Upgrade request headers (`x-forwarded-proto`, cookies, auth) |

Because `query` and `pathinfo` come from the **upgrade** request, each
WebSocket connection is bound to a single virtual route. Use `context.body`
for per-message data.

## Broadcasting

```javascript
// every active connection
app.broadcast({ kind: 'tick', now: Date.now() }, 'ok', 0, null);

// curated subset
const conns = ['id1', 'id2'].map((id) => app.getConnection(id)).filter(Boolean);
app.broadcast({ hello: 'friends' }, 'ok', 0, conns);
```

Same argument shape as `SocketApplication.broadcast`. Internally:

```javascript
connection.send(JSON.stringify(envelope));
```

## Targeted send / close

```javascript
app.sendByConnectionId('id1', { price: 99.9 });
app.closeByConnectionId('id1');   // ws.close()
app.ping('id1');                   // sends { data: 'ping', message: 'ok', code: 0 }
```

## TLS / reverse proxies

When the app sits behind an HTTPS-terminating proxy, the dispatcher reads
`x-forwarded-proto: https` to switch the logical URL to `wss://`. Make sure
your reverse proxy forwards this header.

## Sharing with an existing HTTP server

Pass `noServer: true` or `server: httpServer` as part of the config to share
a port with an HTTP server. These options flow to `WebSocketServer` via
`app.websocketOptions`.

```javascript
const http = require('http');
const server = http.createServer();
const app = new WebSocketApplication({
  server,
  routers: [router]
});
await app.start();
server.listen(3000);
```

## Common pitfalls

- `context.query` is not per-message - it reflects the URL used during the upgrade handshake
- Parsing errors (non-JSON messages) are silently logged via `debug.log`; drop ill-formed clients explicitly if needed
- Use `ping.open` for server-push keep-alives, or rely on `ws`'s built-in ping/pong at the protocol level
- When using a shared HTTP server, do **not** call `server.listen` before `app.start()` is called
