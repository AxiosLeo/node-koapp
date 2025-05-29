'use strict';

const net = require('net');
const { printer, debug } = require('@axiosleo/cli-tool');
const is = require('@axiosleo/cli-tool/src/helper/is');
const { _fixed, _str } = require('@axiosleo/cli-tool/src/helper/str');
const EventEmitter = require('events');
const { v4, v5, validate } = require('uuid');

function _uuid() {
  return v4();
}

function _uuid_salt(salt = '') {
  return `${v5(v4(), !validate(salt) ? v4() : salt)}`;
}

/**
 * @param {import("..").KoaContext} context 
 */
function _debug(context, location, error) {
  const wide = 12;
  printer.println('-'.repeat(30) + '[DEBUG Info]' + '-'.repeat(30));
  printer.yellow(_fixed('requestID', wide)).print(': ').println(context.request_id);
  if (!error) {
    printer.yellow('responseData').print(': ');
    // eslint-disable-next-line no-console
    console.log(context.response.data);
  }
  if (location && location.indexOf('node:internal') === -1) {
    printer.print('response    '.data).print(': ').print(location.trim().yellow).println();
  }
  printer.yellow(_fixed('datetime', wide)).print(': ').println(new Date().toLocaleString());
  printer.yellow(_fixed('method', wide)).print(': ').green(context.method).println();
  printer.yellow(_fixed('path', wide)).print(': ').println(context.url);
  if (!context.router) {
    return;
  }
  const router = context.router;
  ['pathinfo', 'validators'].forEach(k => {
    if (is.empty(router[k])) {
      return;
    }
    printer.yellow(_fixed(k, wide)).print(': ').println(typeof router[k] === 'object' ? JSON.stringify(router[k]) : _str(router[k]));
  });
  ['query', 'params', 'body'].forEach(k => {
    if (is.empty(context[k])) {
      return;
    }
    printer.yellow(_fixed(k, wide)).print(': ').println(typeof context[k] === 'object' ? JSON.stringify(context[k]) : _str(context[k]));
  });
}

class SocketClient {
  constructor(options = {}) {
    this.options = Object.assign({
      port: 8081,
      host: 'localhost',
      name: 'default',
    }, options);
    this.event = new EventEmitter();
    this.client = net.connect(this.options);
    this.client.on('connect', () => {
      debug.log('connection success');
      this.event.emit('connect');
    });
    this.cache = [];
    this.client.on('data', (data) => {
      let str = data.toString();
      if (str.indexOf('@@@@@@') === -1) {
        debug.log('no end tag, push to cache', str);
        this.cache.push(data);
        return;
      }
      this.cache.push(data.subarray(0, data.indexOf('@@@@@@')));
      str = Buffer.concat(this.cache).toString();
      let temp = data.subarray(data.indexOf('@@@@@@') + 6);
      this.cache = temp.length > 0 ? [temp] : [];
      if (str.indexOf('@@@@@@') !== -1) {
        str = str.substring(0, str.indexOf('@@@@@@'));
      }
      if (str.length === 0) {
        return this.event.emit('error', new Error('empty data'));
      }
      this.event.emit('data', JSON.parse(str));
    });
    this.client.on('error', (err) => {
      debug.log('connection error', err.message);
      // this.event.emit('error', err);
    });
    const self = this;
    this.client.on('end', function () {
      debug.log('connection end, will reconnect', self.options);
    });
  }

  reconnect() {
    if (this.client) {
      this.client.destroy();
    }
    this.client = net.connect(this.options);
    this.client.on('connect', () => {
      debug.log('connection success');
      this.event.emit('connect');
    });
    this.client.on('data', (data) => {
      let str = data.subarray(0, data.length - 6).toString();
      this.event.emit('data', JSON.parse(str));
    });
    this.client.on('error', (err) => {
      debug.log('connection error', err.message);
      this.event.emit('error', err);
    });
    this.client.on('end', function () {
      debug.log('connection end');
    });
    this.event.emit('reconnect');
  }

  async send(method, pathinfo, query = {}, body = {}) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    if (!is.string(method) || !methods.includes(method.toLowerCase())) {
      throw new Error('method must be one of get, post, put, delete, patch');
    }
    if (!is.string(pathinfo)) {
      throw new Error('pathinfo must be a string');
    }
    if (!is.object(query)) {
      throw new Error('query must be an object');
    }
    if (!is.object(body)) {
      throw new Error('body must be an object');
    }
    if (this.client && this.client.destroyed) {
      this.reconnect();
    }
    if (!this.client) {
      throw new Error('socket client is not connected');
    }
    const self = this;
    return new Promise((resolve, reject) => {
      if (this.client) {
        const bufferBody = Buffer.from(`${Buffer.from(JSON.stringify({
          path: pathinfo,
          method,
          query,
          body
        }).toString('base64'))}@@@@@@`);
        this.event.on('data', (data) => {
          debug.log('data123', { data });
          resolve(data);
        });
        this.client.write(bufferBody, (e) => {
          if (e) {
            self.event.emit('error', e);
            reject(e);
          }
        });
      } else {
        reject(new Error('socket client is not connected'));
      }
    });
  }
}

module.exports = {
  _uuid,
  _debug,
  _uuid_salt,

  SocketClient
};
