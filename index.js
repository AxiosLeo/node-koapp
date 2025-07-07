'use strict';

const Controller = require('./src/controller');
const { Router } = require('./src/router');
const response = require('./src/response');
const Model = require('./src/model');
const { KoaSSEMiddleware } = require('./src/middlewares/sse');
const { initContext } = require('./src/core');
const multer = require('@koa/multer');
const session = require('koa-session');
const { SocketClient } = require('./src/utils');
const {
  Application,
  KoaApplication,
  SocketApplication,
  WebSocketApplication
} = require('./src/apps');

module.exports = {
  Controller,
  Application,
  KoaApplication,
  SocketApplication,
  WebSocketApplication,

  Model,
  Router,

  middlewares: {
    KoaSSEMiddleware,
    KoaMulterMiddleware: multer,
    KoaSessionMiddleware: session
  },

  // functions
  ...response,
  initContext,

  SocketClient
};
