'use strict';

const { expect } = require('chai');
const { PassThrough } = require('stream');
const { KoaSSE, KoaSSEMiddleware } = require('../src/middlewares/sse');

function createMockKoaCtx() {
  const headers = {};
  const socket = {
    setTimeout: () => {},
    setNoDelay: () => {},
    setKeepAlive: () => {},
    destroy: () => {},
  };
  return {
    req: { socket },
    res: {
      headersSent: false,
      end: () => {},
    },
    set: (key, value) => { headers[key] = value; },
    _headers: headers,
    socket,
    body: null,
    response: {},
    sse: null,
  };
}

describe('KoaSSE', () => {
  describe('constructor', () => {
    it('should create SSE stream with correct headers', () => {
      const ctx = createMockKoaCtx();
      const options = { pingInterval: 1000, closeEvent: 'close' };
      const sse = new KoaSSE(ctx, options);
      expect(sse).to.be.instanceOf(KoaSSE);
      expect(ctx._headers['Content-Type']).to.equal('text/event-stream');
      expect(ctx._headers['Cache-Control']).to.equal('no-cache, no-transform');
      expect(ctx._headers['Connection']).to.equal('keep-alive');
      sse.destroy();
    });
  });

  describe('keepAlive()', () => {
    it('should push heartbeat comment', (done) => {
      const ctx = createMockKoaCtx();
      const sse = new KoaSSE(ctx, { closeEvent: 'close' });
      const chunks = [];
      sse.on('data', (chunk) => {
        chunks.push(chunk.toString());
        if (chunks.length >= 2) {
          expect(chunks[1]).to.equal(':\n\n');
          sse.destroy();
          done();
        }
      });
      sse.keepAlive();
    });
  });

  describe('_transform()', () => {
    it('should handle string data', (done) => {
      const ctx = createMockKoaCtx();
      const sse = new KoaSSE(ctx, { closeEvent: 'close' });
      const chunks = [];
      sse.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      sse.write('hello');
      setTimeout(() => {
        const output = chunks.join('');
        expect(output).to.include('data:hello\n\n');
        sse.destroy();
        done();
      }, 50);
    });

    it('should handle object data with id and event', (done) => {
      const ctx = createMockKoaCtx();
      const sse = new KoaSSE(ctx, { closeEvent: 'close' });
      const chunks = [];
      sse.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      sse.write({ id: '123', event: 'message', data: 'test' });
      setTimeout(() => {
        const output = chunks.join('');
        expect(output).to.include('id:123\n');
        expect(output).to.include('event:message\n');
        expect(output).to.include('data:test\n\n');
        sse.destroy();
        done();
      }, 50);
    });

    it('should handle object data with nested object', (done) => {
      const ctx = createMockKoaCtx();
      const sse = new KoaSSE(ctx, { closeEvent: 'close' });
      const chunks = [];
      sse.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      sse.write({ data: { key: 'value' } });
      setTimeout(() => {
        const output = chunks.join('');
        expect(output).to.include('data:{"key":"value"}\n\n');
        sse.destroy();
        done();
      }, 50);
    });

    it('should handle object data without id or event', (done) => {
      const ctx = createMockKoaCtx();
      const sse = new KoaSSE(ctx, { closeEvent: 'close' });
      const chunks = [];
      sse.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      sse.write({ data: 'plain' });
      setTimeout(() => {
        const output = chunks.join('');
        expect(output).to.not.include('id:');
        expect(output).to.not.include('event:');
        expect(output).to.include('data:plain\n\n');
        sse.destroy();
        done();
      }, 50);
    });
  });

  describe('send()', () => {
    it('should write data via send', (done) => {
      const ctx = createMockKoaCtx();
      const sse = new KoaSSE(ctx, { closeEvent: 'close' });
      const chunks = [];
      sse.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      sse.send('test-data');
      setTimeout(() => {
        const output = chunks.join('');
        expect(output).to.include('data:test-data\n\n');
        sse.destroy();
        done();
      }, 50);
    });

    it('should not throw on destroyed stream', (done) => {
      const ctx = createMockKoaCtx();
      const sse = new KoaSSE(ctx, { closeEvent: 'close' });
      sse.destroy();
      setTimeout(() => {
        expect(() => sse.send('data')).to.not.throw();
        done();
      }, 50);
    });
  });

  describe('close()', () => {
    it('should end stream with close event', (done) => {
      const ctx = createMockKoaCtx();
      const sse = new KoaSSE(ctx, { closeEvent: 'done' });
      const chunks = [];
      sse.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });
      sse.on('end', () => {
        const output = chunks.join('');
        expect(output).to.include('event:done\n');
        done();
      });
      sse.close();
    });
  });
});

describe('KoaSSEMiddleware', () => {
  let timers = [];
  const origSetInterval = global.setInterval;

  before(() => {
    global.setInterval = function (...args) {
      const id = origSetInterval.apply(this, args);
      timers.push(id);
      return id;
    };
  });

  afterEach(() => {
    timers.forEach(id => clearInterval(id));
    timers = [];
  });

  after(() => {
    global.setInterval = origSetInterval;
  });

  it('should return a function', () => {
    const mw = KoaSSEMiddleware();
    expect(mw).to.be.a('function');
  });

  it('should set ctx.sse and ctx.response.sse', async () => {
    const mw = KoaSSEMiddleware({ pingInterval: 100000, closeEvent: 'close' });
    const ctx = createMockKoaCtx();
    await mw(ctx, async () => {});
    expect(ctx.sse).to.be.instanceOf(KoaSSE);
    expect(ctx.response.sse).to.be.instanceOf(KoaSSE);
    ctx.sse.destroy();
  });

  it('should set body to sse stream when no body', async () => {
    const mw = KoaSSEMiddleware({ pingInterval: 100000, closeEvent: 'close' });
    const ctx = createMockKoaCtx();
    await mw(ctx, async () => {});
    expect(ctx.body).to.equal(ctx.sse);
    ctx.sse.destroy();
  });

  it('should pipe body into sse when body is Writable', async () => {
    const mw = KoaSSEMiddleware({ pingInterval: 100000, closeEvent: 'close' });
    const ctx = createMockKoaCtx();
    const stream = new PassThrough();
    await mw(ctx, async () => {
      ctx.body = stream;
    });
    expect(ctx.body).to.not.equal(stream);
    ctx.sse.destroy();
    stream.destroy();
  });

  it('should send existing body through sse', async () => {
    const mw = KoaSSEMiddleware({ pingInterval: 100000, closeEvent: 'close' });
    const ctx = createMockKoaCtx();
    await mw(ctx, async () => {
      ctx.body = 'existing data';
    });
    expect(ctx.body).to.be.instanceOf(KoaSSE);
    ctx.sse.destroy();
  });

  it('should call next and skip when headers already sent', async () => {
    const mw = KoaSSEMiddleware({ pingInterval: 100000, closeEvent: 'close' });
    const ctx = createMockKoaCtx();
    ctx.res.headersSent = true;
    let nextCalled = false;
    await mw(ctx, async () => { nextCalled = true; });
    expect(nextCalled).to.be.true;
    expect(ctx.sse).to.be.null;
  });

  it('should skip error log when ctx.sse exists and headers sent', async () => {
    const mw = KoaSSEMiddleware({ pingInterval: 100000, closeEvent: 'close' });
    const ctx = createMockKoaCtx();
    ctx.sse = {};
    ctx.res.headersSent = true;
    let nextCalled = false;
    await mw(ctx, async () => { nextCalled = true; });
    expect(nextCalled).to.be.true;
  });
});
