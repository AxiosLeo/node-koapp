# Model Examples

## Simple validated model

```javascript
const { Model } = require('@axiosleo/koapp');

const user = new Model({
  name: 'Alice',
  email: 'alice@example.com'
}, {
  name: 'required|string',
  email: 'required|email'
});

console.log(user.name);      // 'Alice'
console.log(user.toObj());   // { name: 'Alice', email: 'alice@example.com' }
console.log(user.toJson());  // '{"name":"Alice","email":"alice@example.com"}'
console.log(user.properties()); // ['name', 'email']
console.log(user.count());   // 2
```

## Validation failure short-circuits

```javascript
try {
  new Model({}, { email: 'required|email' });
} catch (err) {
  console.log(err.name);    // 'Error' (HttpError class)
  console.log(err.status);  // 400
  console.log(err.message); // 'The email field is required.'
}
```

Inside a router handler:

```javascript
router.post('/sign-up', async (context) => {
  Model.create(context.body, {
    email: 'required|email',
    password: 'required|min:8'
  });
  // Only runs if rules pass; otherwise the framework returns 400 automatically.
  const { success } = require('@axiosleo/koapp');
  success({ ok: true });
});
```

## Custom messages

```javascript
Model.create(context.body, {
  username: 'required|alpha_num|min:3|max:16'
}, {
  required: 'Please choose a :attribute.',
  'min.string': ':attribute must be at least :min characters.'
});
```

## Subclassing for domain logic

```javascript
class ProductModel extends Model {
  constructor(data) {
    super(data, {
      name: 'required|string|min:1|max:128',
      price: 'required|numeric|min:0',
      currency: 'required|in:USD,EUR,GBP,CNY'
    });
  }

  get priceLabel() {
    return `${this.price.toFixed(2)} ${this.currency}`;
  }
}

router.post('/products', async (context) => {
  const product = new ProductModel(context.body);
  await db.table('products').insert(product.toObj());
  const { success } = require('@axiosleo/koapp');
  success({ label: product.priceLabel });
});
```

## Manual validation without throwing

```javascript
const m = new Model({ email: 'nope', age: 'old' });

const v = m.validate({
  email: 'required|email',
  age: 'integer|min:0'
});

if (v.fails()) {
  const errors = v.errors.all();
  // { email: [...], age: [...] }
  const { failed } = require('@axiosleo/koapp');
  failed({ errors }, '400;Bad Data', 400);
}
```

Use this when you need every failure (not just the first).

## Nesting

```javascript
const addr = new Model({ city: 'Springfield', zip: '12345' });
const user = new Model({ name: 'Alice', addr });

console.log(user.toObj());
// { name: 'Alice', addr: { city: 'Springfield', zip: '12345' } }
```

`toObj()` flattens nested models into plain objects.

## Reusing rules across requests

```javascript
const USER_RULES = {
  name: 'required|string|min:1|max:64',
  email: 'required|email',
  role: 'in:admin,user,guest'
};

router.post('/users', async (context) => {
  Model.create(context.body, USER_RULES);
  const { success } = require('@axiosleo/koapp');
  success({ ok: true });
});

router.put('/users/{:id}', async (context) => {
  Model.create(context.body, USER_RULES);
  const { success } = require('@axiosleo/koapp');
  success({ ok: true });
});
```

Factor rule constants out so POST and PUT share the same schema.

## Property introspection

```javascript
const m = new Model({ name: 'Alice', email: 'a@b.com' });

m.properties().forEach((key) => {
  console.log(key, '=', m[key]);
});
// name = Alice
// email = a@b.com

console.log(m.count()); // 2
```

Useful when you want to iterate over fields without knowing them ahead
of time (e.g. for dynamic form builders).

## Hiding fields before serialization

```javascript
class SafeUserModel extends Model {
  constructor(data) {
    super(data, { email: 'required|email', password: 'required|min:8' });
  }

  toObj() {
    const raw = super.toObj();
    delete raw.password;
    return raw;
  }
}

const { success } = require('@axiosleo/koapp');
const u = new SafeUserModel(context.body);
success(u.toObj()); // password stripped
```
