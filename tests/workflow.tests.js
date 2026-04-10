'use strict';

const { expect } = require('chai');
const EventEmitter = require('events');
const { Router } = require('../src/router');
const { resolveRouters } = require('../src/core');
const { HttpResponse, HttpError } = require('../src/response');
const koaWorkflow = require('../src/workflows/koa.workflow');
const socketWorkflow = require('../src/workflows/socket.workflow');

function createMockApp(options = {}) {
  const router = new Router();
  router.get('/test', async () => {});
  router.any('/error', async () => { throw new Error('handler error'); });
  router.get('/validated', async () => {}, {
    params: { rules: { id: 'required' } },
    query: { rules: { page: 'required' } },
    body: { rules: { name: 'required' } }
  });
  const emitter = new EventEmitter();
  const app = Object.assign(emitter, {
    routes: resolveRouters(router),
    config: { debug: options.debug || false, ...options },
  });
  return app;
}

function createKoaContext(overrides = {}) {
  const app = overrides.app || createMockApp();
  return {
    app,
    koa: {
      path: overrides.path || '/test',
      method: overrides.method || 'GET',
      request: {
        body: overrides.body || {},
        query: overrides.query || {},
        headers: overrides.headers || {},
      },
    },
    ...overrides,
  };
}

function createSocketContext(overrides = {}) {
  const app = overrides.app || createMockApp();
  return {
    app,
    pathinfo: overrides.pathinfo || '/test',
    method: overrides.method || 'GET',
    query: overrides.query || {},
    body: overrides.body || {},
    ...overrides,
  };
}

describe('koa.workflow', () => {
  describe('receive()', () => {
    it('should resolve route and set context fields', () => {
      const ctx = createKoaContext();
      const result = koaWorkflow.receive(ctx);
      expect(result).to.be.undefined;
      expect(ctx.router).to.not.be.null;
      expect(ctx.params).to.be.an('object');
      expect(ctx.method).to.equal('GET');
      expect(ctx.body).to.deep.equal({});
      expect(ctx.query).to.deep.equal({});
    });

    it('should return "response" on 404', () => {
      const ctx = createKoaContext({ path: '/nonexistent' });
      const result = koaWorkflow.receive(ctx);
      expect(result).to.equal('response');
      expect(ctx.response).to.be.instanceOf(HttpResponse);
    });

    it('should handle query serialization', () => {
      const ctx = createKoaContext({ query: { a: '1', b: '2' } });
      koaWorkflow.receive(ctx);
      expect(ctx.query).to.deep.equal({ a: '1', b: '2' });
    });
  });

  describe('validate()', () => {
    it('should pass with no validators', () => {
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      const result = koaWorkflow.validate(ctx);
      expect(result).to.be.undefined;
    });

    it('should pass when no router', () => {
      const ctx = createKoaContext();
      ctx.router = null;
      const result = koaWorkflow.validate(ctx);
      expect(result).to.be.undefined;
    });

    it('should return "response" on validation failure', () => {
      const app = createMockApp();
      const ctx = createKoaContext({ app, path: '/validated', method: 'GET' });
      koaWorkflow.receive(ctx);
      ctx.params = {};
      ctx.query = {};
      ctx.body = {};
      const result = koaWorkflow.validate(ctx);
      expect(result).to.equal('response');
      expect(ctx.response).to.be.instanceOf(HttpResponse);
    });
  });

  describe('middleware()', () => {
    it('should execute middlewares', async () => {
      let called = false;
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      ctx.router.middlewares = [async () => { called = true; }];
      const result = await koaWorkflow.middleware(ctx);
      expect(result).to.be.undefined;
      expect(called).to.be.true;
    });

    it('should handle no middlewares', async () => {
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      ctx.router.middlewares = [];
      const result = await koaWorkflow.middleware(ctx);
      expect(result).to.be.undefined;
    });

    it('should return "response" on middleware error', async () => {
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      ctx.router.middlewares = [async () => { throw new Error('mw error'); }];
      const result = await koaWorkflow.middleware(ctx);
      expect(result).to.equal('response');
      expect(ctx.response).to.be.instanceOf(Error);
    });

    it('should handle null router', async () => {
      const ctx = createKoaContext();
      ctx.router = null;
      const result = await koaWorkflow.middleware(ctx);
      expect(result).to.be.undefined;
    });
  });

  describe('handle()', () => {
    it('should execute handlers', async () => {
      let called = false;
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      ctx.router.handlers = [async () => { called = true; }];
      const result = await koaWorkflow.handle(ctx);
      expect(result).to.be.undefined;
      expect(called).to.be.true;
    });

    it('should catch handler errors', async () => {
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      ctx.router.handlers = [async () => { throw new Error('test'); }];
      const result = await koaWorkflow.handle(ctx);
      expect(result).to.be.undefined;
      expect(ctx.response).to.be.instanceOf(Error);
    });

    it('should handle no handlers', async () => {
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      ctx.router.handlers = [];
      const result = await koaWorkflow.handle(ctx);
      expect(result).to.be.undefined;
    });

    it('should handle null router', async () => {
      const ctx = createKoaContext();
      ctx.router = null;
      const result = await koaWorkflow.handle(ctx);
      expect(result).to.be.undefined;
    });
  });

  describe('response()', () => {
    it('should return early when no response', () => {
      const ctx = createKoaContext();
      ctx.response = null;
      koaWorkflow.response(ctx);
      expect(ctx.response).to.be.null;
    });

    it('should handle HttpResponse', () => {
      const ctx = createKoaContext();
      ctx.response = new HttpResponse({ status: 200, data: 'ok', format: 'json', code: '200;OK' });
      koaWorkflow.response(ctx);
      expect(ctx.response).to.be.instanceOf(HttpResponse);
      expect(ctx.response.status).to.equal(200);
    });

    it('should handle HttpError', () => {
      const ctx = createKoaContext();
      ctx.response = new HttpError(400, 'Bad Request');
      koaWorkflow.response(ctx);
      expect(ctx.response).to.be.instanceOf(HttpResponse);
      expect(ctx.response.status).to.equal(400);
    });

    it('should handle generic Error in debug mode', () => {
      const app = createMockApp({ debug: true });
      const ctx = createKoaContext({ app });
      ctx.response = new Error('something broke');
      ctx.method = 'GET';
      ctx.url = '/test';
      ctx.request_id = 'test-id';
      koaWorkflow.response(ctx);
      expect(ctx.response).to.be.instanceOf(HttpResponse);
      expect(ctx.response.status).to.equal(500);
    });

    it('should handle generic Error in non-debug mode', () => {
      const app = createMockApp({ debug: false });
      const ctx = createKoaContext({ app });
      ctx.response = new Error('something broke');
      ctx.method = 'GET';
      ctx.url = '/test';
      ctx.request_id = 'test-id';
      koaWorkflow.response(ctx);
      expect(ctx.response).to.be.instanceOf(HttpResponse);
      expect(ctx.response.status).to.equal(500);
      expect(ctx.response.data).to.equal('Internal Server Error');
    });

    it('should handle HttpResponse in debug mode', () => {
      const app = createMockApp({ debug: true });
      const ctx = createKoaContext({ app });
      ctx.response = new HttpResponse({ status: 200, data: 'ok', code: '200;OK' });
      ctx.method = 'GET';
      ctx.url = '/test';
      ctx.request_id = 'test-id';
      koaWorkflow.response(ctx);
      expect(ctx.response.status).to.equal(200);
    });
  });

  describe('after()', () => {
    it('should execute after hooks', async () => {
      let called = false;
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      ctx.router.afters = [async () => { called = true; }];
      await koaWorkflow.after(ctx);
      expect(called).to.be.true;
    });

    it('should handle no after hooks', async () => {
      const ctx = createKoaContext();
      koaWorkflow.receive(ctx);
      ctx.router.afters = [];
      await koaWorkflow.after(ctx);
    });

    it('should handle errors in after hooks gracefully', async () => {
      let errorEmitted = false;
      const ctx = createKoaContext();
      ctx.app.on('after_error', () => { errorEmitted = true; });
      koaWorkflow.receive(ctx);
      ctx.router.afters = [async () => { throw new Error('after error'); }];
      await koaWorkflow.after(ctx);
      expect(errorEmitted).to.be.true;
    });

    it('should handle null router', async () => {
      const ctx = createKoaContext();
      ctx.router = null;
      await koaWorkflow.after(ctx);
    });
  });
});

describe('socket.workflow', () => {
  describe('receive()', () => {
    it('should resolve route and set context fields', () => {
      const ctx = createSocketContext();
      const result = socketWorkflow.receive(ctx);
      expect(result).to.be.undefined;
      expect(ctx.router).to.not.be.null;
      expect(ctx.params).to.be.an('object');
    });

    it('should return "response" on 404', () => {
      const ctx = createSocketContext({ pathinfo: '/nonexistent' });
      const result = socketWorkflow.receive(ctx);
      expect(result).to.equal('response');
      expect(ctx.response).to.be.instanceOf(HttpResponse);
    });
  });

  describe('validate()', () => {
    it('should pass with no validators', () => {
      const ctx = createSocketContext();
      socketWorkflow.receive(ctx);
      const result = socketWorkflow.validate(ctx);
      expect(result).to.be.undefined;
    });

    it('should return "response" on validation failure', () => {
      const app = createMockApp();
      const ctx = createSocketContext({ app, pathinfo: '/validated', method: 'GET' });
      socketWorkflow.receive(ctx);
      ctx.params = {};
      ctx.query = {};
      ctx.body = {};
      const result = socketWorkflow.validate(ctx);
      expect(result).to.equal('response');
      expect(ctx.response).to.be.instanceOf(HttpResponse);
    });

    it('should pass when no router', () => {
      const ctx = createSocketContext();
      ctx.router = null;
      const result = socketWorkflow.validate(ctx);
      expect(result).to.be.undefined;
    });
  });

  describe('middleware()', () => {
    it('should execute middlewares', async () => {
      let called = false;
      const ctx = createSocketContext();
      socketWorkflow.receive(ctx);
      ctx.router.middlewares = [async () => { called = true; }];
      const result = await socketWorkflow.middleware(ctx);
      expect(result).to.be.undefined;
      expect(called).to.be.true;
    });

    it('should return "response" on error', async () => {
      const ctx = createSocketContext();
      socketWorkflow.receive(ctx);
      ctx.router.middlewares = [async () => { throw new Error('fail'); }];
      const result = await socketWorkflow.middleware(ctx);
      expect(result).to.equal('response');
    });
  });

  describe('handle()', () => {
    it('should execute handlers', async () => {
      let called = false;
      const ctx = createSocketContext();
      socketWorkflow.receive(ctx);
      ctx.router.handlers = [async () => { called = true; }];
      await socketWorkflow.handle(ctx);
      expect(called).to.be.true;
    });

    it('should catch handler errors', async () => {
      const ctx = createSocketContext();
      socketWorkflow.receive(ctx);
      ctx.router.handlers = [async () => { throw new Error('err'); }];
      await socketWorkflow.handle(ctx);
      expect(ctx.response).to.be.instanceOf(Error);
    });
  });

  describe('response()', () => {
    it('should return early when no response', () => {
      const ctx = createSocketContext();
      ctx.response = null;
      socketWorkflow.response(ctx);
      expect(ctx.response).to.be.null;
    });

    it('should handle HttpResponse', () => {
      const ctx = createSocketContext();
      ctx.response = new HttpResponse({ status: 200, data: 'ok' });
      socketWorkflow.response(ctx);
      expect(ctx.response).to.be.instanceOf(HttpResponse);
    });

    it('should handle HttpError', () => {
      const ctx = createSocketContext();
      ctx.response = new HttpError(400, 'Bad');
      socketWorkflow.response(ctx);
      expect(ctx.response).to.be.instanceOf(HttpResponse);
      expect(ctx.response.status).to.equal(400);
    });

    it('should handle generic Error in non-debug mode', () => {
      const app = createMockApp({ debug: false });
      const ctx = createSocketContext({ app });
      ctx.response = new Error('broke');
      ctx.url = '/test';
      ctx.request_id = 'test-id';
      socketWorkflow.response(ctx);
      expect(ctx.response).to.be.instanceOf(HttpResponse);
      expect(ctx.response.status).to.equal(500);
    });

    it('should handle generic Error in debug mode', () => {
      const app = createMockApp({ debug: true });
      const ctx = createSocketContext({ app });
      ctx.response = new Error('broke');
      ctx.url = '/test';
      ctx.request_id = 'test-id';
      socketWorkflow.response(ctx);
      expect(ctx.response).to.be.instanceOf(HttpResponse);
      expect(ctx.response.status).to.equal(500);
    });

    it('should handle HttpResponse in debug mode', () => {
      const app = createMockApp({ debug: true });
      const ctx = createSocketContext({ app });
      ctx.response = new HttpResponse({ status: 201, data: 'created', code: '201;Created' });
      ctx.url = '/test';
      ctx.request_id = 'test-id';
      socketWorkflow.response(ctx);
      expect(ctx.response.status).to.equal(201);
    });
  });

  describe('after()', () => {
    it('should execute after hooks', async () => {
      let called = false;
      const ctx = createSocketContext();
      socketWorkflow.receive(ctx);
      ctx.router.afters = [async () => { called = true; }];
      await socketWorkflow.after(ctx);
      expect(called).to.be.true;
    });

    it('should handle errors in after hooks', async () => {
      let errorEmitted = false;
      const ctx = createSocketContext();
      ctx.app.on('after_error', () => { errorEmitted = true; });
      socketWorkflow.receive(ctx);
      ctx.router.afters = [async () => { throw new Error('err'); }];
      await socketWorkflow.after(ctx);
      expect(errorEmitted).to.be.true;
    });

    it('should handle null router', async () => {
      const ctx = createSocketContext();
      ctx.router = null;
      await socketWorkflow.after(ctx);
    });
  });
});
