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
   * @param {*} options 
   * @returns 
   */
  new(prefix, options = {}) {
    const router = new Router(prefix, options);
    this.add(router);
    return this;
  }
}

module.exports = {
  Router,
};
