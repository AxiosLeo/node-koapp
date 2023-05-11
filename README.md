# @axiosleo/koapp

> Design for quickly developing Web applications using Node.js
>
> Based on [koa](https://koajs.com/)

```bash
npm install @axiosleo/koapp
```

## Quick Start

```javascript
const { KoaApplication, Router, success } = require("@axiosleo/koapp");

const handle = async (ctx) => {
  success({
    message: "Hello World!",
  });
};

const router = new Router("/test", {
  method: "any",
  handlers: [handle],
});

const app = new KoaApplication({
  port: 8088,
  listen_host: "localhost", // 0.0.0.0 for public access
  routers: [router],
});
app.start();

// open http://localhost:8088/test
```

## License

This project is open-sourced software licensed under the [MIT](LICENSE).
