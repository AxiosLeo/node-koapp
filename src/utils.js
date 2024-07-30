'use strict';

const { v4, v5, validate } = require('uuid');

function _uuid() {
  return v4();
}

function _request_id(app_id) {
  return `${v5(v4(), !validate(app_id) ? v4() : app_id)}`;
}

module.exports = {
  _uuid,
  _request_id
};
