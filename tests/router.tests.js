'use strict';

const { expect } = require('chai');
const { Router } = require('../src/router');
const { resolveRouters, getRouteInfo } = require('../src/core');

describe('Router', () => {
  describe('constructor', () => {
    it('should create with defaults', () => {
      const router = new Router();
      expect(router.prefix).to.equal('');
      expect(router.method).to.equal('');
      expect(router.handlers).to.deep.equal([]);
      expect(router.middlewares).to.deep.equal([]);
      expect(router.validators).to.deep.equal({});
      expect(router.subRouters).to.deep.equal({});
      expect(router.routers).to.deep.equal([]);
    });

    it('should set prefix', () => {
      const router = new Router('/api');
      expect(router.prefix).to.equal('/api');
    });

    it('should uppercase method from options', () => {
      const router = new Router('/test', { method: 'get' });
      expect(router.method).to.equal('GET');
    });

    it('should handle null prefix', () => {
      const router = new Router(null);
      expect(router.prefix).to.equal('');
    });

    it('should handle null options', () => {
      const router = new Router('/test', null);
      expect(router.prefix).to.equal('/test');
    });
  });

  describe('get()', () => {
    it('should register GET route and return this', () => {
      const handler = async () => {};
      const router = new Router('/api');
      const ret = router.get('/users', handler);
      expect(ret).to.equal(router);

      const routes = resolveRouters(router);
      const info = getRouteInfo(routes, '/api/users', 'GET');
      expect(info).to.not.be.null;
      expect(info.methods).to.include('GET');
    });

    it('should register GET route with validators', () => {
      const handler = async () => {};
      const validators = { query: { rules: { page: 'integer' } } };
      const router = new Router('/api');
      router.get('/list', handler, validators);

      const routes = resolveRouters(router);
      const info = getRouteInfo(routes, '/api/list', 'GET');
      expect(info).to.not.be.null;
      expect(info.validators).to.have.property('query');
    });
  });

  describe('post()', () => {
    it('should register POST route', () => {
      const handler = async () => {};
      const router = new Router('/api');
      const ret = router.post('/users', handler);
      expect(ret).to.equal(router);

      const routes = resolveRouters(router);
      const info = getRouteInfo(routes, '/api/users', 'POST');
      expect(info).to.not.be.null;
      expect(info.methods).to.include('POST');
    });
  });

  describe('put()', () => {
    it('should register PUT route', () => {
      const handler = async () => {};
      const router = new Router('/api');
      const ret = router.put('/users/:id', handler);
      expect(ret).to.equal(router);

      const routes = resolveRouters(router);
      const info = getRouteInfo(routes, '/api/users/1', 'PUT');
      expect(info).to.not.be.null;
      expect(info.methods).to.include('PUT');
    });
  });

  describe('patch()', () => {
    it('should register PATCH route', () => {
      const handler = async () => {};
      const router = new Router('/api');
      const ret = router.patch('/users/:id', handler);
      expect(ret).to.equal(router);

      const routes = resolveRouters(router);
      const info = getRouteInfo(routes, '/api/users/1', 'PATCH');
      expect(info).to.not.be.null;
      expect(info.methods).to.include('PATCH');
    });
  });

  describe('delete()', () => {
    it('should register DELETE route', () => {
      const handler = async () => {};
      const router = new Router('/api');
      const ret = router.delete('/users/:id', handler);
      expect(ret).to.equal(router);

      const routes = resolveRouters(router);
      const info = getRouteInfo(routes, '/api/users/1', 'DELETE');
      expect(info).to.not.be.null;
      expect(info.methods).to.include('DELETE');
    });
  });

  describe('any()', () => {
    it('should register ANY route', () => {
      const handler = async () => {};
      const router = new Router('/api');
      const ret = router.any('/catch', handler);
      expect(ret).to.equal(router);

      const routes = resolveRouters(router);
      const info = getRouteInfo(routes, '/api/catch', 'GET');
      expect(info).to.not.be.null;
      expect(info.methods).to.include('ANY');
    });
  });

  describe('push()', () => {
    it('should register route with method and handler', () => {
      const handler = async () => {};
      const router = new Router('/api');
      const ret = router.push('GET|POST', '/multi', handler);
      expect(ret).to.equal(router);

      const routes = resolveRouters(router);
      expect(getRouteInfo(routes, '/api/multi', 'GET')).to.not.be.null;
      expect(getRouteInfo(routes, '/api/multi', 'POST')).to.not.be.null;
    });

    it('should register route with validators', () => {
      const handler = async () => {};
      const validators = { params: { rules: { id: 'required' } } };
      const router = new Router('/api');
      router.push('GET', '/items/:id', handler, validators);

      const routes = resolveRouters(router);
      const info = getRouteInfo(routes, '/api/items/123', 'GET');
      expect(info.validators).to.have.property('params');
    });
  });

  describe('new()', () => {
    it('should create and add sub-router', () => {
      const router = new Router('/api');
      const ret = router.new('/v1', { method: 'GET', handlers: [async () => {}] });
      expect(ret).to.equal(router);
      expect(router.routers.length).to.be.greaterThan(0);
    });
  });

  describe('add()', () => {
    it('should add Router instance directly', () => {
      const root = new Router('/api');
      const sub = new Router('/v1', { method: 'GET', handlers: [async () => {}] });
      const ret = root.add(sub);
      expect(ret).to.equal(root);
      expect(root.routers).to.include(sub);
    });

    it('should add multiple routers at once', () => {
      const root = new Router('/api');
      const sub1 = new Router('/v1');
      const sub2 = new Router('/v2');
      root.add(sub1, sub2);
      expect(root.routers).to.include(sub1);
      expect(root.routers).to.include(sub2);
    });

    it('should add router under string prefix', () => {
      const root = new Router('/api');
      const sub = new Router('/users', { method: 'GET', handlers: [async () => {}] });
      root.add('/v1', sub);

      const routes = resolveRouters(root);
      const info = getRouteInfo(routes, '/api/v1/users', 'GET');
      expect(info).to.not.be.null;
    });

    it('should reuse existing sub-router for same prefix', () => {
      const root = new Router('/api');
      const sub1 = new Router('/a', { method: 'GET', handlers: [async () => {}] });
      const sub2 = new Router('/b', { method: 'POST', handlers: [async () => {}] });
      root.add('/v1', sub1);
      root.add('/v1', sub2);

      const routes = resolveRouters(root);
      expect(getRouteInfo(routes, '/api/v1/a', 'GET')).to.not.be.null;
      expect(getRouteInfo(routes, '/api/v1/b', 'POST')).to.not.be.null;
    });

    it('should handle null/undefined prefix', () => {
      const root = new Router('/api');
      const sub = new Router('/test', { method: 'GET', handlers: [async () => {}] });
      root.add(null, sub);

      const routes = resolveRouters(root);
      const info = getRouteInfo(routes, '/api/test', 'GET');
      expect(info).to.not.be.null;
    });
  });

  describe('method chaining', () => {
    it('should chain multiple methods', () => {
      const handler = async () => {};
      const router = new Router('/api');
      const ret = router
        .get('/a', handler)
        .post('/b', handler)
        .put('/c', handler)
        .patch('/d', handler)
        .delete('/e', handler)
        .any('/f', handler);

      expect(ret).to.equal(router);

      const routes = resolveRouters(router);
      expect(getRouteInfo(routes, '/api/a', 'GET')).to.not.be.null;
      expect(getRouteInfo(routes, '/api/b', 'POST')).to.not.be.null;
      expect(getRouteInfo(routes, '/api/c', 'PUT')).to.not.be.null;
      expect(getRouteInfo(routes, '/api/d', 'PATCH')).to.not.be.null;
      expect(getRouteInfo(routes, '/api/e', 'DELETE')).to.not.be.null;
      expect(getRouteInfo(routes, '/api/f', 'GET')).to.not.be.null;
    });
  });
});
