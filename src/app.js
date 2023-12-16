'use strict';

const EventEmitter = require('events');
const { v4 } = require('uuid');
const Validator = require('validatorjs');

const { Configuration, Workflow, debug } = require('@axiosleo/cli-tool');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const is = require('@axiosleo/cli-tool/src/helper/is');

const { failed } = require('./response');
const { resolveRouters, initContext, getRouteInfo } = require('./core');

class Application extends EventEmitter {
  constructor(config) {
    super();
    this.config = new Configuration({
      debug: false,
      routers: [],
      app_id: '',
      ...config,
    });
    this.app_id = this.config.app_id || v4();
    this.routes = resolveRouters(this.config.routers);
    this.workflow = new Workflow(this.config.operator || {
      begin: async (context) => {
        this.trigger('receive', context);
      },
      validate: async (context) => {
        this.trigger('validate', context);
        if (context.router && context.router.validators) {
          const { query, body } = context.router.validators;
          const check = {};
          if (query) {
            const validation = new Validator(context.params, query.rules, query.messages || null);
            validation.check();
            if (validation.fails()) {
              const errors = validation.errors.all();
              check.query = errors;
            }
          }
          if (body) {
            const validation = new Validator(context.body, body.rules, body.messages || null);
            validation.check();
            if (validation.fails()) {
              const errors = validation.errors.all();
              check.body = errors;
            }
          }
          if (!is.empty(check)) {
            failed(check, '400;Bad Request Data');
          }
        }
      },
      middleware: async (context) => {
        this.trigger('middleware', context);

        // exec middleware by routes configuration
        if (context.router && context.router.middlewares && context.router.middlewares.length > 0) {
          await _foreach(context.router.middlewares, async (middleware) => {
            await middleware(context);
          });
        }
      },
      handle: async (context) => {
        this.trigger('controller', context);
        try {
          if (context.router && context.router.handlers && context.router.handlers.length > 0) {
            await _foreach(context.router.handlers, async (handler) => {
              await handler(context);
            });
          } else {
            this.trigger('notFound', context);
          }
        } catch (err) {
          context.response = err;
        }
      },
      done: async (context) => {
        this.trigger('done', context);
      }
    });
    this.event = new EventEmitter();
    this.trigger('start', this);
  }

  register(event_name, ...triggers) {
    this.event.on(event_name, ...triggers);
  }

  trigger(event_name, ...args) {
    return this.event.emit(event_name, ...args);
  }

  dispacher() {
    const app = this;
    const app_id = this.app_id;
    const routes = this.routes;
    const workflow = this.workflow;
    return async (ctx, next) => {
      let context = initContext(app, ctx, app_id);
      const router = getRouteInfo(routes, ctx.path, ctx.method);
      if (!router) {
        this.trigger('notFound', context);
        if (this.config.debug) {
          debug.log('[RouterNotFound]', ctx.path, ctx.method);
        }
        await next();
        return;
      }
      context.params = router && router.params ? router.params : {};
      context.body = ctx.request.body;
      context.query = ctx.request.query ? JSON.parse(JSON.stringify(ctx.request.query)) : {};
      context.headers = ctx.request.headers;
      context.router = router;
      try {
        await workflow.start(context);
      } catch (exContext) {
        context = exContext;
      }
      if (!context.response && context.curr && context.curr.error) {
        context.response = context.curr.error || new Error('unknown error');
      }
      if (context.response) {
        this.trigger('response', context);
      }
    };
  }

  async start() {
    throw new Error('not implemented');
  }
}

module.exports = Application;
