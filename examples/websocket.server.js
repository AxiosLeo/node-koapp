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

app.start();
