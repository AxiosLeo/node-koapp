---
name: koapp-model
description: Validate and serialize structured data with the @axiosleo/koapp Model class powered by validatorjs. Use when creating typed payload objects, running rules like required/integer/email/min/max, converting between JSON and plain objects, listing properties, or automatically raising HttpError(400) on validation failure inside a koapp handler.
---

# @axiosleo/koapp Model

Source: [`src/model.js`](../../../src/model.js).

`Model` is a lightweight data container around
[validatorjs](https://github.com/mikeerickson/validatorjs). It assigns
incoming fields onto itself, optionally validates them, and provides
utility methods for serialization.

## Import

```javascript
const { Model } = require('@axiosleo/koapp');
```

## Constructor

```javascript
new Model(obj?, rules?, messages?);
```

| Arg | Type | Purpose |
| --- | --- | --- |
| `obj` | `object` | Source data; each key is copied onto the instance via `Object.assign` |
| `rules` | `Rules` | validatorjs rule set, e.g. `{ name: 'required|string' }` |
| `messages` | `ErrorMessages` | Custom error messages keyed by rule, e.g. `{ required: 'The :attribute is required.' }` |

When `rules` are provided and validation fails, the constructor throws
`HttpError(400, <first-error-message>)`. Inside a koapp handler that
translates to a standard 400 response without any extra plumbing.

## Static helper

```javascript
Model.create(obj, rules, messages);
```

Shortcut for `new Model(obj, rules, messages)` that benefits from subclass
context (same as `new this(...)`).

## Instance methods

| Method | Returns | Notes |
| --- | --- | --- |
| `toJson()` | `string` | `JSON.stringify(this)` |
| `toObj()` | `object` | `JSON.parse(this.toJson())`; strips class identity |
| `properties()` | `string[]` | Enumerable own keys |
| `count()` | `number` | `properties().length` |
| `validate(rules, messages?)` | `Validator` | Runs validatorjs manually and returns the raw Validator object |

`validate()` does not throw - use it when you need the full error map:

```javascript
const m = new Model({ email: 'not-an-email' });
const v = m.validate({ email: 'required|email' });
if (v.fails()) {
  console.log(v.errors.all()); // { email: ['The email format is invalid.'] }
}
```

## Extending Model

```javascript
class UserModel extends Model {
  constructor(data) {
    super(data, {
      name: 'required|string',
      email: 'required|email',
      age: 'integer|min:0'
    }, {
      required: 'The :attribute field is required.'
    });
  }

  greet() {
    return `Hi, ${this.name}`;
  }
}

const user = new UserModel(context.body);
// If the body fails validation, HttpError(400, ...) is thrown automatically.
```

When `user` is created successfully, `user.name`, `user.email`, `user.age`
are all available, plus any custom methods.

## Validation rules cheat sheet

Common rules from validatorjs:

```
required            - present and non-empty
string              - typeof === 'string'
integer             - integer number (accepts strings that parse)
numeric             - finite number (accepts strings)
boolean             - true/false/0/1/'0'/'1'/'true'/'false'
email               - RFC-style email
url                 - absolute URL
in:a,b,c            - value in enumerated list
not_in:a,b,c        - value not in list
min:N               - string length / number value ≥ N
max:N               - string length / number value ≤ N
between:a,b         - inclusive range
size:N              - exact length / value
regex:/pat/         - matches regex
array               - is an array
alpha               - letters only
alpha_num           - letters or digits
alpha_dash          - letters, digits, _, -
required_if:field,value
required_unless:field,value
confirmed           - pairs with `<field>_confirmation`
date                - parseable date
```

Combine with `|`: `required|string|min:3|max:64`.

## Nesting Models

`Model` instances serialize via JSON, so nesting works naturally:

```javascript
const address = new Model({
  street: '1 Main St',
  city: 'Springfield'
});

const user = new Model({
  name: 'Alice',
  address
});

console.log(user.toObj());
// { name: 'Alice', address: { street: '1 Main St', city: 'Springfield' } }
console.log(user.properties()); // ['name', 'address']
console.log(user.count());      // 2
```

Note that `toObj()` returns plain objects - class identity is stripped,
so `user.toObj().address instanceof Model === false`.

## Validating without Model

If you only need to validate a payload once without persisting an
instance, `Model.create(data, rules)` and discard the return value:

```javascript
router.post('/login', async (context) => {
  Model.create(context.body, {
    email: 'required|email',
    password: 'required|min:8'
  });
  // Reaches here only if validation passes
  const { success } = require('@axiosleo/koapp');
  success({ ok: true });
});
```

## Comparison with router-level validators

| Router validators | Model validation |
| --- | --- |
| Declarative, lives next to the route | Imperative, lives in code |
| Fields split into `params` / `query` / `body` | Arbitrary object shape |
| Runs automatically before the handler | Runs where you call it |
| Limited to the request payload | Can be reused for DB rows, intermediate data, etc. |

Use router validators for request shape enforcement, and `Model` when you
need to pass the validated data around or serialize it.

## Common pitfalls

- Validators that look at missing fields (e.g. `integer`) still pass when
  the field is absent unless paired with `required`.
- The 400 message is the **first** failing rule's message; the others are
  discarded. Use `model.validate(...)` manually if you need all errors.
- `Object.assign` (used in the constructor) copies own enumerable
  properties; prototype getters/setters on `obj` are not preserved.
- `toObj()` and `toJson()` include **all** own properties. If you want to
  hide fields, delete them before serialization or implement a custom
  `toJSON()`.

## See also

- Response helpers used after a successful `Model.create`: **koapp-response**
- Validating fields declaratively on the route: **koapp-router**
- Concrete model recipes: [examples.md](examples.md)
