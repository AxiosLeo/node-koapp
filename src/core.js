'use strict';

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
  if (router.prefix) {
    prefix = prefix + router.prefix;
  }
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
  const routes = getRouter(curr);
  if (routes.length) {
    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const methods = route.router.method.toUpperCase().split('|');
      if (methods.indexOf('ANY') > -1 || methods.indexOf(method) > -1) {
        const routeInfo = {
          pathinfo,
          params: {},
          validators: route.router.validators ? route.router.validators : {},
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

module.exports = {
  initContext,
  getRouteInfo,
  resolveRouters,
};
