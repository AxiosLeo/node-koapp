'use strict';

const { Router } = require('..');
const SocketApplication = require('../src/apps/socket');
const { success } = require('../src/response');

// const { debug } = require('@axiosleo/cli-tool');

const root = new Router(null, {
  middlewares: [async (context) => {
    // debug.log(`[${context.app_id}] ${context.method}: ${context.router.pathinfo}`);
  }],
  afters: [async (context) => {
    // debug.log(context);
  }]
});

root.get('/api/test/{:id}', async (context) => {
  // debug.log(context.connection.write(JSON.stringify({ test: 123 })));
  success({
    query: context.query,
    body: context.body,
    test: 'Hello World!'
  });
});

root.any('/***', async (context) => {
  // debug.log(context.connection.write(JSON.stringify({ test: 123 })));
  success({
    query: context.query,
    body: context.body
  });
});

const app = new SocketApplication({
  routers: [root],
  ping: {
    open: true,
    interval: 1000 * 10,
    data: 'this is a ping message.'
  }
});

app.start();
