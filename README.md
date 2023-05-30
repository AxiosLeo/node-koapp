# @axiosleo/koapp

[![NPM version](https://img.shields.io/npm/v/@axiosleo/koapp.svg?style=flat-square)](https://npmjs.org/package/@axiosleo/koapp)
[![npm download](https://img.shields.io/npm/dm/@axiosleo/koapp.svg?style=flat-square)](https://npmjs.org/package/@axiosleo/koapp)
[![CI Build Status](https://github.com/AxiosLeo/node-koapp/actions/workflows/ci.yml/badge.svg)](https://github.com/AxiosLeo/node-koapp/actions/workflows/ci.yml)
[![](https://codecov.io/gh/AxiosLeo/node-koapp/branch/master/graph/badge.svg)](https://codecov.io/gh/AxiosLeo/node-koapp)
[![License](https://img.shields.io/github/license/AxiosLeo/node-koapp?color=%234bc524)](LICENSE)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-koapp.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-koapp/refs/branch/master)

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

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-koapp.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FAxiosLeo%2Fnode-koapp/refs/branch/master/)
