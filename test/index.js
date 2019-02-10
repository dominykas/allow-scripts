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

            const fixture = Fixtures.setup('basic', [
                'with-preinstall-script',
                'with-install-script',
                'with-postinstall-script',
                'without-scripts',
                'without-install-scripts'
            ]);

            await Allow.run({});

            expect(fixture.getActualResult()).to.equal(fixture.getExpectedResult());
            expect(fixture.getLog()).not.to.contain('without-scripts');
            expect(fixture.getLog()).not.to.contain('without-install-scripts');
        });

        it('crashes on script not in allowed list', async () => {

            const fixture = Fixtures.setup('not-in-allowed', [
                'with-install-script',
                'with-postinstall-script',
                'without-scripts'
            ]);

            await expect(Allow.run({})).to.reject('No entry for @example/with-install-script');

            expect(fixture.getActualResult()).not.to.contain('with-postinstall-script');
            expect(fixture.getActualResult()).to.equal('');
            expect(fixture.getLog()).to.equal('');
        });
    });
});
