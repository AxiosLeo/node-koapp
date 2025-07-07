'use strict';

const SocketApplication = require('../src/apps/socket');

const root = require('./api.router');

const app = new SocketApplication({
  routers: [root],
  ping: {
    open: true,
    interval: 1000 * 10,
    data: 'this is a ping message.'
  }
});

app.start();
