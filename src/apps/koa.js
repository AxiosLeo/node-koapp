'use strict';

const KoaBodyParser = require('koa-bodyparser');
const session = require('koa-session');
const KoaStaticServer = require('koa-static-server');
const path = require('path');
const Koa = require('koa');
const { initContext } = require('../core');
const { printer, Workflow } = require('@axiosleo/cli-tool');
const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');
const flowOperator = require('../workflows/koa.workflow');

const Application = require('./app');

/**
 * @param {import('./index').KoaContext} context 
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
        rootDir: path.join(process.cwd(), './public'),
        // uploadDir: path.join(process.cwd(), './public/upload'), // default is undefined. Once this configuration is set, files will be transferred to this path.
      },
      body_parser: {},
      sse: false, // { pingInterval: 60000, closeEvent: "close" }
    }, config);

    printer.println().green('start on ').println(`http://localhost:${config.port}`).println();
    super(config);
    this.workflow = new Workflow(flowOperator);
    this.koa = new Koa(this.config.server);

    // session middleware
    if (this.config.session) {
      this.koa.keys = [this.app_id];
      this.koa.use(session({
        key: this.config.session_key || 'koa.sess', /** (string) cookie key (default is koa.sess) */
        ...this.config.session
      }, this.koa));
    }

    // body parser
    this.koa.use(KoaBodyParser(this.config.body_parser));

    // dispatcher request
    const self = this;
    this.koa.use(async (ctx, next) => {
      let context = initContext({
        app: self,
        method: ctx.req.method ? ctx.req.method : '',
        pathinfo: ctx.req.url ? ctx.req.url : '/',
        app_id: self.app_id,
      });
      context.koa = ctx;
      context.url = ctx.req.url ? ctx.req.url : '/';
      try {
        await self.workflow.start(context);
      } catch (exContext) {
        context = exContext;
        await next();
      }
    });

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
