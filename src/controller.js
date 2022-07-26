'use strict';

const {
  response,
  result,
  success,
  failed,
  error,
} = require('./response');
const { debug } = require('@axiosleo/cli-tool');

class Controller {
  response(data, code, status = 200, headers = {}) {
    response(data, code, status, headers);
  }

  result(data, status = 200, headers = {}) {
    result(data, status, headers);
  }

  success(data = {}, headers = {}) {
    success(data, headers);
  }

  failed(data = {}, code, status = 501, headers = {}) {
    failed(data, code, status, headers);
  }

  error(status, msg, headers) {
    error(status, msg, headers);
  }

  log(...data) {
    debug.log.apply(this, data);
  }
}

module.exports = Controller;
