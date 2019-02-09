'use strict';

const Fixtures = require('./fixtures');
const Sinon = require('sinon');


const Allow = require('..');


const { describe, it, beforeEach, afterEach } = exports.lab = require('lab').script();
const { expect } = require('code');

describe('allow-scripts', () => {

    describe('run()', () => {

        let cwd;
        beforeEach(() => {

            Sinon.stub(console, 'log');
            Sinon.stub(console, 'info');
            cwd = process.cwd();
        });

        afterEach(() => {

            Fixtures.restore();
            Sinon.restore();
            process.chdir(cwd);
        });

        it('executes allowed scripts', async () => {

            const { getResults } = Fixtures.setup('basic', ['with-install-script']);

            await Allow.run({});

            expect(getResults()).to.equal('install from with-install-script');
        });
    });
});
