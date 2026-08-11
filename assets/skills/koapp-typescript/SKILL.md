---
name: koapp-typescript
description: Write type-safe @axiosleo/koapp code in TypeScript - typed contexts (ContextFromSpec, RequiredContext, SocketContext, WebSocketContext), Router generics, reusable typed middlewares, typed file uploads with @koa/multer, response helper generics, and typed application configs. Use when a koapp project uses TypeScript, when typing context.params/body/query, annotating route handlers or controllers, typing uploaded files, or importing types from @axiosleo/koapp.
---

# @axiosleo/koapp in TypeScript

Source of truth: [`index.d.ts`](../../../index.d.ts) at the package root.

The framework ships a full generic type system. This skill covers what is
importable, how to type contexts and handlers, and the recipes for cases the
generics do not cover directly (file uploads, shared middlewares).

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

## What is (and is not) importable

Importable from `@axiosleo/koapp`:

| Category | Symbols |
| --- | --- |
| Classes | `KoaApplication`, `SocketApplication`, `WebSocketApplication`, `Application`, `Router`, `Controller`, `Model`, `HttpResponse`, `HttpError`, `SocketClient` |
| Context types | `ContextFromSpec`, `RequiredContext`, `SocketContext`, `WebSocketContext` |
| Config types | `KoaApplicationConfig`, `TypedKoaApplicationConfig`, `SocketAppConfiguration`, `TypedSocketAppConfiguration`, `WebSocketAppConfiguration`, `TypedWebSocketAppConfiguration`, `PingConfig`, `HttpResponseConfig` |
| Functions | `success`, `failed`, `result`, `response`, `error`, `initContext`, `middlewares.KoaSSEMiddleware` |

**Not exported** (internal to `index.d.ts`): `KoaContext`, `AppContext`,
`ContextHandler`, `RouterOptions`, `RouterInfo`, `StatusCode`,
`AppConfiguration`. You cannot `import { KoaContext }` - use the recipes
below instead. Handlers on a plain `new Router()` still infer the full
`KoaContext` shape automatically, so this mostly matters when you want to
*name* a type.

## Typing contexts: pick the right tool

| Approach | Data typing | `context.koa` | When |
| --- | --- | --- | --- |
| Default inference (`new Router()`) | loose (`params?`, `body: any`) | fully typed (incl. `sse`) | quick handlers, SSE, redirects |
| `ContextFromSpec<{...}>` | strict, required, no `?.` | `any` (via index signature) | most HTTP data handlers - **preferred** |
| `RequiredContext<P, B, Q>` | strict, positional generics | `any` | same, if you prefer positional style |
| `ContextFromSpec<...> & { koa: ParameterizedContext }` | strict | fully typed | uploads, sessions, streaming with typed data |
| `SocketContext<P, B, Q>` / `WebSocketContext<P, B, Q>` | strict via generics | n/a (`socket` instead) | TCP / WebSocket handlers |

`ContextFromSpec` takes an object spec - order-free, declare only what you
need:

```typescript
import { Router, ContextFromSpec, success } from '@axiosleo/koapp';

type CreateUserContext = ContextFromSpec<{
  params: { id: string };
  body: { name: string; email: string; age?: number };
  query: { format?: 'json' | 'xml' };
}>;

const router = new Router('/api');

router.post<CreateUserContext>('/users/{:id}', async (context) => {
  const id = context.params.id;      // string - required, no ?.
  const name = context.body.name;    // string
  const format = context.query.format; // 'json' | 'xml' | undefined
  success({ id, name, format });
});
```

`RequiredContext<P, B, Q>` is the positional equivalent; `P` and `Q` must
extend `Record<string, string>` (optional string-literal props are fine).

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

## Naming the full KoaContext (shared middlewares)

`ContextHandler` and `KoaContext` are not exported, but the context type can
be recovered from `Router`'s default generic:

```typescript
import { Router } from '@axiosleo/koapp';

/** The framework's KoaContext - koa, url, sse and all */
type KoaCtx = Router extends Router<infer C> ? C : never;

const authMiddleware = async (context: KoaCtx): Promise<void> => {
  if (!context.koa.session?.user) {
    // throw a response, see koapp-response
  }
};

const secured = new Router('/secure', { middlewares: [authMiddleware] });
```

Do **not** try `Omit<KoaCtx, 'body'> & { body: B }` to retype the data
properties - the base context carries a `[key: string]: any` index
signature that breaks `Omit`. Use `ContextFromSpec` for typed data instead.

## Typed file uploads

Uploaded files live on `context.koa.request.files`, **not** on
`context.body` - the `TBody` generic never covers them. Intersect a typed
`koa` onto the spec so the multer augmentation applies:

```typescript
import multer from '@koa/multer';
import type { ParameterizedContext } from 'koa';
import { Router, ContextFromSpec, success, failed } from '@axiosleo/koapp';

type UploadContext = ContextFromSpec<{
  params: { dir: string };
}> & { koa: ParameterizedContext };

router.post<UploadContext>('/upload/{:dir}', async (context) => {
  const upload = multer({ storage: multer.memoryStorage() });
  await upload.any()(context.koa, async () => {});

  // files: { [field: string]: File[] } | File[] | undefined - narrow it
  const files = context.koa.request.files;
  const first = Array.isArray(files) ? files[0] : undefined;
  if (!first) {
    failed({}, '400;Bad Data', 400);
  }
  success({ name: first.originalname, size: first.size });
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

The status-code parameter accepts any `"<number>;<text>"` string; presets
like `'200;Success'`, `'404;Not Found'`, `'409;Data Already Exists'` are
listed in **koapp-response**.

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

- `import { KoaContext }` fails - the type is not exported. Use default
  inference, `ContextFromSpec`, or the `infer` recipe above.
- The base context has `[key: string]: any`, so typos like `context.bodyy`
  compile silently as `any`. Prefer `ContextFromSpec` so real fields are
  strictly typed.
- Intersecting onto the inferred `KoaCtx` (`KoaCtx & { body: B }`) does not
  retype `body` - `any & B` collapses to `any`.
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
