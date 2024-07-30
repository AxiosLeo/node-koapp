'use strict';

const KoaBodyParser = require('koa-bodyparser');
const session = require('koa-session');
const KoaStaticServer = require('koa-static-server');
const multer = require('@koa/multer');
const path = require('path');
const Koa = require('koa');
const { printer } = require('@axiosleo/cli-tool');
const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');

const Application = require('./app');
const { _request_id } = require('../utils');

/**
 * @param {import('..').Application} app 
 * @param {import('koa').ParameterizedContext} ctx 
 * @param {string} app_id 
 * @returns {import('../../').KoaContext}
 */
const initContext = (app, ctx, app_id, routes) => {
  const context = {
    app,
    koa: ctx,
    app_id,
    curr: {},
    step_data: {},
    request_id: _request_id(app_id),
    routes,

    method: ctx.req.method ? ctx.req.method : '',
    path: ctx.path ? ctx.path : '',
    url: ctx.req.url ? ctx.req.url : '/',
    body: ctx.request.body,
    query: ctx.request.query ? JSON.parse(JSON.stringify(ctx.request.query)) : {},
    headers: ctx.request.headers,
    files: ctx.request.files || [],
    file: ctx.request.file || null
  };
  return context;
};

/**
 * @param {import('.').Application} app 
 */
const dispatcher = ({ app, app_id, workflow, routes }) => {
  return async (ctx, next) => {
    let context = initContext(app, ctx, app_id, routes);
    try {
      await workflow.start(context);
    } catch (exContext) {
      context = exContext;
      await next();
    }
  };
};

/**
 * @param {import('../../index').KoaContext} context 
 */
const handleRes = (context) => {
  let response = context.response;
  if (response.format === 'json' && response.notResolve !== true) {
    let code, message;
    if (response.code) {
      [code, message] = response.code.split(';');
    }
    response.data = {
      request_id: context.request_id,
      timestamp: (new Date()).getTime(),
      code: code || `${response.status}`,
      message: message || context.response.message,
      data: response.data,
    };
  }
  context.koa.type = response.format;
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
      // session_key: '',
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
      body_parser: {}
    }, config);

    printer.println().green('start on ').println(`http://localhost:${config.port}`).println();
    super(config);
    this.koa = new Koa(this.config.server);

    // session middleware
    if (this.config.session) {
      this.koa.keys = [this.app_id];
      this.koa.use(session({
        key: this.config.session_key || 'koa.sess', /** (string) cookie key (default is koa.sess) */
        ...this.config.session
      }, this.koa));
    }

    const upload = multer({
      dest: config.static.rootDir
    });
    this.koa.use(upload.any());

    // body parser
    this.koa.use(KoaBodyParser(this.config.body_parser));

    // dispatcher request
    this.koa.use(dispatcher({
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
  }

  async start() {
    this.emit('starting');
    // set '0.0.0.0' for public access
    this.koa.listen(this.config.port, this.config.listen_host);
  }
}

module.exports = KoaApplication;
