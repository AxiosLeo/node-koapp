'use strict';

const { expect } = require('chai');
const { validate: uuidValidate } = require('uuid');
const { _uuid, _uuid_salt, _debug } = require('../src/utils');

describe('utils', () => {
  describe('_uuid()', () => {
    it('should return a valid UUID v4', () => {
      const id = _uuid();
      expect(id).to.be.a('string');
      expect(uuidValidate(id)).to.be.true;
    });

    it('should return unique values', () => {
      const ids = new Set(Array.from({ length: 10 }, () => _uuid()));
      expect(ids.size).to.equal(10);
    });
  });

  describe('_uuid_salt()', () => {
    it('should return a string', () => {
      const id = _uuid_salt();
      expect(id).to.be.a('string');
    });

    it('should return a valid UUID', () => {
      const id = _uuid_salt();
      expect(uuidValidate(id)).to.be.true;
    });

    it('should accept a valid UUID as salt', () => {
      const salt = _uuid();
      const id = _uuid_salt(salt);
      expect(id).to.be.a('string');
      expect(uuidValidate(id)).to.be.true;
    });

    it('should handle non-UUID salt', () => {
      const id = _uuid_salt('not-a-uuid');
      expect(id).to.be.a('string');
      expect(uuidValidate(id)).to.be.true;
    });

    it('should handle empty string salt', () => {
      const id = _uuid_salt('');
      expect(id).to.be.a('string');
      expect(uuidValidate(id)).to.be.true;
    });
  });

  describe('_debug()', () => {
    it('should not throw with minimal context and error flag', () => {
      const context = {
        request_id: 'test-id',
        method: 'GET',
        url: '/test',
        query: {},
        params: {},
        body: {},
        response: { status: 200, message: 'OK', data: 'test' }
      };
      expect(() => _debug(context, null, true)).to.not.throw();
    });

    it('should handle context with non-empty params', () => {
      const context = {
        request_id: 'test-id',
        method: 'POST',
        url: '/test',
        query: { a: '1' },
        params: { id: '123' },
        body: { name: 'test' },
        response: { status: 200, message: 'OK', data: {} }
      };
      expect(() => _debug(context, null, true)).to.not.throw();
    });

    it('should handle context with router info', () => {
      const context = {
        request_id: 'test-id',
        method: 'GET',
        url: '/api/test',
        query: {},
        params: {},
        body: {},
        router: {
          pathinfo: '/api/test',
          validators: { params: { rules: { id: 'required' } } }
        },
        response: { status: 200, message: 'OK', data: {} }
      };
      expect(() => _debug(context, null, true)).to.not.throw();
    });

    it('should handle location string', () => {
      const context = {
        request_id: 'test-id',
        method: 'GET',
        url: '/test',
        query: {},
        params: {},
        body: {},
        response: { status: 200, message: 'OK', data: 'data' }
      };
      expect(() => _debug(context, '  at Object.<anonymous> (/test.js:1:1)', true)).to.not.throw();
    });

    it('should skip node:internal locations', () => {
      const context = {
        request_id: 'test-id',
        method: 'GET',
        url: '/test',
        query: {},
        params: {},
        body: {},
        response: { status: 200, message: 'OK', data: null }
      };
      expect(() => _debug(context, 'node:internal/something', true)).to.not.throw();
    });

    it('should print response info when error is falsy', () => {
      const context = {
        request_id: 'test-id',
        method: 'GET',
        url: '/test',
        query: {},
        params: {},
        body: {},
        response: { status: 200, message: 'OK', data: { result: 'ok' } }
      };
      expect(() => _debug(context, null, false)).to.not.throw();
    });

    it('should handle string params/query/body', () => {
      const context = {
        request_id: 'test-id',
        method: 'GET',
        url: '/test',
        query: 'raw-query',
        params: 'raw-params',
        body: 'raw-body',
        response: { status: 200, message: 'OK', data: {} }
      };
      expect(() => _debug(context, null, true)).to.not.throw();
    });
  });
});
