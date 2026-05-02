# Router Examples

## Basic REST routes

```javascript
const { Router, success, failed } = require('@axiosleo/koapp');

const router = new Router('/api');

router.get('/hello', async () => {
  success({ message: 'Hello, world!' });
});

router.post('/users', async (context) => {
  success({ created: context.body });
}, {
  body: {
    rules: {
      name: 'required|string',
      email: 'required|email'
    }
  }
});

router.put('/users/{:id}', async (context) => {
  success({ id: Number(context.params.id), body: context.body });
});

router.delete('/users/{:id}', async (context) => {
  success({ deleted: context.params.id });
});

router.any('/multi', async (context) => {
  success({ method: context.method });
});
```

## Path parameters

```javascript
router.get('/a/{:a}/b/{:b}', async (context) => {
  success({ params: context.params });
});

router.get('/users/{:id}/posts/{:postId}', async (context) => {
  const { id, postId } = context.params;
  success({ userId: id, postId });
});
```

## Multi-method match

```javascript
router.push('get|post', '/search', async (context) => {
  const term = context.query.q || context.body.q;
  success({ hits: [], term });
});
```

## Nested routers and shared middlewares

```javascript
const root = new Router(null, {
  middlewares: [
    async (context) => {
      console.log(`[${context.method}] ${context.pathinfo}`);
    }
  ],
  afters: [
    async (context) => {
      console.log('response:', context.response);
    }
  ]
});

const users = new Router('/users');
users.get('/{:id}', async (context) => success({ id: context.params.id }));
users.post('/', async (context) => success({ created: context.body }));

const posts = new Router('/posts');
posts.get('/', async () => success({ list: [] }));

const api = new Router('/api/v1');
api.add(users);
api.add(posts);

root.add(api);
```

Request flow for `GET /api/v1/users/42`:

1. `root.middlewares` log the hit
2. `api`, `users` middlewares (none here)
3. `users` handler returns `success({ id: '42' })`
4. `root.afters` log the response

## Validators with custom messages

```javascript
router.push('post', '/validate/{:param1}/{:param2}', async (context) => {
  success({
    params: context.params,
    query: context.query,
    body: context.body
  });
}, {
  params: {
    rules: { param1: 'required', param2: 'required' }
  },
  query: {
    rules: { a: 'required', b: 'integer' }
  },
  body: {
    rules: { bodyA: 'required', bodyB: 'integer' },
    messages: { required: 'The :attribute field is required.' }
  }
});
```

A bad request like `POST /validate/x/y?a=hi&b=not-int` with
`{"bodyA":"","bodyB":"oops"}` yields:

```json
{
  "request_id": "...",
  "code": "400",
  "message": "Bad Request",
  "data": null
}
```

## Auth middleware on a sub-tree only

```javascript
const authed = new Router('/admin', {
  middlewares: [
    async (context) => {
      const token = context.koa.request.headers['authorization'];
      if (token !== 'Bearer secret') {
        const { error } = require('@axiosleo/koapp');
        error(401, 'Unauthorized');
      }
    }
  ]
});

authed.get('/dashboard', async () => success({ secret: 42 }));
authed.get('/users', async () => success({ users: [] }));

const root = new Router('/');
root.add(authed);
```

Only requests under `/admin/*` run the auth middleware.

## Catch-all fallback

```javascript
const root = new Router(null);
root.get('/api/users', listUsers);
root.get('/api/posts', listPosts);

root.any('/***', async () => {
  const { result } = require('@axiosleo/koapp');
  result('<h1>404</h1>', 404, { 'Content-Type': 'text/html' });
});
```

## Dynamic registration

```javascript
function registerCrud(root, name, controller) {
  const r = new Router(`/${name}`);
  r.get('/{:id}', (ctx) => controller.find(ctx));
  r.get('/', (ctx) => controller.list(ctx));
  r.post('/', (ctx) => controller.create(ctx));
  r.put('/{:id}', (ctx) => controller.update(ctx));
  r.delete('/{:id}', (ctx) => controller.remove(ctx));
  root.add(r);
}

const api = new Router('/api/v1');
registerCrud(api, 'users', usersController);
registerCrud(api, 'posts', postsController);
```
