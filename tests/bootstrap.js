
'use strict';

// eslint-disable-next-line no-unused-vars
const { debug } = require('@axiosleo/cli-tool');
const { success, result, failed } = require('../src/response');

const { KoaApplication, Router, Model } = require('..');

if (require.main === module) {
  const handle = async (context) => {
    success({
      body: context.koa.request.body,
      query: context.koa.request.query,
      params: context.params,
      method: context.method
    });
  };
  const root = new Router(null, {
    middlewares: [async (context) => {
      debug.log(`[${context.app_id}] ${context.method}: ${context.router.pathinfo}`);
    }],
    afters: [async (context) => {
      debug.log(context.response);
    }]
  });

  // default
  root.push('any', '/***', async (context) => {
    context.koa.body = 'hello, world!';
  });

  // return NotFound response when not set method
  root.push('', '/invalid', async (context) => {
    context.koa.body = 'cannot be here, will return NotFound response';
  });

  // set multi-method
  root.push('get|post', '/multi', async (context) => {
    success({ method: context.method });
  });

  // path params
  root.push('get', '/a/{:a}/b/{:b}', handle);

  // any method
  root.push('any', '/any', handle);

  // some error
  root.push('any', '/error', async () => {
    throw new Error('error');
  });

  // send res by failed() method
  root.push('any', '/failed', async () => {
    failed({ data: 'something' }, '403;Unauthorized', 403);
  });

  // send res by result() method
  root.push('any', '/result', async () => {
    result(JSON.stringify({ hello: 'world!' }), 200, {
      'Content-Type': 'application/json'
    });
  });

  // send object res by result() method
  root.get('/result/obj', async () => {
    result([{ test: 123 }]);
  });

  // send res by success() method
  root.push('any', '/success', async () => {
    success('Hello, World!');
  });

  // send html content
  root.push('any', '/html', async () => {
    result('hello, world!', 200, {
      'Content-Type': 'text/html'
    });
  });

  // use model
  root.push('any', '/model', async () => {
    const model = new Model({
      submodel: new Model({
        submodel: new Model({
          a: 'A'
        })
      })
    });
    success({
      obj: model.toObj(),
      json: model.toJson(),
      properties: model.properties(),
      count: model.count(),
    });
  });

  // throw error by model
  root.push('any', '/model/error', async () => {
    Model.create({}, { param: 'required' });
  });

  // validate request
  root.push('any', '/validate/{:param1}/{:param2}', async (context) => {
    success({
      result: 'all params is valid',
      params: context.params,
      query: context.query,
      body: context.body
    });
  }, {
    params: {
      rules: {
        param1: 'required',
        param2: 'required'
      }
    },
    query: {
      rules: {
        a: 'required',
        b: 'integer'
      }
    },
    body: {
      rules: {
        bodyA: 'required',
        bodyB: 'integer'
      },
      messages: {
        'required': 'The :attribute field is required......'
      }
    }
  });

  const app = new KoaApplication({
    debug: true,
    routers: [root]
  });
  app.start();
}
