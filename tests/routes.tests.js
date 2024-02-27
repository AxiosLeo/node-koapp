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
});
