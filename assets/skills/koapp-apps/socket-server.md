# SocketApplication (TCP)

Source: [`src/apps/socket.js`](../../../src/apps/socket.js).

`SocketApplication` builds a raw TCP server via Node's `net` module and
routes inbound frames through the same `Router` stack as HTTP.

## Constructor

```javascript
const { SocketApplication } = require('@axiosleo/koapp');

const app = new SocketApplication({
  port: 8081,
  routers: [router],
  app_id: 'my-tcp-service',
  debug: false,
  ping: {
    open: true,
    interval: 1000 * 10,
    data: 'this is a ping message'
  }
});
```

## Wire protocol

Each inbound frame is a JSON string **followed by the 6-byte delimiter**
`@@@@@@`:

```
{"path":"/test","method":"GET","query":{"test":123}}@@@@@@
```

The server strips the delimiter before `JSON.parse`. Outbound frames from
`send()` / `broadcast()` / handler responses append the same delimiter so
clients can split messages on `@@@@@@`.

Client side (example in Node):

```javascript
const net = require('net');
const client = net.createConnection({ port: 8081 });
client.write(JSON.stringify({
  path: '/chat/42',
  method: 'GET',
  query: { token: 'abc' },
  body: { text: 'hello' }
}) + '@@@@@@');
client.on('data', (chunk) => {
  chunk.toString().split('@@@@@@').filter(Boolean).forEach((frame) => {
    const msg = JSON.parse(frame);
    console.log(msg);
  });
});
```

## Starting the server

```javascript
await app.start();
```

`start()` calls `net.createServer` and listens on `config.port`. It logs
`Server is running on port <port>` on successful bind.

## Route handler context

Inside handlers:

| Property | Meaning |
| --- | --- |
| `context.app` | The `SocketApplication` instance |
| `context.socket` | Raw `net.Socket` connection |
| `context.connection_id` | Tracked ID inside `app.connections` |
| `context.method` | Uppercased from inbound frame (default `GET`) |
| `context.pathinfo` | Inbound `path` field |
| `context.query`, `context.body` | From the inbound frame |

## Response envelope (default `json` format)

```json
{
  "request_id": "...",
  "timestamp": 1714651200000,
  "code": "0",
  "message": "ok",
  "data": { }
}
```

Followed by `@@@@@@`. Use `success(data)` from `require('@axiosleo/koapp')`
or write raw data via `context.socket.write(str + '@@@@@@')`.

## Broadcasting

```javascript
// send to all active connections
app.broadcast({ event: 'price', value: 42.5 }, 'ok', 0, null);

// send to a curated list of connection IDs
const someIds = ['id1', 'id2'];
const conns = someIds
  .map((id) => app.getConnection(id))
  .filter(Boolean);
app.broadcast({ notice: 'shutdown' }, 'ok', 0, conns);
```

Pass `null` as the 4th argument to hit every active connection. Pass an
empty array `[]` and nothing is sent (the default).

## Targeted send / close

```javascript
app.sendByConnectionId('some-id', { hello: 'world' }, 'ok', 0);
app.closeByConnectionId('some-id');
app.ping('some-id'); // sends { data: 'ping', message: 'ok', code: 0 }
```

`getConnection('some-id')` returns the raw `net.Socket` or `null`.

## Ping heartbeat

When `config.ping.open === true`, the app schedules a global broadcast every
`config.ping.interval` ms with payload `config.ping.data`. Leave it off
unless the protocol requires keep-alives - most TCP clients can manage
their own.

## Connection events

Use `app.event` (not `app` itself) for connection-level events:

```javascript
app.event.on('connection', (socket) => {
  console.log('new client from', socket.remoteAddress);
});
app.event.on('listen', (port) => {
  console.log('bound on', port);
});
```

## Common pitfalls

- Frames without the trailing `@@@@@@` are silently dropped and logged via `debug.log`
- Binary payloads need custom decoding (the default assumes utf-8 JSON)
- `app.connections` can grow if clients disconnect uncleanly - wire your own idle/timeout cleanup when needed (`connection.setTimeout(ms)`)
- `EADDRINUSE` is logged at debug level, not thrown - listen to server errors manually if you need to fail fast
