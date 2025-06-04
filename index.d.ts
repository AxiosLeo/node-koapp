import { Configuration, Context, Workflow } from "@axiosleo/cli-tool";
import { File } from "@koa/multer";
import { EventEmitter } from "events";
import { IncomingHttpHeaders } from "http";
import * as Koa from "koa";
import * as session from "koa-session";
import * as KoaStaticServer from "koa-static-server";
import type { Socket } from "net";
import { Transform } from "stream";
import { ErrorMessages, Rules, Validator } from "validatorjs";

type StatusCode =
  | string
  | "000;Unknown Error"
  | "200;Success"
  | "404;Not Found"
  | "500;Internal Server Error"
  | "400;Bad Data"
  | "401;Unauthorized"
  | "403;Not Authorized"
  | "400;Invalid Signature"
  | "501;Failed"
  | "409;Data Already Exists";

type HttpMethod =
  | "ANY"
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS"
  | "TRACE"
  | "CONNECT"
  | "any"
  | "get"
  | "post"
  | "put"
  | "delete"
  | "patch"
  | "head"
  | "options"
  | "trace"
  | "connect"
  | string;

export function response(
  data: unknown,
  code?: StatusCode,
  httpStatus?: number,
  headers?: Record<string, string>
): void;
export function result(
  data: unknown,
  httpStatus?: number,
  headers?: Record<string, string>
): void;
export function success(data?: unknown, headers?: Record<string, string>): void;
export function failed(
  data?: unknown,
  code?: StatusCode,
  httpStatus?: number,
  headers?: Record<string, string>
): void;
export function error(
  httpStatus: number,
  msg: string,
  headers?: Record<string, string>
): void;
export function log(...data: any): void;

export interface HttpResponseConfig {
  status?: number;
  headers?: IncomingHttpHeaders;
  data?: unknown;
  format?: "json" | "text";
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
  constructor(
    httpStatus: number,
    message: string,
    headers?: IncomingHttpHeaders
  );
}

interface ControllerInterface {
  response(
    data: unknown,
    code?: StatusCode,
    status?: number,
    headers?: Record<string, string>
  ): void;
  result(
    data: unknown,
    status?: number,
    headers?: Record<string, string>
  ): void;
  success(data?: unknown, headers?: Record<string, string>): void;
  failed(
    data?: unknown,
    code?: StatusCode,
    status?: number,
    headers?: Record<string, string>
  ): void;
  error(status: number, msg: string, headers?: Record<string, string>): void;
  log(...data: any): void;
}

export declare class Controller implements ControllerInterface {
  response(
    data: unknown,
    code?: StatusCode,
    status?: number,
    headers?: Record<string, string>
  ): void;
  result(
    data: unknown,
    status?: number,
    headers?: Record<string, string>
  ): void;
  success(data?: unknown, headers?: Record<string, string>): void;
  failed(
    data?: unknown,
    code?: StatusCode,
    status?: number,
    headers?: Record<string, string>
  ): void;
  error(status: number, msg: string, headers?: Record<string, string>): void;
  log(...data: any): void;
}

interface ValidatorConfig {
  rules: Rules;
  messages?: ErrorMessages;
}

interface RouterValidator {
  params?: ValidatorConfig;
  query?: ValidatorConfig;
  body?: ValidatorConfig;
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
  app: Application;
  app_id: string;
  method?: string;
  pathinfo?: string;
  params?: any;
  config: AppConfiguration;
  request_id: string;
  router?: RouterInfo;
  response?: HttpResponse | HttpError;
}

interface IKoaSSEvent {
  id?: number;
  data?: string | object;
  event?: string;
}

interface IKoaSSE extends Transform {
  send(data: IKoaSSEvent | string): void;
  keepAlive(): void;
  close(): void;
}

interface KoaContext extends AppContext {
  koa: Koa.ParameterizedContext & { sse?: IKoaSSE };
  method: HttpMethod;
  url: string;
  // eslint-disable-next-line no-use-before-define
  router?: RouterInfo | null;
  access_key_id?: string;
  app_key?: string;
  body?: any;
  file?: File | null;
  files?: File[];
  query?: any;
  headers?: IncomingHttpHeaders;
  response?: HttpResponse | HttpError;
}

type ContextHandler<T extends KoaContext> = (context: T) => Promise<void>;

interface RouterOptions<T extends KoaContext> {
  method?: HttpMethod;
  handlers?: ContextHandler<T>[];
  middlewares?: ContextHandler<T>[];
  afters?: ContextHandler<T>[];
  intro?: string;
  routers?: Router[];
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

  push(
    method: HttpMethod,
    prefix: string,
    handle: ContextHandler<T>,
    validator?: RouterValidator
  ): this;

  get(
    prefix: string,
    handle: ContextHandler<T>,
    validator?: RouterValidator
  ): this;

  post(
    prefix: string,
    handle: ContextHandler<T>,
    validator?: RouterValidator
  ): this;

  put(
    prefix: string,
    handle: ContextHandler<T>,
    validator?: RouterValidator
  ): this;

  patch(
    prefix: string,
    handle: ContextHandler<T>,
    validator?: RouterValidator
  ): this;

  delete(
    prefix: string,
    handle: ContextHandler<T>,
    validator?: RouterValidator
  ): this;

  any(
    prefix: string,
    handle: ContextHandler<T>,
    validator?: RouterValidator
  ): this;
}

type SSEOptions = {
  pingInterval?: number; // default is 60000
  closeEvent?: string; // default is 'close'
};

interface AppConfiguration {
  [key: string]: any;
  debug?: boolean;
  app_id?: string;
  routers?: Router[];
}

type SSEContextHandler = (
  context: Koa.ParameterizedContext,
  next: () => Promise<void>
) => Promise<void>;

export namespace middlewares {
  function KoaSSEMiddleware(options?: SSEOptions): SSEContextHandler;
}

export type KoaApplicationConfig = AppConfiguration & {
  listen_host: string;
  count?: number;
  port?: number;
  paths?: Record<string, string>;
  server?: {
    env?: string | undefined;
    keys?: string[] | undefined;
    proxy?: boolean | undefined;
    subdomainOffset?: number | undefined;
    proxyIpHeader?: string | undefined;
    maxIpsCount?: number | undefined;
  };
  session_key?: string;
  session?: Partial<session.opts>;
  static?: KoaStaticServer.Options;
};

type TriggerFunc = (...args: any[]) => void;

export declare abstract class Application extends EventEmitter {
  routes: any;
  app_id: string;
  config: Configuration;
  constructor(config: AppConfiguration);
  abstract start(): Promise<void>;
}

export declare class KoaApplication extends Application {
  koa: Koa;
  workflow: Workflow<KoaContext>;
  constructor(config: KoaApplicationConfig);
  start(): Promise<void>;
}

export interface SocketContext extends AppContext {
  socket: Socket;
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

export function initContext<
  T extends Application,
  F extends AppContext
>(options: {
  app: T;
  routes: Router[];
  method?: string;
  pathinfo?: string;
  app_id?: string;
}): F & { app: T };

export declare class SocketClient {
  options: {
    port: number;
    host: string;
    name?: string;
  };
  event: EventEmitter;
  client: Socket;
  constructor(socket: Socket, app_id: string);
  send(data: any): void;
  close(): void;
}

export type SocketAppConfiguration = AppConfiguration & {
  port: number;
  ping?: {
    open?: boolean;
    interval?: number;
    data?: any;
  };
};

export declare class SocketApplication extends Application {
  constructor(config: SocketAppConfiguration);
  start(): Promise<void>;
}
