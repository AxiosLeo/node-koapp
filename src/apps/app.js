'use strict';

const EventEmitter = require('events');
const { v4 } = require('uuid');
const { Configuration } = require('@axiosleo/cli-tool');
const { resolveRouters, registerRouters } = require('../core');

class Application extends EventEmitter {
  constructor(config) {
    super();
    this.config = new Configuration({
      debug: false,
      routers: [],
      app_id: '',
      ...config,
    });
    this.app_id = this.config.app_id || v4();
    this.routes = resolveRouters(this.config.routers);
    this.emit('starting', this);
  }

  /**
   * Register one or more routers at runtime.
   * Takes effect immediately for subsequent requests.
   * @param {object|object[]} routers single router or an array of routers
   */
  registerRouters(routers) {
    registerRouters(this.routes, routers);
    return this;
  }

  async start() {
    throw new Error('not implemented');
  }
}

module.exports = Application;
