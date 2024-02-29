'use strict';

const { v4, v5, validate } = require('uuid');
const is = require('@axiosleo/cli-tool/src/helper/is');

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

const recur = (tree, prefix, router, middlewares = [], afters = []) => {
  const middlewaresClone = router.middlewares && router.middlewares.length > 0 ?
    middlewares.concat(router.middlewares) : middlewares.concat();
  const aftersClone = router.afters && router.afters.length > 0 ?
    afters.concat(router.afters) : afters.concat();
  if (router.prefix) {
    prefix = prefix + router.prefix;
  }
  if (router.routers && router.routers.length) {
    router.routers.forEach((item) => {
      recur(tree, prefix, item, middlewaresClone, aftersClone);
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
    let routeNode = {};
    if (!is.empty(params)) {
      routeNode.params = params;
    }
    if (router.method) {
      routeNode.method = router.method;
    }
    if (!is.empty(router.handlers)) {
      routeNode.handlers = router.handlers;
    }
    if (!is.empty(router.validators)) {
      routeNode.validators = router.validators;
    }
    if (!is.empty(middlewaresClone)) {
      routeNode.middlewares = middlewaresClone;
    }
    if (!is.empty(aftersClone)) {
      routeNode.afters = aftersClone;
    }

    if (!is.empty(routeNode)) {
      if (!curr['__route___']) {
        curr['__route___'] = [routeNode];
      } else {
        curr['__route___'].push(routeNode);
      }
    }
  }
};

const resolveRouters = (routers = []) => {
  if (!is.array(routers)) {
    routers = [routers];
  }
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

const getRouterItem = ({ routes, method, pathinfo, params }) => {
  if (!routes) {
    return null;
  }
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const methods = route.method ? route.method.split('|') : [];
    if (methods.indexOf('ANY') > -1 || methods.indexOf(method) > -1) {
      const routeInfo = {
        pathinfo,
        params: {},
        methods: methods,
        validators: route.validators ? route.validators : { params: {}, body: {}, query: {} },
        handlers: route.handlers ? route.handlers : [],
        middlewares: route.middlewares ? route.middlewares : [],
        afters: route.afters ? route.afters : []
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
};

const getRouteInfo = (routers, pathinfo, method) => {
  const trace = resolvePathinfo(pathinfo);
  let curr = routers;
  let step = 0;
  const params = [];
  let traceDefault = null;
  while (step < trace.length) {
    const tag = trace[step];
    step++;
    if (curr['***']) {
      traceDefault = curr['***'];
    }
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
  if (curr === null && traceDefault !== null) {
    curr = traceDefault;
  }
  let routes = getRouter(curr);
  if (routes.length) {
    let routerInfo = getRouterItem({ routes, method, pathinfo, params });
    if (routerInfo) {
      return routerInfo;
    }
  }
  if (traceDefault) {
    routes = getRouter(traceDefault);
    if (routes.length) {
      return getRouterItem({ routes, method, pathinfo, params });
    }
  }
  return null;
};

/**
 * @param {import('..').Application} app 
 * @param {import('koa').ParameterizedContext} ctx 
 * @param {string} app_id 
 * @returns {import('..').KoaContext}
 */
const initContext = (app, ctx, app_id, routes) => {
  const context = {
    app,
    koa: ctx,
    app_id,
    curr: {},
    step_data: {},
    method: ctx.req.method ? ctx.req.method : '',
    url: ctx.req.url ? ctx.req.url : '/',
    request_id: `${v5(v4(), !validate(app_id) ? v4() : app_id)}`,
    routes
  };
  return context;
};

/**
 * @param {import('..').Application} app 
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

module.exports = {
  dispatcher,
  initContext,
  getRouteInfo,
  resolveRouters,
};
