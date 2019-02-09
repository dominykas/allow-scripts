'use strict';

const Sinon = require('sinon');

const Allow = require('..');

const { describe, it, beforeEach, afterEach } = exports.lab = require('lab').script();
const { expect } = require('code');

describe('allow-scripts', () => {

    describe('run()', () => {

        beforeEach(() => {

            Sinon.stub(console, 'log');
        });

        afterEach(() => {

            Sinon.restore();
        });

        it('executes allowed scripts', async () => {

            await Allow.run({});

            expect(true).to.equal(true);
        });
    });
});
