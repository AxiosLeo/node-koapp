'use strict';

const { Configuration, Workflow } = require('@axiosleo/cli-tool');
const { _sync_foreach } = require('@axiosleo/cli-tool/src/helper/cmd');
const EventEmitter = require('events');
const { v4, v5, validate } = require('uuid');

const resolvePathinfo = (pathinfo) => {
  let trace = [];
  if (!pathinfo || pathinfo === '/') {
    trace = ['@'];
  } else if (pathinfo[0] !== '/') {
    throw new Error('Invalid route path, should be start with "/". ');
  } else {
    pathinfo = '@' + pathinfo;
    trace = pathinfo.split('/');
  }
  return trace;
};

const recur = (tree, prefix, router, middlewares = []) => {
  const middlewaresClone = router.middlewares && router.middlewares.length > 0 ?
    middlewares.concat(router.middlewares) : middlewares.concat();
  prefix = prefix + router.prefix;
  if (router.routers && router.routers.length) {
    router.routers.forEach((item) => {
      recur(tree, prefix, item, middlewaresClone);
    });
  }
  const trace = resolvePathinfo(prefix);
  const params = [];
  let curr = tree;
  let key = '';
  if (trace.length > 1) {
    trace.forEach((t) => {
      if (t.indexOf('{:') === 0) {
        key = '*';
        params.push(t.substring(2, t.length - 1));
      } else {
        key = t;
      }
      if (!curr[key]) {
        curr[key] = {};
      }
      curr = curr[key];
    });
    if (!curr['__route___']) {
      curr['__route___'] = [
        {
          prefix,
          params,
          router,
          middlewares: middlewaresClone,
        }
      ];
    } else {
      curr['__route___'].push({
        prefix,
        params,
        router,
        middlewares: middlewaresClone,
      });
    }
  }
};

const resolveRouters = (routers = []) => {
  const tree = {};
  routers.forEach(item => recur(tree, '', item, []));
  return tree;
};

const getRouter = (item) => {
  let route = [];
  if (item && item['__route___']) {
    route = item['__route___'];
  } else if (item && item[''] && item['']['__route___']) {
    route = item['']['__route___'];
  } else if (item && item['***']) {
    return getRouter(item['***']);
  }
  return route;
};

const getRouteInfo = (routers, pathinfo, method) => {
  const trace = resolvePathinfo(pathinfo);
  let curr = routers;
  let step = 0;
  const params = [];
  while (step < trace.length) {
    const tag = trace[step];
    step++;
    if (tag === '@') {
      if (!curr[tag]) {
        curr = null;
        break;
      }
      curr = curr[tag];
    } else if (curr[tag]) {
      // has key
      curr = curr[tag];
    } else if (curr['*']) {
      params.push(tag);
      curr = curr['*'];
    } else if (curr['**']) {
      curr = curr['**'];
    } else if (curr['***']) {
      curr = curr['***'];
      break;
    } else {
      curr = null;
      break;
    }
  }
  // console.log(JSON.stringify(routers, null, 2));
  const routes = getRouter(curr);
  if (routes.length) {
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const methods = route.router.method.toUpperCase().split('|');
      if (methods.indexOf('ANY') > -1 || methods.indexOf(method) > -1) {
        const routeInfo = {
          pathinfo,
          params: {},
          handlers: route.router.handlers ? route.router.handlers : [],
          middlewares: route.middlewares,
        };
        if (route.params && route.params.length) {
          route.params.forEach((item, index) => {
            if (typeof params[index] !== 'undefined') {
              routeInfo.params[item] = params[index];
            }
          });
        }
        return routeInfo;
      }
    }
    return null;
  }
  return null;
};

/**
 * 
 * @param {Application} app 
 * @param {Koa.ParameterizedContext} ctx 
 * @param {string} app_id 
 * @returns 
 */
const initContext = (app, ctx, app_id) => {
  const context = {
    app,
    koa: ctx,
    app_id: app_id,
    curr: {},
    step_data: {},
    method: ctx.req.method ? ctx.req.method : '',
    url: ctx.req.url ? ctx.req.url : '/',
    request_id: `${v5(v4(), !validate(app_id) ? v4() : app_id)}`
  };
  return context;
};

class Application extends EventEmitter {
  constructor(config) {
    super();
    this.config = new Configuration({
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
      middleware: async (context) => {
        this.trigger('middleware', context);

        // exec middleware by routes configuration
        if (context.router && context.router.middlewares && context.router.middlewares.length > 0) {
          await _sync_foreach(context.router.middlewares, async (middleware) => {
            await middleware(context);
          });
        }
      },
      handle: async (context) => {
        this.trigger('controller', context);
        try {
          if (context.router && context.router.handlers && context.router.handlers.length > 0) {
            await _sync_foreach(context.router.handlers, async (handler) => {
              await handler(context);
            });
          } else {
            this.trigger('notFound', context);
          }
        } catch (err) {
          context.response = err;
        }
      },
      response: async (context) => {
        this.trigger('response', context);
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
      const context = initContext(app, ctx, app_id);
      const router = getRouteInfo(routes, ctx.path, ctx.method);
      if (!router) {
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
        if (!exContext.response && exContext.curr) {
          exContext.response = exContext.curr.error || new Error('unknown error');
        }
        this.trigger('response', exContext);
      }
      this.trigger('done', context);
    };
  }

  async start() {
    throw new Error('not implemented');
  }
}

module.exports = Application;
