const { success } = require('../src/response');

const { Router } = require('..');
const { debug } = require('@axiosleo/cli-tool');

const root = new Router(null, {
  middlewares: [async (context) => {
    debug.log(`[${context.app_id}] ${context.method}: ${context.router.pathinfo}`);
  }],
  afters: [async (context) => {
    debug.log({
      query: context.query,
      body: context.body,
      test: context.params.id
    });
  }]
});

root.get('/api/test/{:id}', async (context) => {
  success({
    query: context.query,
    body: context.body,
    test: context.params.id
  });
});

root.any('/***', async (context) => {
  success({
    query: context.query,
    body: context.body
  });
});

module.exports = root;
