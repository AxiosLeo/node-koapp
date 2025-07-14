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
import type { ServerOptions, WebSocket } from "ws";

// ========================================
// Status Code Types
// ========================================

/**
 * Predefined status codes with format "code;message"
 * Used for standardized API responses
 */
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

// ========================================
// HTTP Method Types
// ========================================

/**
 * HTTP methods supported by the framework
 * Includes both uppercase and lowercase variants
 */
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

// ========================================
// Response Functions
// ========================================

/**
 * Send a response with data, status code, and optional headers
 * @template T Type of response data
 * @param data Response data
 * @param code Status code in format "code;message"
 * @param httpStatus HTTP status code (default: 200)
 * @param headers Optional response headers
 */
export function response<T = unknown>(
  data: T,
  code?: StatusCode,
  httpStatus?: number,
  headers?: Record<string, string>
): void;

/**
 * Send a result response with data and optional headers
 * @template T Type of response data
 * @param data Response data
 * @param httpStatus HTTP status code (default: 200)
 * @param headers Optional response headers
 */
export function result<T = unknown>(
  data: T,
  httpStatus?: number,
  headers?: Record<string, string>
): void;

/**
 * Send a success response with optional data and headers
 * @template T Type of response data
 * @param data Optional response data
 * @param headers Optional response headers
 */
export function success<T = unknown>(
  data?: T,
  headers?: Record<string, string>
): void;

/**
 * Send a failed response with error data and status
 * @template T Type of response data
 * @param data Error data
 * @param code Status code in format "code;message"
 * @param httpStatus HTTP status code (default: 500)
 * @param headers Optional response headers
 */
export function failed<T = unknown>(
  data?: T,
  code?: StatusCode,
  httpStatus?: number,
  headers?: Record<string, string>
): void;

/**
 * Send an error response with HTTP status and message
 * @param httpStatus HTTP status code
 * @param msg Error message
 * @param headers Optional response headers
 */
export function error(
  httpStatus: number,
  msg: string,
  headers?: Record<string, string>
): void;

/**
 * Log data to console (development utility)
 * @param data Data to log
 */
export function log(...data: any): void;

// ========================================
// HTTP Response Classes
// ========================================

/**
 * Configuration for HTTP response
 */
export interface HttpResponseConfig {
  /** HTTP status code */
  status?: number;
  /** Response headers */
  headers?: IncomingHttpHeaders;
  /** Response data */
  data?: unknown;
  /** Response format */
  format?: "json" | "text";
}

/**
 * HTTP response class for structured responses
 * Extends Error to work with error handling middleware
 */
export declare class HttpResponse extends Error {
  public readonly status: number;
  public readonly headers: IncomingHttpHeaders;
  public readonly data: unknown;
  constructor(config?: HttpResponseConfig);
}

/**
 * HTTP error class for error responses
 * Extends Error to work with error handling middleware
 */
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

// ========================================
// Controller Interface and Class
// ========================================

/**
 * Interface defining controller response methods
 */
interface ControllerInterface {
  response<T = unknown>(
    data: T,
    code?: StatusCode,
    status?: number,
    headers?: Record<string, string>
  ): void;
  result<T = unknown>(
    data: T,
    status?: number,
    headers?: Record<string, string>
  ): void;
  success<T = unknown>(data?: T, headers?: Record<string, string>): void;
  failed<T = unknown>(
    data?: T,
    code?: StatusCode,
    status?: number,
    headers?: Record<string, string>
  ): void;
  error(status: number, msg: string, headers?: Record<string, string>): void;
  log(...data: any): void;
}

/**
 * Base controller class providing response methods
 * Implements standard response patterns for API endpoints
 */
export declare class Controller implements ControllerInterface {
  response<T = unknown>(
    data: T,
    code?: StatusCode,
    status?: number,
    headers?: Record<string, string>
  ): void;
  result<T = unknown>(
    data: T,
    status?: number,
    headers?: Record<string, string>
  ): void;
  success<T = unknown>(data?: T, headers?: Record<string, string>): void;
  failed<T = unknown>(
    data?: T,
    code?: StatusCode,
    status?: number,
    headers?: Record<string, string>
  ): void;
  error(status: number, msg: string, headers?: Record<string, string>): void;
  log(...data: any): void;
}

// ========================================
// Validation Types
// ========================================

/**
 * Configuration for request validation
 */
interface ValidatorConfig {
  /** Validation rules */
  rules: Rules;
  /** Custom error messages */
  messages?: ErrorMessages;
}

/**
 * Validators for different parts of the request
 */
interface RouterValidator {
  /** Path parameter validation */
  params?: ValidatorConfig;
  /** Query parameter validation */
  query?: ValidatorConfig;
  /** Request body validation */
  body?: ValidatorConfig;
}

// ========================================
// Router Types
// ========================================

/**
 * Information about a matched route
 * @template TParams Type of route parameters (defaults to Record<string, string>)
 * @template TBody Type of request body (defaults to any)
 * @template TQuery Type of query parameters (defaults to any)
 * @template TContext Context type extending AppContext (defaults to KoaContext)
 *
 * @example
 * ```typescript
 * // RouterInfo with default KoaContext
 * interface UserParams { id: string; action: 'view' | 'edit'; }
 * interface UserBody { name: string; email: string; }
 * interface UserQuery { include?: 'profile'; }
 *
 * type UserRouterInfo = RouterInfo<UserParams, UserBody, UserQuery>;
 *
 * // Can be used with any context type that extends AppContext
 * const routerInfo: UserRouterInfo = {
 *   pathinfo: '/user/{:id}/{:action}',
 *   validators: {},
 *   middlewares: [], // ContextHandler<KoaContext<UserParams, UserBody, UserQuery>>[]
 *   handlers: [],    // ContextHandler<KoaContext<UserParams, UserBody, UserQuery>>[]
 *   afters: [],      // ContextHandler<KoaContext<UserParams, UserBody, UserQuery>>[]
 *   methods: ['POST', 'PUT'],
 *   params: { id: '123', action: 'edit' }
 * };
 * ```
 */
interface RouterInfo<
  TParams = Record<string, string>,
  TBody = any,
  TQuery = any,
  TContext extends AppContext<TParams, TBody, TQuery> = KoaContext<
    TParams,
    TBody,
    TQuery
  >
> {
  /** Route path pattern */
  pathinfo: string;
  /** Route validators */
  validators: RouterValidator;
  /** Middleware functions */
  middlewares: ContextHandler<TContext>[];
  /** Handler functions */
  handlers: ContextHandler<TContext>[];
  /** After middleware functions */
  afters: ContextHandler<TContext>[];
  /** Supported HTTP methods */
  methods: string[];
  /** Extracted path parameters */
  params: TParams;
}

// ========================================
// Context Types
// ========================================

// ========================================
// Server-Sent Events Types
// ========================================

/**
 * Server-sent event data structure
 */
interface IKoaSSEvent {
  /** Event ID */
  id?: number;
  /** Event data */
  data?: string | object;
  /** Event type */
  event?: string;
}

/**
 * Server-sent events interface extending Transform stream
 */
interface IKoaSSE extends Transform {
  /** Send SSE event */
  send(data: IKoaSSEvent | string): void;
  /** Send keep-alive ping */
  keepAlive(): void;
  /** Close SSE connection */
  close(): void;
}

/**
 * Base application context interface
 * @template TParams Type of route parameters (defaults to Record<string, string>)
 * @template TBody Type of request body (defaults to any)
 * @template TQuery Type of query parameters (defaults to any)
 *
 * @example
 * ```typescript
 * // Basic usage with default types
 * interface MyContext extends AppContext {}
 *
 * // Usage with specific types
 * interface UserParams { id: string; action: 'view' | 'edit'; }
 * interface UserBody { name: string; email: string; }
 * interface UserQuery { include?: 'profile' | 'settings'; }
 *
 * interface UserContext extends AppContext<UserParams, UserBody, UserQuery> {}
 *
 * // In route handler
 * const handler = async (context: UserContext) => {
 *   // context.router is now fully typed
 *   const routerParams = context.router.params; // UserParams
 *   const handlers = context.router.handlers;   // ContextHandler<KoaContext<UserParams, UserBody, UserQuery>>[]
 * };
 * ```
 */
interface AppContext<
  TParams = Record<string, string>,
  TBody = any,
  TQuery = any
> extends Context {
  app:
    | KoaApplication
    | SocketApplication
    | WebSocketApplication
    | Application
    | null;
  app_id: string;
  method: string;
  pathinfo: string;
  request_id?: string;
  router?: RouterInfo<TParams, TBody, TQuery, any> | null;
}

/**
 * Koa-specific context extending AppContext
 * @template TParams Type of route parameters (defaults to Record<string, string>)
 * @template TBody Type of request body (defaults to any)
 * @template TQuery Type of query parameters (defaults to any)
 *
 * @example
 * ```typescript
 * // Define specific parameter and body types
 * interface ProductParams {
 *   id: string;
 *   category: string;
 * }
 *
 * interface CreateProductBody {
 *   name: string;
 *   price: number;
 *   description?: string;
 *   tags?: string[];
 * }
 *
 * interface ProductQuery {
 *   sort?: 'asc' | 'desc';
 *   limit?: number;
 *   include?: 'details' | 'reviews' | 'images';
 * }
 *
 * // Create fully typed context
 * type ProductContext = KoaContext<ProductParams, CreateProductBody, ProductQuery>;
 *
 * // Use in route handler with full type safety
 * router.post('/product/{:id}/category/{:category}', async (context: ProductContext) => {
 *   // Full type safety for params
 *   const productId = context.params.id;         // string
 *   const category = context.params.category;    // string
 *
 *   // Type-safe body access - TypeScript will enforce required fields
 *   const productName = context.body.name;       // string
 *   const price = context.body.price;            // number
 *   const desc = context.body.description;       // string | undefined
 *   const tags = context.body.tags;              // string[] | undefined
 *
 *   // Type-safe query access
 *   const sortOrder = context.query.sort;        // 'asc' | 'desc' | undefined
 *   const limit = context.query.limit;           // number | undefined
 *   const include = context.query.include;       // 'details' | 'reviews' | 'images' | undefined
 *
 *   // TypeScript will catch type errors at compile time
 *   // const invalid = context.body.invalidField; // ❌ TypeScript error
 *   // const wrongType = context.query.sort === 'invalid'; // ❌ TypeScript error
 * });
 *
 * // Partial typing - only specify what you need
 * type SimpleContext = KoaContext<{}, CreateProductBody>; // Only body typed
 * type ParamsOnlyContext = KoaContext<ProductParams>;     // Only params typed
 * type QueryOnlyContext = KoaContext<{}, any, ProductQuery>; // Only query typed
 *
 * // Real-world example: User management API
 * interface UserParams { id: string; }
 * interface UpdateUserBody {
 *   name?: string;
 *   email?: string;
 *   role?: 'admin' | 'user';
 * }
 * interface UserQuery {
 *   expand?: 'profile' | 'permissions';
 *   format?: 'json' | 'xml';
 * }
 *
 * const userRouter = new Router<KoaContext<UserParams, UpdateUserBody, UserQuery>>();
 *
 * userRouter.put('/user/{:id}', async (context) => {
 *   // All properties are fully typed with IntelliSense support
 *   const userId = context.params.id;
 *   const updates = context.body; // UpdateUserBody
 *   const options = context.query; // UserQuery
 *
 *   // Type-safe validation
 *   if (updates.role && !['admin', 'user'].includes(updates.role)) {
 *     // This would be caught at compile time due to literal types
 *   }
 * });
 * ```
 */
interface KoaContext<
  TParams = Record<string, string>,
  TBody = any,
  TQuery = any
> extends AppContext<TParams, TBody, TQuery> {
  /** Route parameters */
  params?: TParams;
  /** Application configuration */
  config?: AppConfiguration;
  /** Koa context with optional SSE support */
  koa: Koa.ParameterizedContext & { sse?: IKoaSSE };
  /** Request URL */
  url: string;
  /** Request body */
  body?: TBody;
  /** Uploaded file */
  file?: File | null;
  /** Uploaded files array */
  files?: File[];
  /** Query parameters */
  query?: TQuery;
  /** Request headers */
  headers?: IncomingHttpHeaders;
  /** Response object */
  response?: HttpResponse | HttpError;
}

/**
 * Socket context extending AppContext
 * @template TParams Type of route parameters (defaults to Record<string, string>)
 * @template TBody Type of request body (defaults to any)
 * @template TQuery Type of query parameters (defaults to any)
 *
 * @example
 * ```typescript
 * // Define socket-specific types
 * interface SocketParams { room: string; userId: string; }
 * interface SocketBody { message: string; type: 'text' | 'image'; }
 * interface SocketQuery { token?: string; }
 *
 * type ChatContext = SocketContext<SocketParams, SocketBody, SocketQuery>;
 *
 * // Use in socket handler
 * const socketHandler = async (context: ChatContext) => {
 *   // All properties are fully typed
 *   const room = context.params.room;           // string
 *   const userId = context.params.userId;       // string
 *   const message = context.body.message;       // string
 *   const msgType = context.body.type;          // 'text' | 'image'
 *   const token = context.query.token;          // string | undefined
 *
 *   // Router info is also typed
 *   const routerParams = context.router?.params; // SocketParams
 * };
 * ```
 */
export interface SocketContext<
  TParams = Record<string, string>,
  TBody = any,
  TQuery = any
> extends AppContext<TParams, TBody, TQuery> {
  /** Route parameters */
  params?: TParams;
  /** Application configuration */
  config?: AppConfiguration;
  /** Socket connection */
  socket: Socket;
  /** Request body */
  body?: TBody;
  /** Query parameters */
  query?: TQuery;
  /** Request headers */
  headers?: IncomingHttpHeaders;
  /** Response object */
  response?: HttpResponse | HttpError;
}

/**
 * Interface for defining context data specification
 * This allows flexible type configuration without order dependency
 */
interface ContextDataSpec<
  TParams extends Record<string, string> = Record<string, string>,
  TBody = any,
  TQuery extends Record<string, string> = Record<string, string>
> {
  params?: TParams;
  body?: TBody;
  query?: TQuery;
}

/**
 * Context type with all data properties required (params, body, query)
 * @template TParams Type of route parameters
 * @template TBody Type of request body
 * @template TQuery Type of query parameters
 *
 * @example
 * ```typescript
 * // All properties are required
 * type StrictContext = RequiredContext<
 *   { id: string },           // params
 *   { name: string },         // body
 *   { format: 'json' | 'xml' } // query
 * >;
 *
 * // Usage in route handler
 * router.post<StrictContext>('/users/{:id}', async (context) => {
 *   const id = context.params.id;     // ✅ always available
 *   const name = context.body.name;   // ✅ always available
 *   const format = context.query.format; // ✅ always available
 * });
 * ```
 */
export type RequiredContext<
  TParams extends Record<string, string> = Record<string, string>,
  TBody = any,
  TQuery extends Record<string, string> = Record<string, string>
> = AppContext<TParams, TBody, TQuery> & {
  params: TParams;
  body: TBody;
  query: TQuery;
};

/**
 * Object-style context type definition for flexible configuration
 * @template T ContextDataSpec object with optional params, body, and query types
 *
 * @example
 * ```typescript
 * // Object-style usage - no order dependency, only specify what you need
 * type UserContext = ContextFromSpec<{
 *   body: { name: string; email: string };
 *   params: { id: string };
 *   query: { format?: 'json' | 'xml' };
 * }>;
 *
 * type ProductContext = ContextFromSpec<{
 *   query: { sort: 'asc' | 'desc' };
 *   body: { data: any };
 * }>; // No params needed
 *
 * type SimpleContext = ContextFromSpec<{
 *   params: { userId: string };
 * }>; // Only params needed
 *
 * // Usage
 * router.put<UserContext>('/user/{:id}', async (context) => {
 *   const id = context.params.id;         // ✅ always available
 *   const name = context.body.name;       // ✅ always available
 *   const format = context.query.format;  // ✅ always available
 * });
 * ```
 */
export type ContextFromSpec<T extends ContextDataSpec = ContextDataSpec> =
  AppContext<
    T["params"] extends Record<string, string>
      ? T["params"]
      : Record<string, string>,
    T["body"] extends undefined ? any : T["body"],
    T["query"] extends Record<string, string>
      ? T["query"]
      : Record<string, string>
  > & {
    params: T["params"] extends Record<string, string>
      ? T["params"]
      : Record<string, string>;
    body: T["body"] extends undefined ? any : T["body"];
    query: T["query"] extends Record<string, string>
      ? T["query"]
      : Record<string, string>;
  };

/**
 * Context handler function type
 * @template T Context type extending AppContext
 *
 * @example
 * ```typescript
 * // Default usage (KoaContext)
 * const handler: ContextHandler = async (context) => {
 *   // context is KoaContext by default
 *   const url = context.url;  // Available
 *   const koa = context.koa;  // Available
 * };
 *
 * // Explicit KoaContext usage
 * const koaHandler: ContextHandler<KoaContext> = async (context) => {
 *   const url = context.url;  // Available
 *   const koa = context.koa;  // Available
 * };
 *
 * // SocketContext usage
 * const socketHandler: ContextHandler<SocketContext> = async (context) => {
 *   const socket = context.socket;  // Available
 * };
 *
 * // Base AppContext usage
 * const baseHandler: ContextHandler<AppContext> = async (context) => {
 *   const appId = context.app_id;  // Available
 * };
 * ```
 */
type ContextHandler<T extends AppContext<any, any, any> = KoaContext> = (
  context: T
) => Promise<void>;

// ========================================
// Router Class
// ========================================

/**
 * Router options for configuration
 * @template T Context type extending AppContext
 *
 * @example
 * ```typescript
 * // RouterOptions now uses KoaContext by default
 * interface UserParams { id: string; }
 * interface UserBody { name: string; }
 * interface UserQuery { format?: 'json' | 'xml'; }
 *
 * type UserContext = KoaContext<UserParams, UserBody, UserQuery>;
 *
 * const routerOptions: RouterOptions<UserContext> = {
 *   method: 'POST',
 *   middlewares: [
 *     async (context) => {
 *       // context is typed as UserContext
 *       console.log(`Processing user ${context.params?.id}`);
 *       console.log(`URL: ${context.url}`); // Available with KoaContext
 *     }
 *   ],
 *   handlers: [
 *     async (context) => {
 *       // Full type safety
 *       const userId = context.params?.id;      // string | undefined
 *       const userName = context.body?.name;    // string | undefined
 *       const format = context.query?.format;   // 'json' | 'xml' | undefined
 *       const koaCtx = context.koa;             // Available with KoaContext
 *     }
 *   ]
 * };
 * ```
 */
interface RouterOptions<T extends AppContext<any, any, any> = KoaContext> {
  /** Default HTTP method */
  method?: HttpMethod;
  /** Route handlers */
  handlers?: ContextHandler<T>[];
  /** Middleware functions */
  middlewares?: ContextHandler<T>[];
  /** After middleware functions */
  afters?: ContextHandler<T>[];
  /** Route description */
  intro?: string;
  /** Sub-routers - can have different context types */
  routers?: Router<AppContext<any, any, any>>[];
  /** Route validators */
  validators?: RouterValidator;
}

/**
 * Router class for defining API routes and middleware
 * @template T Context type extending AppContext (can be KoaContext, SocketContext, etc.)
 *
 * @example
 * ```typescript
 * // Basic router usage (uses KoaContext by default)
 * const mainRouter = new Router();
 *
 * // Define different context types for different sub-routers
 * interface UserParams { id: string; action: 'view' | 'edit' | 'delete'; }
 * interface UserBody { name?: string; email?: string; age?: number; }
 * interface UserQuery { include?: 'profile' | 'settings'; format?: 'json' | 'xml'; }
 * type UserContext = KoaContext<UserParams, UserBody, UserQuery>;
 *
 * interface ProductParams { productId: string; }
 * interface ProductBody { name: string; price: number; }
 * interface ProductQuery { category?: string; }
 * type ProductContext = KoaContext<ProductParams, ProductBody, ProductQuery>;
 *
 * // Create sub-routers with different context types
 * const userRouter = new Router<UserContext>();
 * const productRouter = new Router<ProductContext>();
 *
 * userRouter.post('/user/{:id}/{:action}', async (context) => {
 *   // context is typed as UserContext
 *   const userId = context.params?.id;       // string | undefined
 *   const action = context.params?.action;   // 'view' | 'edit' | 'delete' | undefined
 *   const userName = context.body?.name;     // string | undefined
 *   const format = context.query?.format;   // 'json' | 'xml' | undefined
 * });
 *
 * productRouter.get('/product/{:productId}', async (context) => {
 *   // context is typed as ProductContext
 *   const productId = context.params?.productId; // string | undefined
 *   const category = context.query?.category;    // string | undefined
 * });
 *
 * // Add sub-routers with different context types to main router
 * mainRouter.add('/api/v1', userRouter);    // UserContext
 * mainRouter.add('/api/v1', productRouter); // ProductContext
 *
 * // Or create sub-routers with different context types directly
 * const adminRouter = mainRouter.new<AdminContext>('/admin', {
 *   middlewares: [authMiddleware]
 * });
 *
 * // You can also add routes with different context types to the same router
 * mainRouter.get<UserContext>('/profile/{:id}', async (context) => {
 *   const userId = context.params.id; // Typed as UserContext
 * });
 *
 * mainRouter.post<ProductContext>('/products/{:productId}', async (context) => {
 *   const productId = context.params.productId; // Typed as ProductContext
 * });
 *
 * // This flexibility allows different sub-routers to have their own context types
 * // while being managed by the same parent router
 * ```
 */
export class Router<T extends AppContext<any, any, any> = KoaContext> {
  /** Route prefix */
  prefix: string;
  /** Default HTTP method */
  method: HttpMethod;
  /** Sub-routers - can have different context types as long as they extend AppContext */
  routers: Router<AppContext<any, any, any>>[];
  /** Route handlers */
  handlers: ContextHandler<T>[];
  /** Middleware functions */
  middlewares: ContextHandler<T>[];
  /** Route validators */
  validators: RouterValidator;
  /** After middleware functions */
  afters?: ContextHandler<T>[];

  constructor(prefix?: string, options?: RouterOptions<T>);

  /**
   * Add sub-routers to this router
   * @template U Context type of the sub-router (can be different from parent)
   */
  add<U extends AppContext<any, any, any>>(...router: Router<U>[]): this;
  add<U extends AppContext<any, any, any>>(
    prefix: string,
    ...router: Router<U>[]
  ): this;

  /**
   * Create a new sub-router with a different context type
   * @template U Context type of the new sub-router (can be different from parent)
   */
  new<U extends AppContext<any, any, any>>(
    prefix: string,
    options?: RouterOptions<U>
  ): Router<U>;

  /**
   * Add a route with specific HTTP method
   * @template U Context type for the route handler (can be different from router's context type)
   */
  push<U extends AppContext<any, any, any> = T>(
    method: HttpMethod,
    prefix: string,
    handle: ContextHandler<U>,
    validator?: RouterValidator
  ): this;

  /**
   * Add a GET route
   * @template U Context type for the route handler (can be different from router's context type)
   */
  get<U extends AppContext<any, any, any> = T>(
    prefix: string,
    handle: ContextHandler<U>,
    validator?: RouterValidator
  ): this;

  /**
   * Add a POST route
   * @template U Context type for the route handler (can be different from router's context type)
   */
  post<U extends AppContext<any, any, any> = T>(
    prefix: string,
    handle: ContextHandler<U>,
    validator?: RouterValidator
  ): this;

  /**
   * Add a PUT route
   * @template U Context type for the route handler (can be different from router's context type)
   */
  put<U extends AppContext<any, any, any> = T>(
    prefix: string,
    handle: ContextHandler<U>,
    validator?: RouterValidator
  ): this;

  /**
   * Add a PATCH route
   * @template U Context type for the route handler (can be different from router's context type)
   */
  patch<U extends AppContext<any, any, any> = T>(
    prefix: string,
    handle: ContextHandler<U>,
    validator?: RouterValidator
  ): this;

  /**
   * Add a DELETE route
   * @template U Context type for the route handler (can be different from router's context type)
   */
  delete<U extends AppContext<any, any, any> = T>(
    prefix: string,
    handle: ContextHandler<U>,
    validator?: RouterValidator
  ): this;

  /**
   * Add a route that accepts any HTTP method
   * @template U Context type for the route handler (can be different from router's context type)
   */
  any<U extends AppContext<any, any, any> = T>(
    prefix: string,
    handle: ContextHandler<U>,
    validator?: RouterValidator
  ): this;
}

// ========================================
// SSE Middleware Types
// ========================================

/**
 * Options for Server-Sent Events middleware
 */
type SSEOptions = {
  /** Ping interval in milliseconds (default: 60000) */
  pingInterval?: number;
  /** Event name for close event (default: 'close') */
  closeEvent?: string;
};

/**
 * SSE context handler function type
 */
type SSEContextHandler = (
  context: Koa.ParameterizedContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Middleware namespace containing utility middleware functions
 */
export namespace middlewares {
  /**
   * Create Server-Sent Events middleware
   * @param options SSE configuration options
   * @returns SSE middleware function
   */
  function KoaSSEMiddleware(options?: SSEOptions): SSEContextHandler;
}

// ========================================
// Application Configuration Types
// ========================================

/**
 * Base application configuration interface
 *
 * @example
 * ```typescript
 * // Basic usage - supports mixed router types
 * const config: AppConfiguration = {
 *   debug: true,
 *   app_id: 'my-app',
 *   routers: [
 *     userRouter,    // Router<KoaContext<UserParams, UserBody, UserQuery>>
 *     productRouter, // Router<KoaContext<ProductParams, ProductBody, ProductQuery>>
 *     apiRouter      // Router<KoaContext<ApiParams, ApiBody, ApiQuery>>
 *   ]
 * };
 *
 * // Type-safe usage with helper type
 * const typedConfig: TypedAppConfiguration<
 *   Router<KoaContext<UserParams, UserBody, UserQuery>>[]
 * > = {
 *   debug: true,
 *   routers: [userRouter] // All routers must be of the same type
 * };
 * ```
 */
interface AppConfiguration {
  [key: string]: any;
  /** Enable debug mode */
  debug?: boolean;
  /** Application identifier */
  app_id?: string;
  /** Application routers - supports mixed router types for flexibility */
  routers?: Router<any>[];
}

/**
 * Typed application configuration for strict type checking when needed
 * @template TRouters Array type of routers for strict typing
 *
 * @example
 * ```typescript
 * interface UserParams { id: string; }
 * interface UserBody { name: string; }
 * interface UserQuery { format?: 'json' | 'xml'; }
 *
 * type UserRouter = Router<KoaContext<UserParams, UserBody, UserQuery>>;
 *
 * // Strict typing when all routers are of the same type
 * const config: TypedAppConfiguration<UserRouter[]> = {
 *   debug: true,
 *   routers: [
 *     userRouter1, // Must be UserRouter
 *     userRouter2  // Must be UserRouter
 *   ]
 * };
 *
 * // Or for multiple specific types
 * const mixedConfig: TypedAppConfiguration<(UserRouter | ProductRouter)[]> = {
 *   routers: [userRouter, productRouter]
 * };
 * ```
 */
interface TypedAppConfiguration<TRouters extends Router<any>[] = Router<any>[]>
  extends Omit<AppConfiguration, "routers"> {
  /** Strictly typed application routers */
  routers?: TRouters;
}

/**
 * Koa application specific configuration
 *
 * @example
 * ```typescript
 * // Basic usage with mixed router types
 * const config: KoaApplicationConfig = {
 *   listen_host: 'localhost',
 *   port: 3000,
 *   debug: true,
 *   routers: [
 *     userRouter,    // Different context types
 *     productRouter, // are supported
 *     apiRouter
 *   ]
 * };
 *
 * // Type-safe usage for specific router types
 * interface UserParams { id: string; }
 * interface UserBody { name: string; }
 * type UserRouter = Router<KoaContext<UserParams, UserBody>>;
 *
 * const typedConfig: TypedKoaApplicationConfig<UserRouter[]> = {
 *   listen_host: 'localhost',
 *   port: 3000,
 *   routers: [userRouter1, userRouter2] // All must be UserRouter
 * };
 * ```
 */
export type KoaApplicationConfig = AppConfiguration & {
  /** Host to listen on */
  listen_host: string;
  /** Number of server instances */
  count?: number;
  /** Port to listen on */
  port?: number;
  /** Path mappings */
  paths?: Record<string, string>;
  /** Koa server configuration */
  server?: {
    /** Environment mode */
    env?: string | undefined;
    /** Signing keys for cookies */
    keys?: string[] | undefined;
    /** Trust proxy headers */
    proxy?: boolean | undefined;
    /** Subdomain offset */
    subdomainOffset?: number | undefined;
    /** Proxy IP header */
    proxyIpHeader?: string | undefined;
    /** Maximum IPs count */
    maxIpsCount?: number | undefined;
  };
  /** Session key name */
  session_key?: string;
  /** Session configuration */
  session?: Partial<session.opts>;
  /** Static file serving options */
  static?: KoaStaticServer.Options;
};

/**
 * Typed Koa application configuration for strict type checking
 * @template TRouters Array type of routers for strict typing
 */
export type TypedKoaApplicationConfig<
  TRouters extends Router<any>[] = Router<any>[]
> = TypedAppConfiguration<TRouters> &
  Omit<KoaApplicationConfig, keyof AppConfiguration>;

/**
 * Socket application configuration
 *
 * @example
 * ```typescript
 * // Basic usage with mixed router types
 * const config: SocketAppConfiguration = {
 *   port: 8080,
 *   debug: true,
 *   routers: [
 *     chatRouter,    // Different context types
 *     gameRouter,    // are supported
 *     notifyRouter
 *   ],
 *   ping: { open: true, interval: 30000 }
 * };
 *
 * // Type-safe usage for specific router types
 * interface ChatParams { room: string; userId: string; }
 * interface ChatBody { message: string; type: 'text' | 'image'; }
 * type ChatRouter = Router<SocketContext<ChatParams, ChatBody>>;
 *
 * const typedConfig: TypedSocketAppConfiguration<ChatRouter[]> = {
 *   port: 8080,
 *   routers: [chatRouter1, chatRouter2] // All must be ChatRouter
 * };
 * ```
 */
export type SocketAppConfiguration = AppConfiguration & {
  /** Port to listen on */
  port: number;
  /** Ping configuration */
  ping?: {
    /** Enable ping */
    open?: boolean;
    /** Ping interval in milliseconds */
    interval?: number;
    /** Ping data */
    data?: any;
  };
};

/**
 * Typed Socket application configuration for strict type checking
 * @template TRouters Array type of routers for strict typing
 */
export type TypedSocketAppConfiguration<
  TRouters extends Router<any>[] = Router<any>[]
> = TypedAppConfiguration<TRouters> &
  Omit<SocketAppConfiguration, keyof AppConfiguration>;

/**
 * WebSocket application configuration
 *
 * @example
 * ```typescript
 * // Basic usage with mixed router types
 * const config: WebSocketAppConfiguration = {
 *   port: 8080,
 *   debug: true,
 *   routers: [
 *     wsRouter1,     // Different context types
 *     wsRouter2,     // are supported
 *     wsRouter3
 *   ],
 *   // WebSocket server options
 *   clientTracking: true,
 *   maxPayload: 1024 * 1024
 * };
 *
 * // Type-safe usage for specific router types
 * interface WSParams { channel: string; userId: string; }
 * interface WSBody { event: string; data: any; }
 * type WSRouter = Router<SocketContext<WSParams, WSBody>>;
 *
 * const typedConfig: TypedWebSocketAppConfiguration<WSRouter[]> = {
 *   port: 8080,
 *   routers: [wsRouter1, wsRouter2] // All must be WSRouter
 * };
 * ```
 */
export type WebSocketAppConfiguration = ServerOptions & SocketAppConfiguration;

/**
 * Typed WebSocket application configuration for strict type checking
 * @template TRouters Array type of routers for strict typing
 */
export type TypedWebSocketAppConfiguration<
  TRouters extends Router<any>[] = Router<any>[]
> = ServerOptions & TypedSocketAppConfiguration<TRouters>;

// ========================================
// Application Classes
// ========================================

/**
 * Trigger function type for events
 */
type TriggerFunc = (...args: any[]) => void;

/**
 * Base application class extending EventEmitter
 */
export declare abstract class Application extends EventEmitter {
  /** Application routes */
  routes: any;
  /** Application identifier */
  app_id: string;
  /** Application configuration */
  config: Configuration;

  constructor(config: AppConfiguration);

  /**
   * Start the application
   * @returns Promise that resolves when application is started
   */
  abstract start(): Promise<void>;
}

/**
 * Koa-based HTTP application
 */
export declare class KoaApplication extends Application {
  /** Koa instance */
  koa: Koa;
  /** Workflow instance for request processing */
  workflow: Workflow<KoaContext>;

  constructor(config: KoaApplicationConfig);

  /**
   * Start the Koa application server
   * @returns Promise that resolves when server is started
   */
  start(): Promise<void>;
}

/**
 * Socket client wrapper
 */
export declare class SocketClient {
  /** Socket connection options */
  options: {
    /** Port number */
    port: number;
    /** Host address */
    host: string;
    /** Client name */
    name?: string;
  };
  /** Event emitter for socket events */
  event: EventEmitter;
  /** Socket client instance */
  client: Socket;

  constructor(socket: Socket, app_id: string);

  /**
   * Send data to socket client
   * @param data Data to send
   */
  send(data: any): void;

  /**
   * Close socket connection
   */
  close(): void;
}

/**
 * Socket-based application
 */
export declare class SocketApplication extends Application {
  constructor(config: SocketAppConfiguration);

  /**
   * Start the socket application server
   * @returns Promise that resolves when server is started
   */
  start(): Promise<void>;

  /**
   * Broadcast data to all connected clients
   * @param data Data to broadcast
   * @param msg Message
   * @param code Status code
   * @param connections Specific connections to broadcast to
   */
  broadcast(
    data?: any,
    msg?: string,
    code?: number,
    connections?: Socket[]
  ): void;
}

/**
 * WebSocket-based application
 */
export declare class WebSocketApplication extends Application {
  constructor(config: WebSocketAppConfiguration);

  /**
   * Start the WebSocket application server
   * @returns Promise that resolves when server is started
   */
  start(): Promise<void>;

  /**
   * Broadcast data to all connected WebSocket clients
   * @param data Data to broadcast
   * @param msg Message
   * @param code Status code
   * @param connections Specific connections to broadcast to
   */
  broadcast(
    data?: any,
    msg?: string,
    code?: number,
    connections?: WebSocket[]
  ): void;
}

// ========================================
// Model Class
// ========================================

/**
 * Base model class for data validation and manipulation
 */
export declare class Model {
  constructor(obj?: { [key: string]: any }, rules?: Rules, msg?: ErrorMessages);

  /**
   * Create a new model instance
   * @param obj Initial data object
   * @param rules Validation rules
   * @param msg Custom error messages
   * @returns New model instance
   */
  static create<T extends Model>(
    obj?: { [key: string]: any },
    rules?: Rules,
    msg?: ErrorMessages
  ): T;

  /**
   * Convert model to JSON string
   * @returns JSON string representation
   */
  toJson(): string;

  /**
   * Get all property names
   * @returns Array of property names
   */
  properties(): Array<string>;

  /**
   * Get property count
   * @returns Number of properties
   */
  count(): number;

  /**
   * Validate model data
   * @param rules Validation rules
   * @param msg Custom error messages
   * @returns Validator instance
   */
  validate(rules: Rules, msg?: ErrorMessages): Validator<this>;
}

// ========================================
// Utility Functions
// ========================================

/**
 * Initialize application context
 * @template T Application type
 * @template TParams Type of route parameters
 * @template TBody Type of request body
 * @template TQuery Type of query parameters
 * @template F Context type extending AppContext
 * @param options Context initialization options
 * @returns Initialized context
 */
export function initContext<
  T extends Application,
  TParams = Record<string, string>,
  TBody = any,
  TQuery = any,
  F extends AppContext<TParams, TBody, TQuery> = AppContext<
    TParams,
    TBody,
    TQuery
  >
>(options: {
  /** Application instance */
  app: T;
  /** Application routes */
  routes: Router[];
  /** HTTP method */
  method?: string;
  /** Request path */
  pathinfo?: string;
  /** Application ID */
  app_id?: string;
}): F & { app: T };
