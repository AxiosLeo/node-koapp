'use strict';

const { EventEmitter } = require('events');
const event = new EventEmitter();

const register = (name, ...listeners) => {
  event.on(name, ...listeners);
};

const listen = (name, ...args) => {
  return event.emit(name, ...args);
};

module.exports = {
  listen,
  register
};
