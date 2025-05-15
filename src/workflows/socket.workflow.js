'use strict';

const os = require('os');
const { printer } = require('@axiosleo/cli-tool');
const { getRouteInfo } = require('../core');
const { error, failed, HttpResponse, HttpError } = require('../response');
const is = require('@axiosleo/cli-tool/src/helper/is');
const Validator = require('validatorjs');
const { _foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const { _debug } = require('../utils');

/**
 * @param {import('../../index').SocketContext} context 
 * @returns 
 */
function receive(context) {
  try {
    context.app.emit('receive', context);
    const router = getRouteInfo(context.app.routes, context.pathinfo, context.method);
    if (!router) {
      error(404, 'Not Found');
    }
    context.params = router && router.params ? router.params : {};
    context.router = router;
  } catch (err) {
    context.response = err;
    return 'response';
  }
}

/**
 * @param {import('../../index').SocketContext} context 
 * @returns 
 */
function validate(context) {
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
 * @param {import('../../index').SocketContext} context 
 * @returns 
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
 * @param {import('../../index').SocketContext} context 
 * @returns 
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
 * @param {import('../../index').SocketContext} context 
 * @returns 
 */
function response(context) {
  if (!context.response) {
    return;
  }
  if (!context.response && context.curr && context.curr.error) {
    context.response = context.curr.error || new Error('unknown error');
  }
  let response;
  let error;
  if (context.response instanceof HttpResponse) {
    response = context.response;
  } else if (context.response instanceof HttpError) {
    response = new HttpResponse({
      format: 'json',
      status: context.response.status,
      message: context.response.message,
      data: {}
    });
  } else if (context.app.config.debug) {
    error = context.response;
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
    error = context.response;
    response = new HttpResponse({
      status: 500,
      data: 'Internal Server Error'
    });
  }
  context.response = response;
  if (error) {
    _debug(context, '', error);
    printer.red('requestError').print(': ');
    // eslint-disable-next-line no-console
    console.log(error);
  }
  if (context.app.config.debug && !error) {
    let tmp = context.response.stack.split(os.EOL);
    let t = tmp.find((s) => !s.startsWith('Error:') && s.indexOf('node_modules') === -1);
    _debug(context, t);
  }
  context.app.emit('response', context);
}

/**
 * @param {import('../../index').SocketContext} context 
 * @returns 
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
