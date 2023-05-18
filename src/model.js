'use strict';

const Validator = require('validatorjs');
const { HttpError } = require('./response');

class Model {
  constructor(obj, rules = null, msg = null) {
    if (obj) {
      Object.assign(this, obj);
    }
    if (rules) {
      const validation = this.validate(rules, msg);
      if (validation.fails()) {
        const errors = validation.errors.all();
        const keys = Object.keys(errors);
        throw new HttpError(400, errors[keys[0]][0]);
      }
    }
  }

  static create(obj, rules = null, msg = null) {
    return new this(obj, rules, msg);
  }

  toJson() {
    return JSON.stringify(this);
  }

  toObj() {
    return JSON.parse(this.toJson());
  }

  properties() {
    return Object.keys(this);
  }

  count() {
    return this.properties().length;
  }

  validate(rules, msg) {
    const validation = new Validator(this, rules, msg);
    validation.check();
    return validation;
  }
}

module.exports = Model;
