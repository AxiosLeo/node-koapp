'use strict';

const os = require('os');
const { debug, printer } = require('@axiosleo/cli-tool');
const Validator = require('validatorjs');
const is = require('@axiosleo/cli-tool/src/helper/is');
const { failed, error, HttpResponse, HttpError } = require('./response');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { getRouteInfo } = require('./core');
const { _str, _fixed } = require('@axiosleo/cli-tool/src/helper/str');

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
      const wide = 12;
      printer.println('-'.repeat(30) + '[DEBUG Info]' + '-'.repeat(30));
      printer.yellow(_fixed('method', wide)).print(': ').green(context.method).println();
      ['pathinfo', 'validators'].forEach(k => {
        if (is.empty(router[k])) {
          return;
        }
        printer.yellow(_fixed(k, wide)).print(': ').println(typeof router[k] === 'object' ? JSON.stringify(router[k]) : _str(router[k]));
      });
      ['query', 'params', 'body'].forEach(k => {
        if (is.empty(context[k])) {
          return;
        }
        printer.yellow(_fixed(k, wide)).print(': ').println(typeof context[k] === 'object' ? JSON.stringify(context[k]) : _str(context[k]));
      });
      printer.println('-'.repeat(72));
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
      const { params, query, body } = context.router.validators;
      const check = {};
      if (!is.empty(params)) {
        const validation = new Validator(context.params, params.rules, params.messages || null);
        validation.check();
        if (validation.fails()) {
          const errors = validation.errors.all();
          check.params = errors;
        }
      }
      if (!is.empty(query)) {
        const validation = new Validator(context.query, query.rules, query.messages || null);
        validation.check();
        if (validation.fails()) {
          const errors = validation.errors.all();
          check.query = errors;
        }
      }
      if (!is.empty(body)) {
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
    const err = new Error();
    printer.yellow('[DEBUG] ');
    debug.log({ response: context.response, stack: err.stack });
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
  } else {
    printer.yellow('[DEBUG] ');
    debug.log(context.response);
    response = new HttpResponse({
      status: 500,
      data: 'Internal Server Error'
    });
  }
  context.response = response;
  if (context.app.config.debug) {
    printer.yellow('[DEBUG] ');
    if (context.response.stack) {
      let tmp = context.response.stack.split(os.EOL);
      let t1 = tmp[3] ? tmp[3].trim() : '';
      let t2 = tmp[4] ? tmp[4].trim() : '';
      if (t1.startsWith('at /')) {
        printer.print('response '.data).print(t1.warning).println();
      } else if (t2.startsWith('at /')) {
        printer.print('response '.data).print(t2.warning).println();
      }
      // eslint-disable-next-line no-console
      console.log('required id: ', context.request_id);
      // eslint-disable-next-line no-console
      console.log(context.response.data);
    } else {
      debug.log('response', context.response);
    }
  }
  context.app.emit('response', context);
}

/**
 * Executes the after logic for the given context.
 * @param {import("..").KoaContext & { app: import("..").Application}} context - The context object.
 */
async function after(context) {
  try {
    context.app.emit('request_end', context);
    if (context.router && context.router.afters && context.router.afters.length > 0) {
      await _foreach(context.router.afters, async (after) => {
        try {
          await after(context);
        } catch (err) {
          context.app.emit('after_error', context, err);
        }
      });
    }
  } catch (err) {
    context.response = err;
  }
}

module.exports = {
  receive,
  validate,
  middleware,
  handle,
  response,
  after
};
