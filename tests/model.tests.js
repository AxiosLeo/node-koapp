'use strict';

const { expect } = require('chai');
const Model = require('../src/model');
const { HttpError } = require('../src/response');

describe('Model', () => {
  describe('constructor', () => {
    it('should create empty model with no args', () => {
      const model = new Model();
      expect(model).to.be.instanceOf(Model);
      expect(model.count()).to.equal(0);
    });

    it('should assign properties from obj', () => {
      const model = new Model({ name: 'test', value: 42 });
      expect(model.name).to.equal('test');
      expect(model.value).to.equal(42);
    });

    it('should pass with valid rules', () => {
      const model = new Model({ name: 'test' }, { name: 'required' });
      expect(model.name).to.equal('test');
    });

    it('should throw HttpError with invalid rules', () => {
      try {
        new Model({}, { name: 'required' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpError);
        expect(e.status).to.equal(400);
        expect(e.message).to.be.a('string');
      }
    });

    it('should throw HttpError with custom messages', () => {
      try {
        new Model({}, { email: 'required' }, { required: ':attribute is missing' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpError);
        expect(e.message).to.equal('email is missing');
      }
    });

    it('should handle null obj', () => {
      const model = new Model(null);
      expect(model.count()).to.equal(0);
    });
  });

  describe('static create()', () => {
    it('should create model instance', () => {
      const model = Model.create({ a: 1, b: 2 });
      expect(model).to.be.instanceOf(Model);
      expect(model.a).to.equal(1);
      expect(model.b).to.equal(2);
    });

    it('should throw HttpError on validation failure', () => {
      try {
        Model.create({}, { param: 'required' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).to.be.instanceOf(HttpError);
        expect(e.status).to.equal(400);
      }
    });
  });

  describe('toJson()', () => {
    it('should serialize to JSON string', () => {
      const model = new Model({ name: 'test', count: 5 });
      const json = model.toJson();
      expect(json).to.be.a('string');
      const parsed = JSON.parse(json);
      expect(parsed.name).to.equal('test');
      expect(parsed.count).to.equal(5);
    });
  });

  describe('toObj()', () => {
    it('should return plain object', () => {
      const model = new Model({ x: 1 });
      const obj = model.toObj();
      expect(obj).to.deep.equal({ x: 1 });
      expect(obj).not.to.be.instanceOf(Model);
    });

    it('should deep-clone nested models', () => {
      const model = new Model({
        sub: new Model({ a: 'A' })
      });
      const obj = model.toObj();
      expect(obj.sub).to.deep.equal({ a: 'A' });
    });
  });

  describe('properties()', () => {
    it('should return array of property names', () => {
      const model = new Model({ a: 1, b: 2, c: 3 });
      const props = model.properties();
      expect(props).to.deep.equal(['a', 'b', 'c']);
    });

    it('should return empty array for empty model', () => {
      const model = new Model();
      expect(model.properties()).to.deep.equal([]);
    });
  });

  describe('count()', () => {
    it('should return number of properties', () => {
      const model = new Model({ a: 1, b: 2 });
      expect(model.count()).to.equal(2);
    });

    it('should return 0 for empty model', () => {
      const model = new Model();
      expect(model.count()).to.equal(0);
    });
  });

  describe('validate()', () => {
    it('should return passing validation', () => {
      const model = new Model({ name: 'test' });
      const validation = model.validate({ name: 'required' });
      expect(validation.fails()).to.be.false;
    });

    it('should return failing validation', () => {
      const model = new Model({ name: '' });
      const validation = model.validate({ name: 'required' });
      expect(validation.fails()).to.be.true;
      expect(validation.errors.all()).to.have.property('name');
    });

    it('should accept custom messages', () => {
      const model = new Model({});
      const validation = model.validate(
        { name: 'required' },
        { required: ':attribute is mandatory' }
      );
      expect(validation.fails()).to.be.true;
      const errors = validation.errors.all();
      expect(errors.name[0]).to.equal('name is mandatory');
    });
  });
});
