'use strict';

const Application = require('./src/app');
const Controller = require('./src/controller');
const KoaBodyParser = require('koa-bodyparser');
const { Router } = require('./src/router');
const { printer, debug } = require('@axiosleo/cli-tool');
const { HttpResponse, error, HttpError, success, result, failed } = require('./src/response');
const response = require('./src/response');
const session = require('koa-session');
const KoaStaticServer = require('koa-static-server');
const path = require('path');
const is = require('@axiosleo/cli-tool/src/helper/is');
const Koa = require('koa');

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
      // body_parser: undefined,
      ...config
    });
    this.koa = new Koa();
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
        response = new HttpResponse({
          format: 'json',
          status: 500,
          data: {
            code: 500,
            message: 'Internal Server Error',
            data: {
              code: context.response.code,
              msg: context.response.message,
              stack: context.response.stack,
            },
          }
        });
        debug.log({ err: context.response });
      } else {
        response = new HttpResponse({
          status: 500,
          data: 'Internal Server Error'
        });
      }
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
    });

    this.register('error', async (context) => {
      try {
        const errorIns = context.curr.error;
        if (errorIns instanceof HttpError) {
          error(errorIns.status, errorIns.message, errorIns.headers);
        } else if (errorIns instanceof HttpResponse) {
          this.trigger('response', context);
        } else if (this.config.debug) {
          error(500, context.curr.error ? context.curr.error.message : 'Internal Server Error');
        } else {
          error(500, 'Internal Server Error');
        }
      } catch (err) {
        context.curr.error = err;
        this.trigger('response', context);
      }
    });
    if (this.config.session) {
      this.koa.keys = [this.app_id];
      this.koa.use(session({
        key: `koa.sess.${this.app_id}`, /** (string) cookie key (default is koa.sess) */
        ...this.config.session
      }, this.koa));
    }
    this.koa.use(KoaBodyParser(this.config.body_parser));
    this.koa.use(this.dispacher());
    if (this.config.static) {
      this.koa.use(KoaStaticServer(this.config.static));
    }
    this.trigger('koa_init', this);
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

  Router,
  ...response
};

if (require.main === module) {
  const handle = async (context) => {
    success({
      body: context.koa.request.body,
      query: context.koa.request.query,
      params: context.params
    });
  };
  const app = new KoaApplication({
    debug: true,
    routers: [new Router('/none', {
      method: 'get',
      handlers: [async (context) => {
        context.koa.body = 'hello, world!';
      }]
    }), new Router('/test/{:a}', {
      method: 'any',
      handlers: [handle]
    }), new Router('/test/', {
      method: 'any',
      handlers: [handle]
    }), new Router('/error', {
      method: 'any',
      handlers: [async () => {
        throw new Error('error');
      }]
    }), new Router('/failed', {
      method: 'any',
      handlers: [async () => {
        failed({
          code: 500,
        });
      }]
    }), new Router('/result', {
      method: 'any',
      handlers: [async () => {
        result(JSON.stringify({ hello: 'World!' }), 200, {
          'Content-Type': 'application/json'
        });
      }]
    }), new Router('/success', {
      method: 'any',
      handlers: [async () => {
        success('Hello, World!');
      }]
    })]
  });
  app.start();
}
