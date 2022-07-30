'use strict';

const Application = require('./src/app');
const Controller = require('./src/controller');
const Koa = require('koa');
const KoaBodyParser = require('koa-bodyparser');
const { Router } = require('./src/router');
const { printer } = require('@axiosleo/cli-tool');
const { HttpResponse, error, HttpError, success } = require('./src/response');
const response = require('./src/response');

class KoaApplication extends Application {
  constructor(config = {}) {
    const debug = process.env.DEPLOY_MODE === 'dev' ? true : false;
    super({
      port: 8080,
      listen_host: 'localhost',
      debug,
      routers: [],
      app_id: '',
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
      } else {
        response = new HttpResponse(500, {});
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
        } else if (context.app.debug) {
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
    koa.use(KoaBodyParser());
    koa.use(this.dispacher());

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
      handlers: [async (ctx) => {
        success({
          test: '123'
        });
      }]
    })]
  });
  app.start();
}
