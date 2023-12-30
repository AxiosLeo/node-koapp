#!/usr/bin/env node

'use strict';

const { App } = require('@axiosleo/cli-tool');

const app = new App({
  name: 'koapp CLI',
  desc: 'koapp application generator',
  bin: 'koapp',
  version: '0.5.0',
});

app.start();
