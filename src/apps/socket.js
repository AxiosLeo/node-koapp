'use strict';

const net = require('net');
const EventEmitter = require('events');
const Application = require('./app');
const { debug, printer } = require('@axiosleo/cli-tool');

class SocketApplication extends Application {
  constructor(config = {}) {
    super(config);
    this.event = new EventEmitter();
    this.port = this.config.port || 8081;
    this.connections = {};
  }

  async start() {
    const server = net.createServer((connection) => {
      this.event.emit('connection', connection);
      connection.pipe(connection);
      connection.on('data', function (data) {
        try {
          debug.dump(Buffer.from(data).toString());
          // const context = JSON.parse(data.toString());
          // if (context.action === 'server.connect' && context.code) {
          //   conn.id = context.code;
          //   this.connections[conn.id] = conn;
          // } else {
          //   this.dispatch(context, conn);
          // }
        } catch (err) {
          debug.log(err);
        }
      });
    });
    server.listen(this.port, () => {
      printer.info(`Server is running on port ${this.port}`);
      this.event.emit('listen', this.port);
    });
  }

  async dispatch(context, conn) {
    const connections = this.connections;
    const action = context.action;
    switch (action) {
      case 'broadcast': {
        const conns = Object.keys(connections);
        // debug.log('connections:', conns.length);
        if (conns.length) {
          conns.map(id => connections[id].connection.write(JSON.stringify(context.data)));
        }
        break;
      }
      default: {
        debug.log(context);
      }
    }
  }
}

module.exports = SocketApplication;
