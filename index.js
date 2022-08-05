'use strict';

const Application = require('./src/app');
const Controller = require('./src/controller');
const Koa = require('koa');
const KoaBodyParser = require('koa-bodyparser');
const { Router } = require('./src/router');
const { printer, debug } = require('@axiosleo/cli-tool');
const { HttpResponse, error, HttpError, success } = require('./src/response');
const response = require('./src/response');
const session = require('koa-session');
const KoaStaticServer = require('koa-static-server');
const path = require('path');

class KoaApplication extends Application {
  constructor(config = {}) {
    super({
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
      ...config
    });
    printer.input('-'.repeat(60));
    printer.green('OpenAPI service start on ')
      .println(`http://localhost:${this.config.port}`).println();

    this.register('receive', async (context) => {
      if (context.app.debug) {
        printer.input('receive request : ' + context.request_id);
        if (context.koa.request.body) {
          debug.dump(context.koa.request.body);
        }
      }
    });
    this.register('response', async (context) => {
      let response;
      if (context.response instanceof HttpResponse) {
        response = context.response;
      } else if (this.config.debug) {
        response = new HttpResponse(500, {
          code: 500,
          message: 'Internal Server Error',
          data: {
            code: context.response.code,
            msg: context.response.message,
            stack: context.response.stack,
          },
          config: this.config
        });
      } else {
        debug.log(context.response);
        response = new HttpResponse(500, {
          code: 500,
          message: 'Internal Server Error',
          data: null,
        });
      }
      context.koa.type = response.format;
      response.data.request_id = context.request_id;
      response.data.timestamp = (new Date()).getTime();
      context.koa.body = JSON.stringify(response.data);
      context.koa.response.status = response.status;
    });

    this.register('error', async (context) => {
      try {
        const errorIns = context.curr.error;
        if (errorIns instanceof HttpError) {
          error(errorIns.status, errorIns.message, errorIns.headers);
        } else if (errorIns instanceof HttpResponse) {
          this.trigger('response', context);
        } else if (this.config.debug) {
          debug.dump('error:', context.curr.error);
          error(500, context.curr.error ? context.curr.error.message : 'Internal Server Error');
        } else {
          error(500, 'Internal Server Error');
        }
      } catch (err) {
        context.curr.error = err;
        this.trigger('response', context);
      }
    });
  }

  async start() {
    const koa = new Koa();
    if (this.config.session) {
      koa.use(session({
        key: `koa.sess.${this.app_id}`, /** (string) cookie key (default is koa.sess) */
        ...this.config.session
      }, koa));
    }
    koa.use(KoaBodyParser());
    koa.use(this.dispacher());
    if (this.config.static) {
      koa.use(KoaStaticServer(this.config.static));
    }

    // set '0.0.0.0' for public access
    koa.listen(this.config.port, this.config.listen_host);
  }
}

module.exports = {
  Controller,
  Application,
  KoaApplication,

  Router,
  ...response
};

if (require.main === module) {
  const app = new KoaApplication({
    routers: [new Router('/test', {
      method: 'any',
      handlers: [async () => {
        success('Hello, World!');
      }]
    })]
  });
  app.start();
}
