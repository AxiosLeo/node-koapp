'use strict';

const { Application, KoaApplication } = require('./src/apps');
const Controller = require('./src/controller');
const { Router } = require('./src/router');
const response = require('./src/response');
const Model = require('./src/model');
const { KoaSSEMiddleware } = require('./src/middlewares/sse');
const { initContext } = require('./src/core');
const multer = require('@koa/multer');
const session = require('koa-session');

module.exports = {
  Controller,
  Application,
  KoaApplication,

  Model,
  Router,

  middlewares: {
    KoaSSEMiddleware,
    KoaMulterMiddleware: multer,
    KoaSessionMiddleware: session
  },

  // functions
  ...response,
  initContext
};
