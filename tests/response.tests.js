'use strict';

const { expect } = require('chai');
const {
  HttpResponse,
  HttpError,
  response,
  result,
  success,
  failed,
  error
} = require('../src/response');

describe('response module', () => {
  describe('HttpResponse', () => {
    it('should create with default values', () => {
      const res = new HttpResponse();
      expect(res).to.be.instanceOf(Error);
      expect(res.format).to.equal('text');
      expect(res.headers).to.deep.equal({});
      expect(res.status).to.equal(200);
      expect(res.data).to.be.null;
      expect(res.code).to.equal('');
      expect(res.message).to.equal('');
      expect(res.notResolve).to.be.false;
      expect(res.stack).to.be.a('string');
    });

    it('should create with custom config', () => {
      const res = new HttpResponse({
        format: 'json',
        headers: { 'X-Custom': 'test' },
        status: 404,
        data: { foo: 'bar' },
        code: '404;Not Found',
        message: 'Not Found',
        notResolve: true
      });
      expect(res.format).to.equal('json');
      expect(res.headers).to.deep.equal({ 'X-Custom': 'test' });
      expect(res.status).to.equal(404);
      expect(res.data).to.deep.equal({ foo: 'bar' });
      expect(res.code).to.equal('404;Not Found');
      expect(res.message).to.equal('Not Found');
      expect(res.notResolve).to.be.true;
    });

    it('should override default values with config', () => {
      const res = new HttpResponse({ status: 500, format: 'json' });
      expect(res.status).to.equal(500);
      expect(res.format).to.equal('json');
      expect(res.data).to.be.null;
    });
  });

  describe('HttpError', () => {
    it('should create with status and message', () => {
      const err = new HttpError(400, 'Bad Request');
      expect(err).to.be.instanceOf(Error);
      expect(err.status).to.equal(400);
      expect(err.message).to.equal('Bad Request');
      expect(err.headers).to.deep.equal({});
      expect(err.stack).to.be.a('string');
    });

    it('should create with custom headers', () => {
      const err = new HttpError(401, 'Unauthorized', { 'WWW-Authenticate': 'Bearer' });
      expect(err.status).to.equal(401);
      expect(err.message).to.equal('Unauthorized');
      expect(err.headers).to.deep.equal({ 'WWW-Authenticate': 'Bearer' });
    });
  });

  describe('result()', () => {
    it('should throw HttpResponse with notResolve true', () => {
      try {
        result({ test: 1 }, 201, { 'X-Header': 'val' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.data).to.deep.equal({ test: 1 });
        expect(e.status).to.equal(201);
        expect(e.headers).to.deep.equal({ 'X-Header': 'val' });
        expect(e.notResolve).to.be.true;
      }
    });

    it('should use default status and headers', () => {
      try {
        result('data');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.data).to.equal('data');
        expect(e.status).to.equal(200);
        expect(e.headers).to.deep.equal({});
      }
    });
  });

  describe('response()', () => {
    it('should throw HttpResponse with json format', () => {
      try {
        response({ msg: 'test' }, '200;OK', 200, { 'Content-Type': 'application/json' }, 'json');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.data).to.deep.equal({ msg: 'test' });
        expect(e.code).to.equal('200;OK');
        expect(e.status).to.equal(200);
        expect(e.format).to.equal('json');
        expect(e.headers).to.deep.equal({ 'Content-Type': 'application/json' });
      }
    });

    it('should use defaults', () => {
      try {
        response('data');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.code).to.equal('200;Success');
        expect(e.status).to.equal(200);
        expect(e.format).to.equal('json');
        expect(e.headers).to.deep.equal({});
      }
    });
  });

  describe('success()', () => {
    it('should throw HttpResponse with 200 status', () => {
      try {
        success({ result: 'ok' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.data).to.deep.equal({ result: 'ok' });
        expect(e.code).to.equal('200;Success');
        expect(e.status).to.equal(200);
      }
    });

    it('should pass custom headers', () => {
      try {
        success({}, { 'X-Custom': 'yes' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.headers).to.deep.equal({ 'X-Custom': 'yes' });
      }
    });

    it('should use default empty data', () => {
      try {
        success();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.data).to.deep.equal({});
      }
    });
  });

  describe('failed()', () => {
    it('should throw HttpResponse with 501 default', () => {
      try {
        failed({ error: 'something' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.data).to.deep.equal({ error: 'something' });
        expect(e.code).to.equal('501;Internal Server Error');
        expect(e.status).to.equal(501);
      }
    });

    it('should accept custom code and status', () => {
      try {
        failed({ data: 'err' }, '403;Forbidden', 403);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.code).to.equal('403;Forbidden');
        expect(e.status).to.equal(403);
      }
    });

    it('should accept custom headers', () => {
      try {
        failed({}, '400;Bad', 400, { 'X-Err': '1' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.headers).to.deep.equal({ 'X-Err': '1' });
      }
    });
  });

  describe('error()', () => {
    it('should build code string from status and msg', () => {
      try {
        error(404, 'Not Found');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.code).to.equal('404;Not Found');
        expect(e.status).to.equal(404);
        expect(e.data).to.deep.equal({});
      }
    });

    it('should pass custom headers', () => {
      try {
        error(500, 'Server Error', { 'X-Debug': 'true' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.headers).to.deep.equal({ 'X-Debug': 'true' });
      }
    });
  });
});
