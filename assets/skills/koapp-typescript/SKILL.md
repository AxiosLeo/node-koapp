---
name: koapp-typescript
description: Write type-safe @axiosleo/koapp code in TypeScript - typed contexts (KoaContext, ContextFromSpec, RequiredContext, SocketContext, WebSocketContext), Router generics, ContextHandler middlewares, module augmentation, typed file uploads with @koa/multer, response helper generics, and typed application configs. Use when a koapp project uses TypeScript, when typing context.params/body/query, annotating route handlers or controllers, typing uploaded files, or importing types from @axiosleo/koapp.
---

# @axiosleo/koapp in TypeScript

Source of truth: [`index.d.ts`](../../../index.d.ts) at the package root.

The framework ships a full generic type system. This skill covers what is
importable, how to type contexts and handlers, and the recipes for cases the
generics do not cover directly (file uploads, extending the context).

## Setup

```bash
npm install -D typescript @types/koa @types/node
# for file uploads:
npm install @koa/multer && npm install -D @types/koa__multer
```

`@types/koa` must be a direct devDependency: `index.d.ts` and
`@types/koa__multer` both resolve `koa` types, and they must land on the
same installed copy for `context.koa` typing and the multer module
augmentation to line up.

## Importable symbols

All of these come straight from `import { ... } from '@axiosleo/koapp'`:

| Category | Symbols |
| --- | --- |
| Classes | `KoaApplication`, `SocketApplication`, `WebSocketApplication`, `Application`, `Router`, `Controller`, `Model`, `HttpResponse`, `HttpError`, `SocketClient` |
| Context types | `KoaContext`, `AppContext`, `ContextFromSpec`, `RequiredContext`, `SocketContext`, `WebSocketContext`, `ContextDataSpec`, `ContextHandler` |
| Router types | `RouterOptions`, `RouterInfo`, `RouterValidator`, `ValidatorConfig`, `HttpMethod` |
| Config types | `AppConfiguration`, `TypedAppConfiguration`, `KoaApplicationConfig`, `TypedKoaApplicationConfig`, `SocketAppConfiguration`, `TypedSocketAppConfiguration`, `WebSocketAppConfiguration`, `TypedWebSocketAppConfiguration`, `PingConfig`, `HttpResponseConfig` |
| Response / SSE | `StatusCode`, `IKoaSSE`, `IKoaSSEvent`, `SSEOptions` |
| Functions | `success`, `failed`, `result`, `response`, `error`, `initContext`, `middlewares.KoaSSEMiddleware` |

On `@axiosleo/koapp` **1.3.1 and earlier** the context/router/config types
above (everything except `ContextFromSpec`, `RequiredContext`,
`SocketContext`, `WebSocketContext` and the `*ApplicationConfig` family)
were not exported; recover the context type there with
`type KoaCtx = Router extends Router<infer C> ? C : never;`.

## Typing contexts: pick the right tool

| Approach | Data typing | `context.koa` | When |
| --- | --- | --- | --- |
| Default inference (`new Router()`) | loose (`params?`, `body: any`) | fully typed (incl. `sse`) | quick handlers, SSE, redirects |
| `KoaContext<P, B, Q>` | typed but optional (`params?.`) | fully typed | HTTP handlers touching `koa` |
| `KoaContext<P, B, Q> & { params: P; body: B; query: Q }` | strict, required | fully typed | uploads, sessions + typed data - **preferred for HTTP** |
| `ContextFromSpec<{...}>` | strict, required, object-style | `any` (via index signature) | transport-agnostic data handlers |
| `RequiredContext<P, B, Q>` | strict, positional | `any` | same, positional style |
| `SocketContext<P, B, Q>` / `WebSocketContext<P, B, Q>` | strict via generics | n/a (`socket` instead) | TCP / WebSocket handlers |

Define the required-props HTTP variant once and reuse it:

```typescript
import { Router, KoaContext, success } from '@axiosleo/koapp';

type HttpContext<P = Record<string, string>, B = any, Q = any> =
  KoaContext<P, B, Q> & { params: P; body: B; query: Q };

type CreateUserContext = HttpContext<
  { id: string },
  { name: string; email: string; age?: number },
  { format?: 'json' | 'xml' }
>;

const router = new Router('/api');

router.post<CreateUserContext>('/users/{:id}', async (context) => {
  const id = context.params.id;        // string - required, no ?.
  const name = context.body.name;      // string
  const format = context.query.format; // 'json' | 'xml' | undefined
  context.koa.set('X-Handled-By', 'user-service'); // koa fully typed
  success({ id, name, format });
});
```

`ContextFromSpec` is the object-style alternative (order-free, declare only
what you need) when the handler never touches `context.koa`:

```typescript
import { ContextFromSpec } from '@axiosleo/koapp';

type SearchContext = ContextFromSpec<{ body: { q: string } }>;
```

## Three levels of Router generics

```typescript
// 1. Router-level: every handler on this router gets the type
const productRouter = new Router<ProductContext>('/products');

// 2. Per-route override: any route can use its own context type
router.get<UserContext>('/profile/{:id}', async (context) => { /* ... */ });

// 3. Sub-router with a different context via router.new<U>()
const admin = router.new<AdminContext>('/admin', {
  middlewares: [async (context) => { /* typed as AdminContext */ }],
});
```

Validators attach per-route as the third argument, same as JavaScript:

```typescript
router.post<CreateUserContext>('/users/{:id}', handler, {
  params: { rules: { id: 'required|integer' } },
  body: { rules: { name: 'required|string', email: 'required|email' } },
});
```

## Typed shared middlewares

`ContextHandler<T>` (default `T = KoaContext`) is the type of every
middleware, handler, and after-handler:

```typescript
import { Router, error } from '@axiosleo/koapp';
import type { ContextHandler } from '@axiosleo/koapp';

const requestLogger: ContextHandler = async (context) => {
  console.log(`[${context.method}] ${context.pathinfo}`);
};

const requireAuth: ContextHandler = async (context) => {
  if (!context.koa.session?.user) {
    error(401, 'Unauthorized');
  }
};

const secured = new Router('/secure', {
  middlewares: [requestLogger, requireAuth],
});
```

## Extending KoaContext (module augmentation)

`KoaContext` is an exported interface, so middlewares can attach their own
typed properties to it - the monorepo scaffold's auth middleware uses
exactly this pattern:

```typescript
import { error } from '@axiosleo/koapp';
import type { ContextHandler } from '@axiosleo/koapp';

export interface AuthInfo {
  userId: string;
  isAdmin?: boolean;
}

declare module '@axiosleo/koapp' {
  interface KoaContext {
    auth?: AuthInfo;
  }
}

export const authMiddleware: ContextHandler = async (context) => {
  const header = context.headers?.authorization;
  if (!header) {
    error(401, 'Unauthorized');
  }
  context.auth = { userId: 'u_1' }; // typed as AuthInfo | undefined
};
```

Every handler in the project now sees `context.auth` with full typing.

## Typed file uploads

Uploaded files live on `context.koa.request.files`, **not** on
`context.body` - the `TBody` generic never covers them. Use the
`HttpContext` helper so both the data and `koa` are typed:

```typescript
import multer from '@koa/multer';
import { Router, KoaContext, success, failed } from '@axiosleo/koapp';

type HttpContext<P = Record<string, string>, B = any, Q = any> =
  KoaContext<P, B, Q> & { params: P; body: B; query: Q };

type UploadContext = HttpContext<{ dir: string }>;

router.post<UploadContext>('/upload/{:dir}', async (context) => {
  const upload = multer({ storage: multer.memoryStorage() });
  await upload.any()(context.koa, async () => {});

  // files: { [field: string]: File[] } | File[] | undefined - narrow it
  const files = context.koa.request.files;
  const first = Array.isArray(files) ? files[0] : undefined;
  if (!first) {
    failed({}, '400;Bad Data', 400);
  }
  success({ dir: context.params.dir, name: first.originalname });
});
```

With `upload.single('avatar')` the file is at `context.koa.request.file`
(type `multer.File`). See [examples.md](examples.md) for the full recipes.

## Response helpers: generics and never

All helpers are generic and return `never` - TypeScript knows execution
stops there, so calls double as type guards:

```typescript
const user = await findUser(id); // User | null
if (!user) {
  failed({ id }, '404;Not Found', 404);
}
user.name; // user narrowed to User - no ! needed
success<User>(user);
```

The `StatusCode` type accepts any `"<number>;<text>"` string; presets like
`'200;Success'`, `'404;Not Found'`, `'409;Data Already Exists'` are listed
in **koapp-response**.

## Typed application configs

```typescript
import {
  KoaApplication, Router,
  type KoaApplicationConfig, type TypedKoaApplicationConfig,
} from '@axiosleo/koapp';

const config: KoaApplicationConfig = {
  listen_host: '0.0.0.0',
  port: 8080,
  routers: [router], // mixed Router<...> types allowed
};
new KoaApplication(config).start();

// Strict variant: all routers must match the given type
type UserRouter = Router<CreateUserContext>;
const strict: TypedKoaApplicationConfig<UserRouter[]> = {
  listen_host: 'localhost',
  port: 8081,
  routers: [userRouter1, userRouter2],
};
```

`SocketAppConfiguration` adds `port` + `ping`; `WebSocketAppConfiguration`
additionally accepts every `ws` `ServerOptions` field (`maxPayload`,
`clientTracking`, ...).

## Common pitfalls

- Retype data via the **generic** form: `KoaContext<P, B, Q> & { params: P; ... }`
  works, but intersecting the default-parameterized alias
  (`KoaCtx & { body: B }`) collapses to `any` because the default `body` is
  already `any`.
- Do not `Omit<KoaContext, 'body'>` - the base context carries a
  `[key: string]: any` index signature that makes `Omit` drop every named
  property.
- That same index signature means typos like `context.bodyy` compile
  silently as `any`. Prefer strictly typed contexts so real fields are
  checked.
- Uploaded files are never in `TBody`; type them through `context.koa`
  (see above).
- Two copies of `@types/koa` in the dependency tree make
  `context.koa.request.files` "not exist" - install `@types/koa` directly
  so everything resolves to one copy.
- `initContext` (custom transports) is exported and generic; it is an
  advanced escape hatch and rarely needed - see `index.d.ts` if you build
  your own transport.

## See also

- Copy-paste TypeScript recipes: [examples.md](examples.md)
- Route/validator basics (JavaScript): **koapp-router**
- Building and configuring servers: **koapp-apps**
- Response helpers and status codes: **koapp-response**
