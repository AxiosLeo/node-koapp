'use strict';

const { expect } = require('chai');
const { resolveRouters, getRouteInfo, initContext } = require('../src/core');
const { Router } = require('../src/router');

describe('core', () => {
  describe('initContext()', () => {
    it('should create context with defaults', () => {
      const ctx = initContext();
      expect(ctx.app).to.be.null;
      expect(ctx.app_id).to.equal('');
      expect(ctx.curr).to.deep.equal({});
      expect(ctx.step_data).to.deep.equal({});
      expect(ctx.method).to.equal('');
      expect(ctx.pathinfo).to.equal('/');
      expect(ctx.request_id).to.be.a('string');
    });

    it('should accept custom options', () => {
      const mockApp = { name: 'test' };
      const ctx = initContext({
        app: mockApp,
        method: 'POST',
        pathinfo: '/api/test',
        app_id: 'my-app'
      });
      expect(ctx.app).to.equal(mockApp);
      expect(ctx.method).to.equal('POST');
      expect(ctx.pathinfo).to.equal('/api/test');
      expect(ctx.app_id).to.equal('my-app');
      expect(ctx.request_id).to.be.a('string');
    });

    it('should generate unique request_id', () => {
      const ctx1 = initContext();
      const ctx2 = initContext();
      expect(ctx1.request_id).to.not.equal(ctx2.request_id);
    });
  });

  describe('resolveRouters()', () => {
    it('should handle single router (non-array)', () => {
      const router = new Router('/api', { method: 'GET', handlers: [async () => {}] });
      const tree = resolveRouters(router);
      expect(tree).to.be.an('object');
    });

    it('should handle array of routers', () => {
      const r1 = new Router('/api', { method: 'GET', handlers: [async () => {}] });
      const r2 = new Router('/admin', { method: 'GET', handlers: [async () => {}] });
      const tree = resolveRouters([r1, r2]);
      expect(tree).to.be.an('object');
    });

    it('should handle empty array', () => {
      const tree = resolveRouters([]);
      expect(tree).to.deep.equal({});
    });

    it('should resolve routers with middlewares', () => {
      const mw = async () => {};
      const router = new Router('/api', {
        middlewares: [mw],
      });
      router.get('/test', async () => {});
      const tree = resolveRouters(router);
      const info = getRouteInfo(tree, '/api/test', 'GET');
      expect(info).to.not.be.null;
      expect(info.middlewares).to.include(mw);
    });

    it('should resolve routers with afters', () => {
      const afterFn = async () => {};
      const router = new Router('/api', {
        afters: [afterFn],
      });
      router.get('/test', async () => {});
      const tree = resolveRouters(router);
      const info = getRouteInfo(tree, '/api/test', 'GET');
      expect(info).to.not.be.null;
      expect(info.afters).to.include(afterFn);
    });
  });

  describe('getRouteInfo()', () => {
    it('should return null for non-existent route', () => {
      const router = new Router('/api');
      router.get('/users', async () => {});
      const tree = resolveRouters(router);
      const info = getRouteInfo(tree, '/nonexistent', 'GET');
      expect(info).to.be.null;
    });

    it('should return null when method does not match', () => {
      const router = new Router('/api');
      router.get('/users', async () => {});
      const tree = resolveRouters(router);
      const info = getRouteInfo(tree, '/api/users', 'POST');
      expect(info).to.be.null;
    });

    it('should match ANY method routes', () => {
      const router = new Router('/api');
      router.any('/catch', async () => {});
      const tree = resolveRouters(router);

      expect(getRouteInfo(tree, '/api/catch', 'GET')).to.not.be.null;
      expect(getRouteInfo(tree, '/api/catch', 'POST')).to.not.be.null;
      expect(getRouteInfo(tree, '/api/catch', 'DELETE')).to.not.be.null;
    });

    it('should match wildcard *** catch-all route', () => {
      const router = new Router();
      router.any('/***', async () => {});
      router.get('/specific', async () => {});
      const tree = resolveRouters(router);

      const specific = getRouteInfo(tree, '/specific', 'GET');
      expect(specific).to.not.be.null;

      const catchAll = getRouteInfo(tree, '/anything/at/all', 'GET');
      expect(catchAll).to.not.be.null;
    });

    it('should extract path params', () => {
      const router = new Router('/api');
      router.get('/users/{:userId}/posts/{:postId}', async () => {});
      const tree = resolveRouters(router);
      const info = getRouteInfo(tree, '/api/users/42/posts/99', 'GET');
      expect(info).to.not.be.null;
      expect(info.params.userId).to.equal('42');
      expect(info.params.postId).to.equal('99');
    });

    it('should handle root path', () => {
      const router = new Router();
      router.get('/', async () => {});
      const tree = resolveRouters(router);
      const info = getRouteInfo(tree, '/', 'GET');
      expect(info).to.not.be.null;
    });

    it('should handle multi-method routes', () => {
      const router = new Router();
      router.push('GET|POST', '/multi', async () => {});
      const tree = resolveRouters(router);
      expect(getRouteInfo(tree, '/multi', 'GET')).to.not.be.null;
      expect(getRouteInfo(tree, '/multi', 'POST')).to.not.be.null;
      expect(getRouteInfo(tree, '/multi', 'DELETE')).to.be.null;
    });

    it('should fall back to *** default when no match', () => {
      const handler = async () => {};
      const root = new Router();
      root.any('/***', handler);
      root.get('/api/test', async () => {});
      const tree = resolveRouters(root);

      const info = getRouteInfo(tree, '/api/unknown/path', 'GET');
      expect(info).to.not.be.null;
    });

    it('should return default validators when route has none', () => {
      const router = new Router();
      router.get('/test', async () => {});
      const tree = resolveRouters(router);
      const info = getRouteInfo(tree, '/test', 'GET');
      expect(info).to.not.be.null;
      expect(info.validators).to.deep.equal({ params: {}, body: {}, query: {} });
    });

    it('should handle nested sub-routers', () => {
      const root = new Router('/api');
      const v1 = new Router('/v1');
      v1.get('/users', async () => {});
      root.add(v1);
      const tree = resolveRouters(root);
      const info = getRouteInfo(tree, '/api/v1/users', 'GET');
      expect(info).to.not.be.null;
    });

    it('should return null for completely empty tree', () => {
      const tree = resolveRouters([]);
      const info = getRouteInfo(tree, '/anything', 'GET');
      expect(info).to.be.null;
    });
  });
});
