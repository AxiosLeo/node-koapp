'use strict';

class HttpResponse extends Error {
  constructor(config = {}) {
    super();
    Object.assign(this, {
      format: 'text',
      headers: {},
      status: 200,
      data: null,
      code: '',
      message: '',
      notResolve: false
    }, config);
  }
}

class HttpError extends Error {
  constructor(httpStatus, message, headers = {}) {
    super();
    this.status = httpStatus;
    this.message = message;
    this.headers = headers;
  }
}

const result = (data, status = 200, headers = {}) => {
  throw new HttpResponse({
    status,
    data,
    headers,
    notResolve: true
  });
};

const response = (data, code = '200;Success', status = 200, headers = {}, format = 'json') => {
  throw new HttpResponse({
    status,
    data,
    code,
    headers,
    format
  });
};

const success = (data = {}, headers = {}) => {
  response(data, '200;Success', 200, headers);
};

const failed = (data = {}, code = '501;Internal Server Error', status = 501, headers = {}) => {
  response(data, code, status, headers);
};

const error = (status, msg, headers = {}) => {
  response({}, `${status};${msg}`, status, headers);
};

module.exports = {
  HttpError,
  HttpResponse,

  response,
  success,
  failed,
  result,
  error
};
