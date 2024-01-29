'use strict';

const { debug } = require('@axiosleo/cli-tool');
const Validator = require('validatorjs');
const is = require('@axiosleo/cli-tool/src/helper/is');
const { failed, error, HttpResponse, HttpError } = require('./response');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { getRouteInfo } = require('./core');

/**
 * receive request
 * @param {import("..").KoaContext} context 
 */
async function receive(context) {
  try {
    context.app.emit('receive', context);
    const router = getRouteInfo(context.routes, context.koa.path, context.koa.method);
    if (!router) {
      error(404, 'Not Found');
    }
    context.params = router && router.params ? router.params : {};
    context.method = context.koa.method;
    context.body = context.koa.request.body;
    context.query = context.koa.request.query ? JSON.parse(JSON.stringify(context.koa.request.query)) : {};
    context.headers = context.koa.request.headers;
    context.router = router;
    if (context.app.config.debug) {
      debug.log('request router: ', router);
    }
  } catch (err) {
    context.response = err;
    return 'response';
  }
}

/**
 * validate request
 * @param {import("..").KoaContext} context 
 */
async function validate(context) {
  try {
    context.app.emit('validate', context);
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
        failed(check, '400;Bad Request Data', 400);
      }
    }
  } catch (err) {
    context.response = err;
    return 'response';
  }
}

/**
 * exec middleware for common request
 * @param {import("..").KoaContext} context 
 */
async function middleware(context) {
  try {
    context.app.emit('middleware', context);
    // exec middleware by routes configuration
    if (context.router && context.router.middlewares && context.router.middlewares.length > 0) {
      await _foreach(context.router.middlewares, async (middleware) => {
        await middleware(context);
      });
    }
  } catch (err) {
    context.response = err;
    return 'response';
  }
}

/**
 * handle request
 * @param {import("..").KoaContext} context 
 */
async function handle(context) {
  try {
    context.app.emit('handle', context);
    if (context.router && context.router.handlers
      && context.router.handlers.length > 0) {
      await _foreach(context.router.handlers, async (handler) => {
        await handler(context);
      });
    }
  } catch (err) {
    context.response = err;
    return;
  }
}

/**
 * set response
 * @param {import("..").KoaContext} context 
 */
async function response(context) {
  if (!context.response) {
    return;
  }
  if (!context.response && context.curr && context.curr.error) {
    context.response = context.curr.error || new Error('unknown error');
  }
  let response;
  if (context.response instanceof HttpResponse) {
    response = context.response;
  } else if (context.response instanceof HttpError) {
    response = new HttpResponse({
      format: 'json',
      status: context.response.status,
      data: {
        message: context.response.message,
      },
    });
  } else if (context.app.config.debug) {
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
    const err = new Error();
    debug.log(err);
    debug.log({ err: context.response });
  } else {
    response = new HttpResponse({
      status: 500,
      data: 'Internal Server Error'
    });
  }
  context.response = response;
  if (context.app.config.debug) {
    if (context.response.data) {
      debug.log('response', context.response.data);
    } else {
      debug.log('response', context.response);
    }
  }
  context.app.emit('response', context);
}

module.exports = {
  receive,
  validate,
  middleware,
  handle,
  response
};
