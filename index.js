'use strict';

const Application = require('./src/app');
const Controller = require('./src/controller');
const KoaBodyParser = require('koa-bodyparser');
const { Router } = require('./src/router');
const { printer } = require('@axiosleo/cli-tool');
const response = require('./src/response');
const session = require('koa-session');
const KoaStaticServer = require('koa-static-server');
const path = require('path');
const is = require('@axiosleo/cli-tool/src/helper/is');
const Koa = require('koa');
const Model = require('./src/model');
const { dispacher } = require('./src/core');
const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');

/**
 * 
 * @param {import('./index').KoaContext} context 
 */
const handleRes = (context) => {
  let response = context.response;
  context.koa.type = response.format;
  if (is.object(response.data)) {
    response.data.request_id = context.request_id;
    response.data.timestamp = (new Date()).getTime();
  }
  Object.keys(response.headers).forEach(k => {
    context.koa.set(k, response.headers[k]);
  });
  context.koa.body = response.data || '';
  context.koa.response.status = response.status;
};

class KoaApplication extends Application {
  constructor(config = {}) {
    config = _assign({
      port: 8080,
      listen_host: 'localhost',
      debug: false,
      routers: [],
      app_id: '',
      session: {
        /** (number || 'session') maxAge in ms (default is 1 days) */
        /** 'session' will result in a cookie that expires when session/browser is closed */
        /** Warning: If a session cookie is stolen, this cookie will never expire */
        maxAge: 1296000000, // ms, 15 days
        // autoCommit: true, /** (boolean) automatically commit headers (default true) */
        overwrite: true, /** (boolean) can overwrite or not (default true) */
        httpOnly: true, /** (boolean) httpOnly or not (default true) */
        signed: true, /** (boolean) signed or not (default true) */
        rolling: false, /** (boolean) Force a session identifier cookie to be set on every response. The expiration is reset to the original maxAge, resetting the expiration countdown. (default is false) */
        renew: true, /** (boolean) renew session when session is nearly expired, so we can always keep user logged in. (default is false)*/
        // secure: process.env.DEBUG ? false : true, /** (boolean) secure cookie*/
        secure: false,
        // sameSite: null, /** (string) session cookie sameSite options (default null, don't set it) */
      },
      static: {
        rootDir: path.join(__dirname, './public'),
      },
    }, config);

    printer.input('-'.repeat(60));
    printer.green('start on ').println(`http://localhost:${config.port}`).println();
    super(config);
    this.koa = new Koa();

    // session middleware
    if (this.config.session) {
      this.koa.keys = [this.app_id];
      let sessionconfig = {
        key: `koa.sess.${this.app_id}`
      };
      _assign(sessionconfig, this.config.session);
      this.koa.use(session({
        key: `koa.sess.${this.app_id}`, /** (string) cookie key (default is koa.sess) */
        ...this.config.session
      }, this.koa));
    }

    // body parser
    this.koa.use(KoaBodyParser(this.config.body_parser));

    // dispacher request
    this.koa.use(dispacher({
      app: this,
      app_id: this.app_id,
      workflow: this.workflow,
      routes: this.routes
    }));

    // koa static services
    if (this.config.static) {
      this.koa.use(KoaStaticServer(this.config.static));
    }
    this.on('response', handleRes);

    this.emit('koa_init', this);
  }

  async start() {
    // set '0.0.0.0' for public access
    this.koa.listen(this.config.port, this.config.listen_host);
  }
}

module.exports = {
  Controller,
  Application,
  KoaApplication,

  Model,
  Router,
  ...response
};
