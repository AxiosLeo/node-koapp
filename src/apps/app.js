'use strict';

const EventEmitter = require('events');
const { v4 } = require('uuid');
const { Configuration, Workflow } = require('@axiosleo/cli-tool');
const { resolveRouters } = require('../core');
const flowOperator = require('../workflow');

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
    this.workflow = new Workflow(this.config.operator || flowOperator);
    this.emit('starting', this);
  }

  async start() {
    throw new Error('not implemented');
  }
}

module.exports = Application;
