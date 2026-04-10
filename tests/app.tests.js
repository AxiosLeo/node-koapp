'use strict';

const { expect } = require('chai');
const Application = require('../src/apps/app');
const { Router } = require('../src/router');

describe('Application', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const app = new Application({});
      expect(app.config).to.not.be.undefined;
      expect(app.config.debug).to.equal(false);
      expect(app.app_id).to.be.a('string');
      expect(app.routes).to.be.an('object');
    });

    it('should generate unique app_id when not provided', () => {
      const app1 = new Application({});
      const app2 = new Application({});
      expect(app1.app_id).to.be.a('string');
      expect(app2.app_id).to.be.a('string');
      expect(app1.app_id).to.not.equal(app2.app_id);
    });

    it('should use custom app_id from config', () => {
      const app = new Application({ app_id: 'my-custom-id' });
      expect(app.app_id).to.equal('my-custom-id');
    });

    it('should set debug from config', () => {
      const app = new Application({ debug: true });
      expect(app.config.debug).to.equal(true);
    });

    it('should resolve routers', () => {
      const router = new Router('/api');
      router.get('/test', async () => {});
      const app = new Application({ routers: [router] });
      expect(app.routes).to.be.an('object');
      expect(Object.keys(app.routes).length).to.be.greaterThan(0);
    });

    it('should be an EventEmitter', () => {
      const app = new Application({});
      expect(app.on).to.be.a('function');
      expect(app.emit).to.be.a('function');
    });

    it('should emit starting event', (done) => {
      const app = new Application({});
      app.on('starting', () => {
        done();
      });
      app.emit('starting');
    });
  });

  describe('start()', () => {
    it('should throw "not implemented"', async () => {
      const app = new Application({});
      try {
        await app.start();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e.message).to.equal('not implemented');
      }
    });
  });
});
