'use strict';

class Router {
  constructor(prefix = '', options = {}) {
    Object.assign(this, {
      method: '',
      handlers: [],
      routers: [],
      middlewares: [],
    }, options || {});
    this.prefix = prefix || '';
  }

  /**
   * @param {Router} router 
   * @returns 
   */
  add(router) {
    this.routers.push(router);
    return this;
  }

  /**
   * @param {string} prefix 
   * @param {import('..').RouterOptions} options 
   * @returns 
   */
  new(prefix, options = {}) {
    const router = new Router(prefix, options);
    this.add(router);
    return this;
  }

  /**
   * 
   * @param {string} method 
   * @param {string} prefix 
   * @param {*} handle 
   */
  push(method, prefix, handle, validator) {
    this.new(prefix, {
      method,
      handlers: [handle],
      validators: validator
    });
  }
}

module.exports = {
  Router,
};
