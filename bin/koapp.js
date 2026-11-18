#!/usr/bin/env node

'use strict';

const path = require('path');
const { Interface } = require('readline');

// Newer Node throws ERR_USE_AFTER_CLOSE when pause() is called on a closed
// readline interface. Enquirer 2.4.1 does exactly that when a prompt is
// cancelled (Ctrl+C / Esc), which would crash the CLI with a stack trace.
const pauseInterface = Interface.prototype.pause;
Interface.prototype.pause = function pauseIfOpen() {
  if (this.closed) {
    return this;
  }
  return pauseInterface.call(this);
};

const { App } = require('@axiosleo/cli-tool');

const app = new App({
  name: 'koapp CLI',
  desc: 'koapp application generator',
  bin: 'koapp',
  version: '2.0.0',
  commands_dir: path.join(__dirname, '../commands'),
});

app.locale({
  sets: ['en-US', 'zh-CN',],
  dir: path.join(__dirname, '../assets/locales'),
  format: 'js',
});

app.start();
