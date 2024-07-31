'use strict';

const { Application, KoaApplication, NetSocketApplication } = require('./src/apps');
const Controller = require('./src/controller');
const { Router } = require('./src/router');
const response = require('./src/response');
const Model = require('./src/model');

module.exports = {
  Controller,
  Application,
  KoaApplication,
  NetSocketApplication,

  Model,
  Router,
  ...response
};
