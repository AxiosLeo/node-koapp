'use strict';

const { expect } = require('chai');
const { Router } = require('../index');
const { resolveRouters, getRouteInfo } = require('../src/core');

describe('router test case', () => {
  it('default router', () => {
    const defaultOptions = {
      method: 'any', handlers: [async () => { }]
    };
    const router = new Router('/api/v1', defaultOptions);
    router.new('/***', defaultOptions);

    const moduleRouters = new Router('/module');
    router.add(moduleRouters);
    router.add('/{:module}', moduleRouters);

    const routes = resolveRouters(router);
    const result = getRouteInfo(routes, '/api/v1/module/123');
    expect(result).not.to.be.null;
  });

  it('path params with {:id} syntax', () => {
    const router = new Router('/users/{:id}', {
      method: 'GET',
      handlers: [async () => { }]
    });

    const routes = resolveRouters(router);
    const result = getRouteInfo(routes, '/users/123', 'GET');

    expect(result).not.to.be.null;
    expect(result.params).to.have.property('id');
    expect(result.params.id).to.equal('123');
  });

  it('path params with :id syntax', () => {
    const router = new Router('/posts/:postId', {
      method: 'GET',
      handlers: [async () => { }]
    });

    const routes = resolveRouters(router);
    const result = getRouteInfo(routes, '/posts/456', 'GET');

    expect(result).not.to.be.null;
    expect(result.params).to.have.property('postId');
    expect(result.params.postId).to.equal('456');
  });

  it('multiple path params with :id syntax', () => {
    const router = new Router('/users/:userId/posts/:postId', {
      method: 'GET',
      handlers: [async () => { }]
    });

    const routes = resolveRouters(router);
    const result = getRouteInfo(routes, '/users/100/posts/200', 'GET');

    expect(result).not.to.be.null;
    expect(result.params).to.have.property('userId');
    expect(result.params).to.have.property('postId');
    expect(result.params.userId).to.equal('100');
    expect(result.params.postId).to.equal('200');
  });

  it('mixed path params syntax', () => {
    const router = new Router('/api/{:version}/users/:userId', {
      method: 'GET',
      handlers: [async () => { }]
    });

    const routes = resolveRouters(router);
    const result = getRouteInfo(routes, '/api/v1/users/999', 'GET');

    expect(result).not.to.be.null;
    expect(result.params).to.have.property('version');
    expect(result.params).to.have.property('userId');
    expect(result.params.version).to.equal('v1');
    expect(result.params.userId).to.equal('999');
  });
});
