---
name: koapp-apps
description: Choose and configure the right @axiosleo/koapp Application class - KoaApplication for HTTP, SocketApplication for TCP sockets, WebSocketApplication for WebSocket. Use when building a server with koapp, configuring ports, listen host, session, static files, body parser, ping heartbeat, managing socket connections, or deciding between HTTP/TCP/WS transport.
---

# @axiosleo/koapp Application Classes

`@axiosleo/koapp` exposes three runtime application classes, all extending a
shared `Application` base. Pick one based on the transport you need.

## Which class do I need?

| Class | Transport | Use when |
| --- | --- | --- |
| `KoaApplication` | HTTP(S) via Koa | REST APIs, file uploads, SSR, Server-Sent Events |
| `SocketApplication` | Raw TCP via Node `net` | Custom TCP protocol, IoT gateways, line-delimited services |
| `WebSocketApplication` | WebSocket via `ws` | Real-time browser apps, chat, live dashboards |

All three accept `{ port, routers, debug, app_id }` at minimum; see the
per-class docs for full options:

- [http-server.md](http-server.md) - `KoaApplication`
- [socket-server.md](socket-server.md) - `SocketApplication`
- [websocket-server.md](websocket-server.md) - `WebSocketApplication`
- [examples.md](examples.md) - full server examples

## Shared config keys

All three apps normalize config through `Configuration` from
`@axiosleo/cli-tool`:

```javascript
{
  port: 8080,            // Port to listen on
  listen_host: 'localhost', // '0.0.0.0' for public access (Koa only)
  routers: [],           // Array of Router instances
  app_id: '',            // Optional stable ID; auto uuid-v4 if empty
  debug: false           // Verbose logging
}
```

## Shared events

All apps extend `EventEmitter` and emit:

- `starting` - before the server binds
- `response` - after each response is produced (framework uses this internally to write the response)

Socket apps also expose a separate `app.event` EventEmitter emitting:

- `connection` - new client connected
- `listen` - server bound to the port

## Shared lifecycle

```javascript
const app = new KoaApplication({ ... });
app.on('starting', () => console.log('about to listen'));
await app.start();       // all three classes implement .start()
```

## Connection management (Socket + WebSocket)

`SocketApplication` implements the following methods, inherited by
`WebSocketApplication`:

- `broadcast(data, msg, code, connections)` - send to many; pass `null` for all
- `send(connection, data, msg, code)` - send to one raw connection
- `close(connection)` - close one raw connection
- `sendByConnectionId(id, data, msg, code)` - send by tracked connection ID
- `closeByConnectionId(id)` - close by tracked connection ID
- `getConnection(id)` - returns the raw connection or `null`
- `ping(id)` - send a ping payload to one connection

Connections are tracked in `app.connections` keyed by an auto-generated
`connection_id` (`_uuid_salt('connect:' + app_id)`).

## Ping heartbeat

Socket apps support opt-in periodic ping:

```javascript
new SocketApplication({
  port: 8081,
  routers: [root],
  ping: {
    open: true,              // default false
    interval: 1000 * 60 * 5, // default 5min
    data: 'this is a ping'
  }
});
```

When `ping.open` is `true`, the app broadcasts `data` to all active
connections every `interval` ms.

## Protocol differences

| Aspect | Socket (TCP) | WebSocket |
| --- | --- | --- |
| Request framing | `{...json}@@@@@@` delimiter | Plain JSON string |
| `send(conn, data)` | `conn.write(data + '@@@@@@')` | `conn.send(data)` |
| `close(conn)` | `conn.end()` | `conn.close()` |
| headers in context | none | `context.headers` (from upgrade request) |

## Common pitfalls

- Calling `new KoaApplication({ static: false })` **disables** the built-in
  static server. Set `static: { rootDir: './public' }` to enable it.
- `SocketApplication` requires every inbound message to end with `@@@@@@`.
  Clients must append that delimiter.
- `WebSocketApplication.ping.open = true` triggers `broadcast` every
  `interval` even when there are zero connections - the call is a no-op but
  still schedules.
- Do **not** call `app.start()` inside a route handler - the app is already
  running at that point.

## Quick jump

If you just need to build one server, start with the matching doc:

- Building an HTTP API → [http-server.md](http-server.md)
- Building a TCP service → [socket-server.md](socket-server.md)
- Building a WebSocket service → [websocket-server.md](websocket-server.md)
- Copy-paste-ready examples → [examples.md](examples.md)
