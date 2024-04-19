import * as KoaStaticServer from 'koa-static-server';
import * as Koa from 'koa';
import { Context, Configuration, Workflow } from '@axiosleo/cli-tool';
import { IncomingHttpHeaders } from 'http';
import { Rules, ErrorMessages, Validator } from 'validatorjs';
import { EventEmitter } from 'events';
import { File } from '@koa/multer';
import * as session from 'koa-session';

type StatusCode = string | '000;Unknown Error' |
  '200;Success' | '404;Not Found' |
  '500;Internal Server Error' |
  '400;Bad Data' | '401;Unauthorized' |
  '403;Not Authorized' | '400;Invalid Signature' |
  '501;Failed' | '409;Data Already Exists';

type HttpMethod = 'ANY' | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'TRACE' | 'CONNECT' |
  'any' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace' | 'connect' | string;

export function response(data: unknown, code?: StatusCode, httpStatus?: number, headers?: Record<string, string>): void;
export function result(data: unknown, httpStatus?: number, headers?: Record<string, string>): void;
export function success(data?: unknown, headers?: Record<string, string>): void;
export function failed(data?: unknown, code?: StatusCode, httpStatus?: number, headers?: Record<string, string>): void;
export function error(httpStatus: number, msg: string, headers?: Record<string, string>): void;
export function log(...data: any): void;

export interface HttpResponseConfig {
  status?: number;
  headers?: IncomingHttpHeaders;
  data?: unknown;
  format?: 'json' | 'text';
}

export declare class HttpResponse extends Error {
  public readonly status: number;
  public readonly headers: IncomingHttpHeaders;
  public readonly data: unknown;
  constructor(config?: HttpResponseConfig);
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

interface ValidatorConfig {
  rules: Rules,
  messages?: ErrorMessages
}

interface RouterValidator {
  params?: ValidatorConfig,
  query?: ValidatorConfig,
  body?: ValidatorConfig
}

interface RouterInfo {
  pathinfo: string;
  validators: RouterValidator;
  middlewares: ContextHandler<KoaContext>[];
  handlers: ContextHandler<KoaContext>[];
  afters: ContextHandler<KoaContext>[];
  methods: string[];
  params: {
    [key: string]: string;
  };
}

interface AppContext extends Context {
  app: Application,
  app_id: string,
  config: AppConfiguration,
}

interface KoaContext extends AppContext {
  koa: Koa.ParameterizedContext,
  method: HttpMethod,
  url: string,
  // eslint-disable-next-line no-use-before-define
  router?: RouterInfo | null,
  access_key_id?: string,
  app_key?: string,
  params?: any,
  body?: any,
  file?: File | null,
  files?: File[],
  query?: any,
  headers?: IncomingHttpHeaders,
  response?: HttpResponse | HttpError,
}

type ContextHandler<T extends KoaContext> = (context: T) => Promise<void>


interface RouterOptions<T extends KoaContext> {
  method?: HttpMethod,
  handlers?: ContextHandler<T>[],
  middlewares?: ContextHandler<T>[],
  afters?: ContextHandler<T>[],
  intro?: string,
  routers?: Router[],
  validators?: RouterValidator;
}

export class Router<T extends KoaContext = KoaContext> {
  prefix: string;
  method: HttpMethod;
  routers: Router[];
  handlers: ContextHandler<T>[];
  middlewares: ContextHandler<T>[];
  validators: RouterValidator;
  afters?: ContextHandler<T>[];

  constructor(prefix?: string, options?: RouterOptions<T>);

  add<T extends KoaContext>(...router: Router<T>[]): this;
  add<T extends KoaContext>(prefix: string, ...router: Router<T>[]): this;

  new(prefix: string, options?: RouterOptions<T>): this;

  push(method: HttpMethod, prefix: string, handle: ContextHandler<T>, validator?: RouterValidator): this;

  get(prefix: string, handle: ContextHandler<T>, validator?: RouterValidator): this;

  post(prefix: string, handle: ContextHandler<T>, validator?: RouterValidator): this;

  put(prefix: string, handle: ContextHandler<T>, validator?: RouterValidator): this;

  patch(prefix: string, handle: ContextHandler<T>, validator?: RouterValidator): this;

  delete(prefix: string, handle: ContextHandler<T>, validator?: RouterValidator): this;

  any(prefix: string, handle: ContextHandler<T>, validator?: RouterValidator): this;
}

interface AppConfiguration {
  [key: string]: any;
  debug?: boolean,
  count?: number,
  port?: number,
  app_id?: string,
  paths?: Record<string, string>,
  routers?: Router[],
  operator?: Record<string, ContextHandler<KoaContext>>,
  server?: {
    env?: string | undefined,
    keys?: string[] | undefined,
    proxy?: boolean | undefined,
    subdomainOffset?: number | undefined,
    proxyIpHeader?: string | undefined,
    maxIpsCount?: number | undefined,
  },
  session_key?: string,
  session?: Partial<session.opts>,
  static?: KoaStaticServer.Options
}

interface KoaApplicationConfig extends AppConfiguration {
  listen_host: 'localhost',
}

type TriggerFunc = (...args: any[]) => void

export declare abstract class Application extends EventEmitter {
  routes: any;
  app_id: string;
  config: Configuration;
  workflow: Workflow<KoaContext>;
  constructor(config: AppConfiguration);
  abstract start(): Promise<void>;
}

export declare class KoaApplication extends Application {
  koa: Koa;
  constructor(config: AppConfiguration);
  start(): Promise<void>;
}

export declare class Model {
  constructor(obj?: { [key: string]: any }, rules?: Rules, msg?: ErrorMessages);

  static create<T extends Model>(
    obj?: { [key: string]: any },
    rules?: Rules,
    msg?: ErrorMessages
  ): T;

  toJson(): string;

  properties(): Array<string>;

  count(): number;

  validate(rules: Rules, msg?: ErrorMessages): Validator<this>;
}
