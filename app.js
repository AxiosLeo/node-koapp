
'use strict';

const { success, result, failed } = require('./src/response');

const { KoaApplication, Router, Model } = require('.');

if (require.main === module) {
  const handle = async (context) => {
    success({
      body: context.koa.request.body,
      query: context.koa.request.query,
      params: context.params
    });
  };
  const app = new KoaApplication({
    debug: true,
    routers: [new Router('/none', {
      method: 'get',
      handlers: [async (context) => {
        context.koa.body = 'hello, world!';
      }]
    }), new Router('/test/{:a}', {
      method: 'any',
      handlers: [handle]
    }), new Router('/api/user/login', {
      method: 'post',
      handlers: [async () => {
        result({ msg: '用户名或密码不正确' });
      }]
    }), new Router('/test/', {
      method: 'any',
      handlers: [handle]
    }), new Router('/error', {
      method: 'any',
      handlers: [async () => {
        throw new Error('error');
      }]
    }), new Router('/failed', {
      method: 'any',
      handlers: [async () => {
        failed({
          code: 500,
        });
      }]
    }), new Router('/result', {
      method: 'any',
      handlers: [async () => {
        result(JSON.stringify({ hello: 'World!' }), 200, {
          'Content-Type': 'application/json'
        });
      }]
    }), new Router('/success', {
      method: 'any',
      handlers: [async () => {
        success('Hello, World!');
      }]
    }), new Router('/model', {
      method: 'get',
      handlers: [async () => {
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
      }]
    })]
  });
  app.start();
}
