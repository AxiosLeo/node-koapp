'use strict';

const http = require('http');
const { expect } = require('chai');
const { KoaApplication, Router, success, middlewares } = require('../index');

/**
 * Turn the Set-Cookie headers of a response into a Cookie request header.
 * @param {Response} res
 */
function cookieHeader(res) {
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

describe('KoaApplication', () => {
  let server;
  let base;

  before((done) => {
    const root = new Router('');
    root.post('/echo', async (context) => {
      const session = context.koa.session;
      session.n = (session.n || 0) + 1;
      success({ query: context.query, body: context.body, n: session.n });
    });
    root.get('/boom', async () => {
      throw new Error('thrown on purpose by tests/koa.tests.js');
    });

    // app.start() does not return the server, so serve the koa callback directly
    const app = new KoaApplication({ port: 0, routers: [root] });
    server = http.createServer(app.koa.callback());
    server.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });

  after((done) => {
    server.closeAllConnections();
    server.close(done);
  });

  it('should export the session middleware as a function', () => {
    expect(middlewares.KoaSessionMiddleware).to.be.a('function');
  });

  it('should respond with parsed query and body', async () => {
    const res = await fetch(`${base}/echo?a=1&a=2&b=x+y`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ k: 1 })
    });
    expect(res.status).to.equal(200);
    expect(res.headers.get('content-type')).to.include('application/json');
    const json = await res.json();
    expect(json.code).to.equal('200');
    expect(json.message).to.equal('Success');
    expect(json.request_id).to.be.a('string');
    expect(json.data).to.deep.equal({
      query: { a: ['1', '2'], b: 'x y' },
      body: { k: 1 },
      n: 1
    });
  });

  it('should set a signed session cookie and read it back', async () => {
    const first = await fetch(`${base}/echo`, { method: 'POST' });
    expect(first.status).to.equal(200);
    expect((await first.json()).data.n).to.equal(1);

    const names = first.headers.getSetCookie().map((c) => c.split('=')[0]);
    expect(names).to.include('koa.sess');
    expect(names).to.include('koa.sess.sig');

    const second = await fetch(`${base}/echo`, {
      method: 'POST',
      headers: { cookie: cookieHeader(first) }
    });
    expect(second.status).to.equal(200);
    expect((await second.json()).data.n).to.equal(2);
  });

  it('should respond 404 for an unknown route', async () => {
    const res = await fetch(`${base}/missing`);
    expect(res.status).to.equal(404);
    const json = await res.json();
    expect(json.code).to.equal('404');
    expect(json.message).to.equal('Not Found');
  });

  it('should respond 500 when a handler throws', async () => {
    // the response workflow prints the request and the error to stdout
    const res = await fetch(`${base}/boom`);
    expect(res.status).to.equal(500);
    expect(await res.text()).to.equal('Internal Server Error');
  });
});
