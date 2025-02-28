'use strict';

const { Transform, Writable } = require('stream');

/**
 * Koa Server Side Events Middleware
 *
 * @class KoaSSE
 * @extends {Transform}
 */
class KoaSSE extends Transform {

  /**
   * Creates an instance of KoaSSE.
   *
   * @param {import('koa').Context} ctx
   * @param {IKoaSSEOptions} options
   */
  constructor(ctx, options) {
    super({
      writableObjectMode: true
    });

    this.options = options;

    ctx.req.socket.setTimeout(0);
    ctx.req.socket.setNoDelay(true);
    ctx.req.socket.setKeepAlive(true);

    ctx.set('Content-Type', 'text/event-stream');
    ctx.set('Cache-Control', 'no-cache, no-transform');
    ctx.set('Connection', 'keep-alive');

    this.keepAlive();
  }

  /**
   * Send "heartbeat" comment to keep connection alive
   * 
   */
  keepAlive() {
    this.push(':\n\n');
  }

  /**
   * Send server side event
   *
   * @param {(IKoaSSEvent | string)} data
   */
  send(data) {
    try {
      this.write(data);
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Cannot write to already destroyed stream');
    }
  }

  /**
   * Send close event source message and end stream
   *
   */
  close() {
    const data = {
      event: this.options.closeEvent
    };
    this.end(data);
  }

  /**
   * Transform stream base class method
   *
   * @param {*} data
   * @param {string} _
   * @param {TransformCallback} __
   * @returns {void}
   */
  _transform(data, _, cb) {

    // Handle string data 
    if (typeof data === 'string') {
      this.push(`data:${data}\n\n`);
      return cb();
    }

    // Handle object data 
    if (data.id) {
      this.push(`id:${data.id}\n`);
    }
    if (data.event) {
      this.push(`event:${data.event}\n`);
    }
    const text = typeof data.data === 'object'
      ? JSON.stringify(data.data)
      : data.data;
    this.push(`data:${text}\n\n`);
    return cb();
  }
}

const defaultOptions = {
  pingInterval: 60000,
  closeEvent: 'close'
};

const middleware = (options = {}) => {
  options = { ...defaultOptions, ...options };

  const ssePool = [];

  setInterval(() => {
    for (const sse of ssePool) {
      sse.keepAlive();
    }
    // debug.log(`[${new Date().toISOString()}] [${ssePool.length} clients connected]: SSE heartbeat ping...`);
  }, options.pingInterval);

  /**
   * Returned middleware
   *
   * @param {Context} ctx
   * @param {() => Promise<void>} next
   * @returns
   */
  return async (ctx, next) => {
    if (ctx.res.headersSent) {
      if (!ctx.sse) {
        // eslint-disable-next-line no-console
        console.error('[koa-sse]: response headers already sent, unable to create sse stream');
      }
      return await next();
    }

    const sse = new KoaSSE(ctx, options);

    ssePool.push(sse);

    /**
     * Destroy and release stream resources if connection closes or errors
     *
     * @returns {Promise<void>}
     */
    const close = async () => {
      // Remove sse instance from pool
      ssePool.splice(ssePool.indexOf(sse), 1);
      // Release stream resources
      sse.unpipe();
      sse.destroy();
      // End the response
      ctx.res.end();
      ctx.socket.destroy();
    };

    sse.on('close', close);
    sse.on('error', close);

    ctx.sse = ctx.response.sse = sse;

    await next();

    if (!ctx.body) {
      // Set response to sse stream if no body
      ctx.body = ctx.sse;
    } else if (ctx.body instanceof Writable) {
      // Stream body into sse writable stream exists
      ctx.body = ctx.body.pipe(ctx.sse);
    } else {
      // Empty existing body response into sse stream
      ctx.sse.send(ctx.body);
      ctx.body = sse;
    }
  };
};

module.exports = {
  KoaSSE,
  KoaSSEMiddleware: middleware
};
