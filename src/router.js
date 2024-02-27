'use strict';

class Router {
  constructor(prefix = '', options = {}) {
    Object.assign(this, {
      prefix: prefix || '',
      method: '',
      handlers: [],
      routers: [],
      middlewares: [],
      validators: { params: {}, query: {}, body: {} }
    }, options || {});
    if (this.method) {
      this.method = this.method.toUpperCase();
    }
    this.subRouters = {};
  }

  /**
   * @param {string|Router} prefix
   * @param {Router} router 
   * @returns 
   */
  add(prefix, router) {
    if (prefix instanceof Router) {
      this.routers.push(prefix);
      return this;
    }
    if (!prefix && router instanceof Router) {
      this.routers.push(prefix);
      return this;
    }
    if (!this.subRouters[prefix]) {
      this.subRouters[prefix] = new Router(prefix);
      this.routers.push(this.subRouters[prefix]);
    }
    this.subRouters[prefix].add(router);
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
   * @param {string} method 
   * @param {string} prefix 
   * @param {import('..').ContextHandler} handle 
   * @param {import('..').RouterValidator} validator
   */
  push(method, prefix, handle, validators = null) {
    this.new(prefix, {
      method,
      handlers: [handle],
      validators: validators || {}
    });
    return this;
  }

  get(prefix, handle, validator) {
    this.push('GET', prefix, handle, validator);
    return this;
  }

  post(prefix, handle, validator) {
    this.push('POST', prefix, handle, validator);
    return this;
  }

  put(prefix, handle, validator) {
    this.push('PUT', prefix, handle, validator);
    return this;
  }

  patch(prefix, handle, validator) {
    this.push('PATCH', prefix, handle, validator);
    return this;
  }

  delete(prefix, handle, validator) {
    this.push('DELETE', prefix, handle, validator);
    return this;
  }

  any(prefix, handle, validator) {
    this.push('ANY', prefix, handle, validator);
    return this;
  }
}

module.exports = {
  Router,
};
