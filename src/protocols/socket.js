'use strict';

const { _assign } = require('@axiosleo/cli-tool/src/helper/obj');
const is = require('@axiosleo/cli-tool/src/helper/is');

class SocketPackageResolver {
  constructor(options = {}) {
    this.options = _assign({
      header_len: 4,
      package_serial_number: 0,
      package_serial_number_len: 2
    }, options);
  }

  /**
   * @param {*} data 
   * @returns {Buffer}
   */
  encode(data, serialNumber) {
    if (is.invalid(data)) {
      data = '';
    }
    if (is.object(data) || is.array(data)) {
      data = JSON.stringify(data);
    } else {
      data = `${data}`;
    }

    const body = Buffer.from(data);
    const header = Buffer.alloc(this.options.header_len);
    header.writeInt16BE(serialNumber || this.options.package_serial_number);
    header.writeInt16BE(body.length, this.options.package_serial_number_len);

    if (typeof serialNumber === 'undefined') {
      this.options.package_serial_number++;
    }

    return Buffer.concat([header, body]);
  }

  /**
   * @param {Buffer} buffer 
   */
  decode(buffer) {
    const header = buffer.subarray(0, this.options.header_len);
    const body = buffer.subarray(this.header_len);

    return {
      package_serial_number: header.readInt16BE(),
      content_length: header.readInt16BE(this.options.package_serial_number_len),
      body: body.toString(),
    };
  }
}

module.exports = {
  SocketPackageResolver
};
