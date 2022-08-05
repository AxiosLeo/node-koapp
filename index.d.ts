import type KoaStaticServer from 'koa-static-server';
import type Koa from 'koa';
import type { Context, Configuration, App } from '@axiosleo/cli-tool';
import type { IncomingHttpHeaders } from 'http';

type StatusCode = string | '000;Unknown Error' |
  '200;Success' | '404;Not Found' |
  '500;Internal Server Error' |
  '400;Bad Data' | '401;Unauthorized' |
  '403;Not Authorized' | '400;Invalid Signature' |
  '501;Failed' | '409;Data Already Exists';

export function response(data: unknown, code?: StatusCode, httpstatus?: number, headers?: Record<string, string>): void;
export function result(data: unknown, httpstatus?: number, headers?: Record<string, string>): void;
export function success(data?: unknown, headers?: Record<string, string>): void;
export function failed(data?: unknown, code?: StatusCode, httpstatus?: number, headers?: Record<string, string>): void;
export function error(httpstatus: number, msg: string, headers?: Record<string, string>): void;
export function log(...data: any): void;

export declare class HttpResponse extends Error {
  public readonly status: number;
  public readonly headers: IncomingHttpHeaders;
  public readonly data: unknown;
  constructor(httpStatus: number, data: unknown, headers?: IncomingHttpHeaders);
}

export declare class HttpError extends Error {
  public readonly status: number;
  public readonly headers: IncomingHttpHeaders;
  public readonly message: string;
  constructor(httpStatus: number, message: string, headers?: IncomingHttpHeaders);
}

interface ControllerInterface {
  response(data: unknown, code?: StatusCode, status?: number, headers?: Record<string, string>): void;
  result(data: unknown, status?: number, headers?: Record<string, string>): void;
  success(data?: unknown, headers?: Record<string, string>): void;
  failed(data?: unknown, code?: StatusCode, status?: number, headers?: Record<string, string>): void;
  error(status: number, msg: string, headers?: Record<string, string>): void;
  log(...data: any): void;
}


export declare class Controller implements ControllerInterface {
  response(data: unknown, code?: StatusCode, status?: number, headers?: Record<string, string>): void;
  result(data: unknown, status?: number, headers?: Record<string, string>): void;
  success(data?: unknown, headers?: Record<string, string>): void;
  failed(data?: unknown, code?: StatusCode, status?: number, headers?: Record<string, string>): void;
  error(status: number, msg: string, headers?: Record<string, string>): void;
  log(...data: any): void;
}

interface RouterInfo {
  pathinfo: string;
  handlers: ContextHandler[];
  middlewares: ContextHandler[];
  params: {
    [key: string]: string;
  };
}


interface KoaContext extends Context {
  app: Application,
  koa: Koa.ParameterizedContext,
  app_id: string,
  method: string,
  url: string,
  // eslint-disable-next-line no-use-before-define
  router?: RouterInfo | null,
  access_key_id?: string,
  app_key?: string,
  params?: any,
  body?: any,
  query?: any,
  headers?: IncomingHttpHeaders,
}

type ContextHandler = (context: KoaContext) => Promise<void>

interface RouterOptions {
  method?: string,
  handlers?: ContextHandler[],
  middlewares?: ContextHandler[],
  intro?: string,
  routers?: Router[],
}

export class Router {
  prefix: string;
  method: string;
  routers: Router[];
  handlers?: ContextHandler[];
  middlewares?: ContextHandler[];
  options?: RouterOptions;

  constructor(prefix?: string, options?: RouterOptions);

  add(router: Router): void;

  new(prefix: string, options?: RouterOptions): void;
}

interface AppConfiguration {
  [key: string]: any;
  debug?: boolean,
  count?: number,
  port?: number,
  app_id?: string,
  paths?: Record<string, string>,
  routers?: Router[],
  operator?: Record<string, ContextHandler>,
  server?: {
    env?: string | undefined,
    keys?: string[] | undefined,
    proxy?: boolean | undefined,
    subdomainOffset?: number | undefined,
    proxyIpHeader?: string | undefined,
    maxIpsCount?: number | undefined,
    static?: KoaStaticServer.Options
  }
}

interface KoaApplicationConfig extends AppConfiguration {
  listen_host: 'localhost',
}

type TriggerFunc = (...args: any[]) => void

export declare abstract class Application {
  routes: any;
  app_id: string;
  constructor(config: AppConfiguration);
  abstract start(): Promise<void>;
  register(event_name: string, ...triggers: TriggerFunc[]): void;
  trigger(event_name: string, ...args: any[]): boolean;
  dispacher(): Promise<void>;
}

export declare class KoaApplication extends Application {
  constructor(config: AppConfiguration);
  start(): Promise<void>;
}