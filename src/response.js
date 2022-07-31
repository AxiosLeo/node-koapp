'use strict';

class HttpResponse extends Error {
  constructor(httpStatus, data, headers = {}) {
    super();
    this.headers = headers;
    this.status = httpStatus;
    this.data = data;
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
  throw new HttpResponse(status, data, headers ? headers : {});
};

const response = (data, code = '200;Success', status = 200, headers = {}) => {
  const [c, m] = code.split(';');
  throw new HttpResponse(status, {
    code: c,
    message: m,
    data,
  }, headers ? headers : {});
};

const success = (data = {}, headers = null) => {
  throw new HttpResponse(200, {
    code: '200',
    message: 'success',
    data,
  }, headers ? headers : {});
};

const failed = (data = {}, code = '500;Internal Server Error', status = 501, headers = {}) => {
  const [c, m] = code.split(';');
  throw new HttpResponse(status, {
    code: c,
    message: m,
    data: data,
  }, headers ? headers : {});
};

const error = (status, msg, headers = {}) => {
  throw new HttpResponse(status, {
    code: `${status}`,
    message: msg,
  }, headers ? headers : {});
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
