const { debug } = require('@axiosleo/cli-tool');
const { WebSocketApplication } = require('../src/apps');
const root = require('./api.router');

const app = new WebSocketApplication({
  routers: [root],
  port: 8081,
  ping: {
    open: false,
    interval: 1000 * 3,
    data: 'this is a ping message'
  }
});

setInterval(() => {
  debug.log('send message');
  const res = app.broadcast('Hello, world!', 'ok', 0, null);
  debug.log('send message result:', res);
}, 1000);

app.start();
