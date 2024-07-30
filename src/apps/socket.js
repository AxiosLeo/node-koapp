'use strict';

const net = require('net');
const EventEmitter = require('events');
const Application = require('./app');
const { debug, printer } = require('@axiosleo/cli-tool');
const { _uuid, _request_id } = require('../utils');
const is = require('@axiosleo/cli-tool/src/helper/is');

const initContext = (app, ctx, app_id, routes) => {
  const context = {
    app,
    koa: ctx,
    app_id,
    curr: {},
    step_data: {},
    request_id: _request_id(app_id),
    routes,

    method: ctx.method ? ctx.method : '',
    path: ctx.path ? ctx.path : '',
    body: ctx.body,
    query: ctx.query ? JSON.parse(JSON.stringify(ctx.query)) : {},
    headers: ctx.headers || {},
  };
  return context;
};

const dispatcher = ({ app, app_id, workflow, routes, connection }) => {
  return async (ctx) => {
    let context = initContext(app, ctx, app_id, routes);
    context.connection = connection;
    try {
      await workflow.start(context);
    } catch (exContext) {
      context = exContext;
    }
  };
};

/**
 * @param {import('../../').NetSocketContext} context 
 */
const handleRes = (context) => {
  let response = context.response;
  let data = '';
  if (response.format === 'json' && response.notResolve !== true) {
    let code, message;
    if (response.code) {
      [code, message] = response.code.split(';');
    }
    data = JSON.stringify({
      request_id: context.request_id,
      timestamp: (new Date()).getTime(),
      code: code || `${response.status}`,
      message: message || context.response.message,
      data: response.data,
    });
  } else {
    data = response.data;
  }
  context.connection.write(data + '@@@@@@');
};

class NetSocketApplication extends Application {
  constructor(config = {}) {
    super(config);
    this.event = new EventEmitter();
    this.port = this.config.port || 8081;
    this.connections = {};
    this.on('response', handleRes);
  }

  async start() {
    const server = net.createServer((connection) => {
      try {
        let connection_id = _uuid();
        this.connections[connection_id] = connection;
        debug.log('[Socket App]', 'Current connections:', Object.keys(this.connections).length);
        this.event.emit('connection', connection);
        connection.pipe(connection);
        const self = this;
        connection.on('data', function (data) {
          try {
            /**
             * @example '##{"path":"/test","method":"GET","query":{"test":123}}@@'
             */
            let msg = Buffer.from(data.subarray(0, data.length - 6)).toString();
            const context = JSON.parse(msg);
            const callback = dispatcher({
              app: self,
              app_id: self.app_id,
              workflow: self.workflow,
              routes: self.routes,
              connection
            });
            process.nextTick(callback, context);
          } catch (err) {
            debug.log('[Socket App]', err.message);
          }
        });
        connection.on('end', () => {
          delete this.connections[connection_id];
          debug.log('[Socket App]', 'Current connections:', Object.keys(this.connections).length);
        });
      } catch (err) {
        debug.error('[Socket App]', 'create socket server failed.');
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        debug.error('[Socket App]', 'The listening port is in use.', this.port);
      } else {
        debug.error('[Socket App]', 'socket server error:', err);
      }
    });

    server.listen(this.port, () => {
      printer.info(`Server is running on port ${this.port}`);
      this.event.emit('listen', this.port);
    });
  }

  broadcast(data = '', connections = null) {
    if (is.object(data) || is.array(data)) {
      data = JSON.stringify(data) + '@@@@@@';
    } else {
      data = `${data}@@@@@@`;
    }
    if (connections === null) {
      Object.keys(this.connections).map((id) => this.connections[id].write(data));
    } else if (is.array(connections)) {
      connections.map((conn) => conn.write(data));
    } else if (is.object(connections)) {
      Object.keys(connections).map((id) => connections[id].write(data));
    }
  }
}

module.exports = NetSocketApplication;
