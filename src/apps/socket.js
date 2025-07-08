'use strict';

const net = require('net');
const EventEmitter = require('events');
const Application = require('./app');
const { debug, printer, Workflow } = require('@axiosleo/cli-tool');
const { _uuid_salt } = require('../utils');
const { initContext } = require('../core');
const is = require('@axiosleo/cli-tool/src/helper/is');
const operator = require('../workflows/socket.workflow');
const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');
const { _sleep } = require('@axiosleo/cli-tool/src/helper/cmd');

const dispatcher = ({ app, app_id, workflow, connection }) => {
  return async (ctx) => {
    let context = initContext({
      app,
      connection,
      method: ctx.method ? ctx.method.toUpperCase() : 'GET',
      pathinfo: ctx.path,
      app_id,
    });
    context.socket = connection;
    context.query = ctx.query || {};
    context.body = ctx.body || {};
    try {
      await workflow.start(context);
    } catch (exContext) {
      context = exContext;
    }
  };
};

/**
 * @param {import('../../').SocketContext} context 
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
      data: response.data
    });
  } else {
    data = response.data;
  }
  context.socket.write(data + '@@@@@@');
};

async function ping(data, interval) {
  this.broadcast(data, 'ping', 0);
  await _sleep(interval);
  process.nextTick(() => {
    ping.call(this, data, interval);
  });
}

class SocketApplication extends Application {
  constructor(options) {
    super(options);

    this.event = new EventEmitter();
    this.port = this.config.port || 8081;
    this.connections = {};
    this.on('response', handleRes);
    this.workflow = new Workflow(operator);
    this.ping = {};
    _assign(this.ping, {
      open: false,
      interval: 1000 * 60 * 5,
      data: 'this is a ping message'
    }, this.config.ping || {});
  }

  async start() {
    const server = net.createServer((connection) => {
      try {
        let connection_id = _uuid_salt('connect:' + this.app_id);
        this.connections[connection_id] = connection;
        debug.log('[Socket App]', 'Current connections:', Object.keys(this.connections).length);
        this.event.emit('connection', connection);
        connection.pipe(connection);
        const self = this;
        connection.on('data', function (data) {
          try {
            /**
             * @example '{"path":"/test","method":"GET","query":{"test":123}}@@@@@@'
             */
            let msg = Buffer.from(data.subarray(0, data.length - 6)).toString();
            const context = JSON.parse(msg);
            const callback = dispatcher({
              app: self,
              app_id: self.app_id,
              workflow: self.workflow,
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
        debug.log('[Socket App]', 'create socket server failed.', err);
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        debug.error('[Socket App]', 'The listening port is in use.', this.port);
      } else {
        debug.error('[Socket App]', 'socket server error:', err);
      }
    });
    if (this.ping.open) {
      const self = this;
      printer.info('[Socket App] ping is open.');
      process.nextTick(() => {
        ping.call(self, self.ping.data, self.ping.interval);
      });
    }

    server.listen(this.port, () => {
      printer.info(`Server is running on port ${this.port}`);
      this.event.emit('listen', this.port);
    });
  }

  broadcast(data = '', msg = 'ok', code = 0, connections = []) {
    data = JSON.stringify({
      request_id: _uuid_salt(this.app_id),
      timestamp: (new Date()).getTime(),
      code,
      message: msg,
      data: data
    });
    data = `${data}@@@@@@`;
    if (connections === null) {
      if (is.empty(this.connections)) {
        return;
      }
      Object.keys(this.connections).map((id) => this.connections[id].write(data));
    } else if (is.array(connections)) {
      connections.map((conn) => conn.write(data));
    } else if (is.object(connections)) {
      Object.keys(connections).map((id) => connections[id].write(data));
    }
  }
}

module.exports = SocketApplication;
