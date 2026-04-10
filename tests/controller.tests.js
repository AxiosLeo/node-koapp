'use strict';

const { expect } = require('chai');
const Controller = require('../src/controller');
const { HttpResponse } = require('../src/response');

describe('Controller', () => {
  let ctrl;

  beforeEach(() => {
    ctrl = new Controller();
  });

  describe('response()', () => {
    it('should throw HttpResponse', () => {
      try {
        ctrl.response({ data: 'test' }, '200;OK', 200);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.data).to.deep.equal({ data: 'test' });
        expect(e.code).to.equal('200;OK');
        expect(e.status).to.equal(200);
      }
    });

    it('should pass headers', () => {
      try {
        ctrl.response({}, '200;OK', 200, { 'X-Test': '1' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.headers).to.deep.equal({ 'X-Test': '1' });
      }
    });
  });

  describe('result()', () => {
    it('should throw HttpResponse with notResolve', () => {
      try {
        ctrl.result('data', 201, { 'X-H': 'v' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.data).to.equal('data');
        expect(e.status).to.equal(201);
        expect(e.notResolve).to.be.true;
      }
    });
  });

  describe('success()', () => {
    it('should throw HttpResponse with 200', () => {
      try {
        ctrl.success({ ok: true });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.code).to.equal('200;Success');
        expect(e.status).to.equal(200);
      }
    });

    it('should use empty default data', () => {
      try {
        ctrl.success();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.data).to.deep.equal({});
      }
    });
  });

  describe('failed()', () => {
    it('should throw HttpResponse with custom code and status', () => {
      try {
        ctrl.failed({ err: 'bad' }, '400;Bad Request', 400);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.code).to.equal('400;Bad Request');
        expect(e.status).to.equal(400);
      }
    });

    it('should use default status 501', () => {
      try {
        ctrl.failed();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.status).to.equal(501);
      }
    });
  });

  describe('error()', () => {
    it('should throw HttpResponse with status;msg code', () => {
      try {
        ctrl.error(403, 'Forbidden');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpResponse);
        expect(e.code).to.equal('403;Forbidden');
        expect(e.status).to.equal(403);
      }
    });
  });

  describe('log()', () => {
    it('should not throw', () => {
      expect(() => ctrl.log('test message')).to.not.throw();
    });

    it('should accept multiple arguments', () => {
      expect(() => ctrl.log('msg', { data: 1 }, [1, 2])).to.not.throw();
    });
  });
});
