# TypeScript Examples

Copy-paste-ready recipes. All snippets compile under `strict` mode with
`esModuleInterop` enabled and `@types/koa` installed (see SKILL.md Setup).

## Typed CRUD router

```typescript
import { Router, ContextFromSpec, success, failed } from '@axiosleo/koapp';

interface UserRow {
  id: number;
  name: string;
  email: string;
}

type ListContext = ContextFromSpec<{
  query: { page?: string; sort?: 'asc' | 'desc' };
}>;

type CreateContext = ContextFromSpec<{
  body: { name: string; email: string; age?: number };
}>;

type ItemContext = ContextFromSpec<{
  params: { id: string };
}>;

type UpdateContext = ContextFromSpec<{
  params: { id: string };
  body: { name?: string; email?: string };
}>;

const users = new Router('/users');

users.get<ListContext>('/', async (context) => {
  const page = Number(context.query.page ?? 1);
  const sort = context.query.sort ?? 'asc';
  success({ page, sort, items: [] as UserRow[] });
});

users.post<CreateContext>('/', async (context) => {
  const row: UserRow = { id: 1, ...context.body };
  success<UserRow>(row);
}, {
  body: {
    rules: { name: 'required|string', email: 'required|email' },
    messages: { required: 'The :attribute field is required.' },
  },
});

users.get<ItemContext>('/{:id}', async (context) => {
  const id = Number(context.params.id);
  if (Number.isNaN(id)) {
    failed({ id: context.params.id }, '400;Bad Data', 400);
  }
  success({ id });
}, {
  params: { rules: { id: 'required|integer' } },
});

users.put<UpdateContext>('/{:id}', async (context) => {
  success({ id: context.params.id, changes: context.body });
});

users.delete<ItemContext>('/{:id}', async (context) => {
  success({ deleted: context.params.id });
});
```

## File uploads

Files never appear in `TBody`; they live on `context.koa.request.files`
(`@koa/multer` + `@types/koa__multer`). Use the required-props `KoaContext`
helper so both the route data and `koa` are fully typed:

```typescript
import multer from '@koa/multer';
import { Router, KoaContext, success, failed } from '@axiosleo/koapp';

type HttpContext<P = Record<string, string>, B = any, Q = any> =
  KoaContext<P, B, Q> & { params: P; body: B; query: Q };

const router = new Router('/files');

// Multiple files: upload.any() -> request.files needs narrowing
type UploadContext = HttpContext<{ dir: string }, any, { overwrite?: string }>;

router.post<UploadContext>('/upload/{:dir}', async (context) => {
  const upload = multer({ storage: multer.memoryStorage() });
  await upload.any()(context.koa, async () => {});

  // { [field: string]: File[] } | File[] | undefined
  const files = context.koa.request.files;
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) {
    failed({}, '400;Bad Data', 400);
  }
  success({
    dir: context.params.dir,
    uploaded: list.map((f) => ({
      name: f.originalname,
      mime: f.mimetype,
      size: f.size,
    })),
  });
});

// Single file: upload.single(field) -> request.file (multer.File)
type AvatarContext = HttpContext<{ userId: string }>;

router.post<AvatarContext>('/avatar/{:userId}', async (context) => {
  const upload = multer({ storage: multer.memoryStorage() });
  await upload.single('avatar')(context.koa, async () => {});

  const file: multer.File = context.koa.request.file;
  const buffer: Buffer = file.buffer; // memoryStorage keeps it in RAM
  success({ userId: context.params.userId, size: buffer.length });
});

// Echo a file back as a download
router.post<AvatarContext>('/echo/{:userId}', async (context) => {
  const upload = multer({ storage: multer.memoryStorage() });
  await upload.single('file')(context.koa, async () => {});
  const file = context.koa.request.file;
  context.koa.set('content-type', file.mimetype);
  context.koa.body = file.buffer;
  context.koa.attachment(file.originalname);
});
```

## Reusable typed middleware

`ContextHandler<T>` (default `T = KoaContext`) types any middleware,
handler, or after-handler:

```typescript
import { Router, error } from '@axiosleo/koapp';
import type { ContextHandler } from '@axiosleo/koapp';

const requestLogger: ContextHandler = async (context) => {
  console.log(`[${context.method}] ${context.pathinfo}`);
};

const requireAuth: ContextHandler = async (context) => {
  const token = context.headers?.authorization;
  if (!token) {
    error(401, 'Unauthorized');
  }
};

const api = new Router('/api', {
  middlewares: [requestLogger],
  afters: [
    async (context) => {
      console.log('responded:', context.response?.status);
    },
  ],
});

const secured = api.new('/admin', { middlewares: [requireAuth] });
```

## Extending KoaContext (module augmentation)

Attach typed properties to the context from a middleware - the same
pattern the monorepo scaffold uses for Bearer auth:

```typescript
import { error } from '@axiosleo/koapp';
import type { ContextHandler } from '@axiosleo/koapp';

export interface AuthContext {
  app_id: string | null;
  key_id: string;
  is_admin?: boolean;
}

declare module '@axiosleo/koapp' {
  interface KoaContext {
    auth?: AuthContext;
  }
}

export const authMiddleware: ContextHandler = async (context) => {
  const header = context.headers?.authorization;
  if (!header || typeof header !== 'string') {
    error(401, 'Unauthorized');
  }
  const match = /^Bearer\s+(.+)$/i.exec(header as string);
  if (!match) {
    error(401, 'Unauthorized');
  }
  context.auth = { app_id: null, key_id: match![1].trim() };
};

// Downstream handlers see the typed property:
const whoami: ContextHandler = async (context) => {
  console.log(context.auth?.key_id); // string | undefined
};
```

## Controllers in TypeScript

```typescript
import { Controller, Router, ContextFromSpec } from '@axiosleo/koapp';

type FindContext = ContextFromSpec<{ params: { id: string } }>;
type CreateContext = ContextFromSpec<{
  body: { name: string; email: string };
}>;

interface UserRow {
  id: number;
  name: string;
}

class UserController extends Controller {
  async find(context: FindContext): Promise<void> {
    this.log('finding user', context.params.id);
    const row: UserRow = { id: Number(context.params.id), name: 'Alice' };
    this.success<UserRow>(row);
  }

  async create(context: CreateContext): Promise<void> {
    const exists = false; // await this.db...
    if (exists) {
      this.failed(
        { email: context.body.email },
        '409;Data Already Exists',
        409,
      );
    }
    this.success({ created: context.body.name });
  }
}

const controller = new UserController();
const router = new Router('/users');

// Arrow wrappers keep `this` bound (same rule as JavaScript)
router.get<FindContext>('/{:id}', async (context) => controller.find(context));
router.post<CreateContext>('/', async (context) => controller.create(context));
```

## Models in TypeScript

Declare properties with `!` (they are assigned by the base constructor, not
in the subclass body):

```typescript
import { Model, ContextFromSpec, Router, success } from '@axiosleo/koapp';

class UserModel extends Model {
  name!: string;
  email!: string;
  age?: number;
}

type SignUpContext = ContextFromSpec<{
  body: { name: string; email: string; age?: number };
}>;

const router = new Router('/auth');

router.post<SignUpContext>('/sign-up', async (context) => {
  // Throws a 400 response on invalid data
  const user = Model.create<UserModel>(context.body, {
    name: 'required|string',
    email: 'required|email',
    age: 'integer|min:0',
  });
  success({ name: user.name, email: user.email });
});

// Manual validation without throwing
const draft = new UserModel({ name: 'a', email: 'not-an-email' });
const validator = draft.validate({ email: 'required|email' });
if (validator.fails()) {
  console.log(validator.errors.all());
}
```

## Typed Socket / WebSocket servers

`SocketContext` and `WebSocketContext` are exported directly:

```typescript
import {
  Router,
  SocketApplication,
  WebSocketApplication,
  SocketContext,
  WebSocketContext,
  success,
} from '@axiosleo/koapp';

// TCP: frames end with the @@@@@@ delimiter
type ChatContext = SocketContext<
  { room: string },
  { message: string; type: 'text' | 'image' },
  { token?: string }
>;

const chatRouter = new Router<ChatContext>('/chat');
chatRouter.any('/{:room}', async (context) => {
  const room = context.params?.room;
  const message = context.body?.message;
  context.app.broadcast({ room, message, from: context.connection_id }, 'chat', 0);
  success({});
});

new SocketApplication({
  port: 8082,
  routers: [chatRouter],
  ping: { open: true, interval: 30000, data: 'ping' },
}).start();

// WebSocket: plain JSON frames
type WsContext = WebSocketContext<
  { channel: string },
  { event: string; data: unknown },
  { token?: string }
>;

const wsRouter = new Router<WsContext>('/ws');
wsRouter.any('/{:channel}', async (context) => {
  context.socket.send(JSON.stringify({ ack: true }));
  context.app.sendByConnectionId(context.connection_id, { ok: true });
  success({});
});

new WebSocketApplication({
  port: 8083,
  routers: [wsRouter],
  maxPayload: 1024 * 1024, // ws ServerOptions fields are accepted
  clientTracking: true,
}).start();
```

## Typed application startup

```typescript
import {
  KoaApplication,
  Router,
  ContextFromSpec,
  type KoaApplicationConfig,
  type TypedKoaApplicationConfig,
} from '@axiosleo/koapp';

type UserContext = ContextFromSpec<{ params: { id: string } }>;
const userRouter = new Router<UserContext>('/users');

// Flexible: routers with different context types can mix
const config: KoaApplicationConfig = {
  listen_host: '0.0.0.0',
  port: 8080,
  debug: false,
  routers: [userRouter],
  session: { maxAge: 1296000000, httpOnly: true, signed: true },
  static: { rootDir: './public' },
};
new KoaApplication(config).start();

// Strict: every router must be the same Router<...> type
type UserRouter = Router<UserContext>;
const strictConfig: TypedKoaApplicationConfig<UserRouter[]> = {
  listen_host: 'localhost',
  port: 8081,
  routers: [userRouter],
};
```

## SSE in TypeScript

Use default inference - the inferred context already types
`context.koa.sse` (as optional, hence the `!` after the middleware ran):

```typescript
import { Router, middlewares } from '@axiosleo/koapp';

const router = new Router('/events');

router.any('/sse', async (context) => {
  const sse = middlewares.KoaSSEMiddleware();
  await sse(context.koa, async () => {});

  context.koa.sse!.send({ event: 'tick', data: { at: Date.now() } });
  context.koa.sse!.send('plain string works too');
  context.koa.sse!.close();
});
```
