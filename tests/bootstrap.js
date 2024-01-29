
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
      params: context.params
    });
  };
  const root = new Router();

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
    failed({ code: 500 });
  });

  // send res by result() method
  root.push('any', '/result', async () => {
    result(JSON.stringify({ hello: 'World!' }), 200, {
      'Content-Type': 'application/json'
    });
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
  root.push('any', '/validate', async () => {
    success('all params is valid');
  }, {
    query: {
      rules: {
        a: 'required',
        b: 'string'
      }
    },
    body: {
      rules: {
        bodyA: 'required',
        bodyB: 'string'
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
