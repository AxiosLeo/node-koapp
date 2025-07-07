'use strict';

const { WebSocketServer } = require('ws');
const EventEmitter = require('events');
const Application = require('./app');
const { debug, printer, Workflow } = require('@axiosleo/cli-tool');
const { _uuid_salt } = require('../utils');
const { initContext } = require('../core');
const is = require('@axiosleo/cli-tool/src/helper/is');
const operator = require('../workflows/socket.workflow');
const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');
const { _sleep } = require('@axiosleo/cli-tool/src/helper/cmd');

/**
 * 
 * @param {{request: import('http').IncomingMessage}} param0 
 * @returns 
 */
const dispatcher = ({ app, app_id, workflow, connection, request }) => {
  return async (ctx) => {
    const url = new URL(request.url, `ws://localhost:${app.port}`);
    let context = initContext({
      app,
      method: request.method ? request.method.toUpperCase() : 'GET',
      pathinfo: url.pathname,
      app_id,
    });
    context.socket = connection;
    context.query = connection.connectionQuery || {};
    context.body = ctx || {};
    context.headers = request.headers;
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
  context.socket.send(data);
};

async function ping(data, interval) {
  this.broadcast(data, 'ping', 0);
  await _sleep(interval);
  process.nextTick(() => {
    ping.call(this, data, interval);
  });
}

class WebSocketApplication extends Application {
  /**
   * 
   * @param {import('../../').WebSocketAppConfiguration} options 
   */
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
    delete options.ping;
    this.websocketOptions = options;
  }

  async start() {
    const wss = new WebSocketServer(this.websocketOptions);
    printer.info(`Server is running on port ${this.port}`);
    this.event.emit('listen', this.port);
    const self = this;
    wss.on('connection', (ws, request) => {
      let connection_id = _uuid_salt('connect:' + this.app_id);
      this.connections[connection_id] = ws;

      debug.log('[WebSocket App]', 'Current connections:', Object.keys(this.connections).length);
      this.event.emit('connection', ws, request);

      ws.on('message', (data) => {
        try {
          /**
           * @example '{"path":"/test","method":"GET","query":{"test":123}}'
           */
          let msg = Buffer.from(data).toString();
          const context = JSON.parse(msg);
          const callback = dispatcher({
            app: self,
            app_id: self.app_id,
            workflow: self.workflow,
            connection: ws,
            request
          });
          process.nextTick(callback, context);
        } catch (err) {
          debug.log('[Socket App]', err.message);
        }
      });
      ws.on('error', (err) => {
        debug.error('[Socket App]', 'socket server error:', err);
      });
      ws.on('close', () => {
        delete this.connections[connection_id];
        debug.log('[Socket App]', 'Current connections:', Object.keys(this.connections).length);
      });
    });

    wss.on('error', (err) => {
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
  }

  broadcast(data = '', msg = 'ok', code = 0, connections = null) {
    if (connections === null && is.empty(this.connections)) {
      return;
    }
    data = JSON.stringify({
      request_id: _uuid_salt(this.app_id),
      timestamp: (new Date()).getTime(),
      code,
      message: msg,
      data: data
    });
    if (connections === null) {
      Object.keys(this.connections).map((id) => this.connections[id].send(data));
    } else if (is.array(connections)) {
      connections.map((conn) => conn.send(data));
    } else if (is.object(connections)) {
      Object.keys(connections).map((id) => connections[id].send(data));
    }
  }
}

module.exports = WebSocketApplication;
