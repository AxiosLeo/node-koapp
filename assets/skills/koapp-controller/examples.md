# Controller Examples

## Minimal controller

```javascript
const { Controller, Router, KoaApplication } = require('@axiosleo/koapp');

class HelloController extends Controller {
  async sayHi(context) {
    const name = context.query.name || 'world';
    this.success({ message: `Hello, ${name}!` });
  }
}

const hello = new HelloController();
const router = new Router('/hello');
router.get('/', (ctx) => hello.sayHi(ctx));

const app = new KoaApplication({ port: 8088, routers: [router] });
app.start();
```

## Shared state via constructor

```javascript
class UsersController extends Controller {
  constructor(db) {
    super();
    this.db = db;
  }

  async find(context) {
    const id = Number(context.params.id);
    if (!Number.isInteger(id)) this.error(400, 'Invalid id');
    const user = await this.db.findUser(id);
    if (!user) this.error(404, 'User Not Found');
    this.success(user);
  }

  async create(context) {
    const user = await this.db.createUser(context.body);
    this.success({ id: user.id });
  }

  async remove(context) {
    const id = Number(context.params.id);
    await this.db.deleteUser(id);
    this.success({ removed: id });
  }
}

const controller = new UsersController(myDb);
const router = new Router('/users');
router.get('/{:id}', (ctx) => controller.find(ctx));
router.post('/', (ctx) => controller.create(ctx));
router.delete('/{:id}', (ctx) => controller.remove(ctx));
```

## Base controller with project-wide helpers

```javascript
const { Controller } = require('@axiosleo/koapp');
const { mainDB } = require('../services/db');

class BaseController extends Controller {
  constructor() {
    super();
    this.mainDB = mainDB;
  }

  ensureAuth(context) {
    const user = context.koa.session.user;
    if (!user) {
      this.error(401, 'Please log in');
    }
    return user;
  }
}

class PostsController extends BaseController {
  async publish(context) {
    const user = this.ensureAuth(context);
    const post = await this.mainDB.table('posts').insert({
      author_id: user.id,
      title: context.body.title,
      body: context.body.body
    });
    this.success({ id: post.insertId });
  }
}
```

## CRUD controller + validators

```javascript
class ProductsController extends Controller {
  async find(context) {
    const id = Number(context.params.id);
    const item = await db.table('products').where('id', id).find();
    if (!item) this.error(404, 'Not Found');
    this.success(item);
  }

  async create(context) {
    const res = await db.table('products').insert(context.body);
    res.insertId
      ? this.success({ id: res.insertId })
      : this.failed(context.body, '500;Create Failed', 500);
  }

  async update(context) {
    const id = Number(context.params.id);
    const res = await db.table('products').where('id', id).update(context.body);
    res.affectedRows || res.changedRows
      ? this.success({ updated: id })
      : this.failed({ id }, '500;Update Failed', 500);
  }

  async remove(context) {
    const id = Number(context.params.id);
    const res = await db.table('products').where('id', id).delete();
    res.affectedRows
      ? this.success({ removed: id })
      : this.failed({ id }, '500;Delete Failed', 500);
  }
}

const products = new ProductsController();
const router = new Router('/products');

router.get('/{:id}', (ctx) => products.find(ctx), {
  params: { rules: { id: 'required|integer' } }
});
router.post('/', (ctx) => products.create(ctx), {
  body: {
    rules: {
      name: 'required|string',
      price: 'required|numeric|min:0'
    }
  }
});
router.put('/{:id}', (ctx) => products.update(ctx), {
  params: { rules: { id: 'required|integer' } }
});
router.delete('/{:id}', (ctx) => products.remove(ctx), {
  params: { rules: { id: 'required|integer' } }
});
```

## Logging through this.log

```javascript
class OrdersController extends Controller {
  async place(context) {
    this.log('placing order', context.body);
    const order = await submitOrder(context.body);
    this.log('order id', order.id);
    this.success({ id: order.id });
  }
}
```

Enable debug output by launching the app with `debug: true` or the env
variable expected by `@axiosleo/cli-tool`'s `debug.log`.

## Sharing a controller across HTTP and Socket

A controller does not care about the transport; as long as the context has
the fields you need, the same method works:

```javascript
class ChatController extends Controller {
  async send(context) {
    const { body } = context;
    await saveMessage(body);
    context.app.broadcast({ from: context.connection_id, body }, 'chat', 0, null);
    this.success({ sent: true });
  }
}

const chat = new ChatController();

// HTTP mount
httpRouter.post('/chat', (ctx) => chat.send(ctx));

// WebSocket mount
wsRouter.any('/chat/{:room}', (ctx) => chat.send(ctx));
```

## Testing a controller in isolation

```javascript
const { expect } = require('chai');
const { HttpResponse } = require('@axiosleo/koapp');

it('returns 200 with payload', async () => {
  const controller = new HelloController();
  const fakeContext = { query: { name: 'Alice' } };
  try {
    await controller.sayHi(fakeContext);
  } catch (err) {
    expect(err).to.be.instanceOf(HttpResponse);
    expect(err.status).to.equal(200);
    expect(err.data.message).to.equal('Hello, Alice!');
    return;
  }
  throw new Error('expected throw');
});
```

Because helpers throw, use `try/catch` in unit tests and inspect the
`HttpResponse` instance.
