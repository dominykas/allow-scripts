'use strict';

const Fs = require('fs');
const Fixtures = require('./fixtures');
const Path = require('path');

const Allow = require('..');


const { describe, it, beforeEach, afterEach } = exports.lab = require('lab').script();
const { expect } = require('code');

describe('allow-scripts', () => {

    describe('run()', () => {

        let cwd;
        beforeEach(() => {

            cwd = process.cwd();
        });

        afterEach(() => {

            Fixtures.restore();
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

            expect(fixture.getActualResult()).to.equal(Fs.readFileSync(Path.join(__dirname, 'fixtures', 'basic.full.txt')).toString().trim());
            expect(fixture.getLog()).not.to.contain('without-scripts');
            expect(fixture.getLog()).not.to.contain('without-install-scripts');
        });

        it('dry run: reports allowed scripts', async () => {

            const fixture = Fixtures.setup('basic', [
                'with-preinstall-script',
                'with-install-script',
                'with-postinstall-script',
                'without-scripts',
                'without-install-scripts'
            ]);

            await Allow.run({ dryRun: true });

            expect(fixture.getActualResult()).to.equal('');
            expect(fixture.getLog()).to.equal(Fs.readFileSync(Path.join(__dirname, 'fixtures', 'basic.dry-run.txt')).toString().trim());
        });

        it('executes allowed scripts (subdeps)', async () => {

            const fixture = Fixtures.setup('deep', [
                'basic',
                'with-preinstall-script',
                'with-install-script',
                'with-postinstall-script',
                'without-scripts',
                'without-install-scripts'
            ]);

            await Allow.run({});

            expect(fixture.getActualResult()).to.equal(Fs.readFileSync(Path.join(__dirname, 'fixtures', 'deep.txt')).toString().trim());
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

            expect(fixture.getActualResult()).to.equal('');
            expect(fixture.getLog()).to.equal('');
        });

        it('skips scripts which are forbidden', async () => {

            const fixture = Fixtures.setup('allowed-false', [
                'with-install-script',
                'with-postinstall-script',
                'without-scripts'
            ]);

            await Allow.run({});

            expect(fixture.getActualResult()).not.to.contain('with-install-script');
            expect(fixture.getActualResult()).to.equal('postinstall from with-postinstall-script');
            expect(fixture.getLog()).to.contain('skip node_modules/@example/with-install-script (because it is not allowed in package.json)');
        });

        it('skips scripts which are outside of allowed semver range', async () => {

            const fixture = Fixtures.setup('allowed-semver', [
                'with-install-script',
                'with-postinstall-script',
                'without-scripts'
            ]);

            await Allow.run({});

            expect(fixture.getActualResult()).not.to.contain('with-install-script');
            expect(fixture.getActualResult()).to.equal('postinstall from with-postinstall-script');
            expect(fixture.getLog()).to.contain('skip node_modules/@example/with-install-script (because 0.0.0 is outside of allowed range: 1.x.x)');
        });

        it('crashes on invalid semver range', async () => {

            const fixture = Fixtures.setup('invalid-semver', [
                'with-install-script',
                'with-postinstall-script',
                'without-scripts'
            ]);

            await expect(Allow.run({})).to.reject('Invalid version range in allowScripts[@example/with-install-script]: not-a-semver-range');

            expect(fixture.getActualResult()).to.equal('');
            expect(fixture.getLog()).to.equal('');
        });

        it('crashes on missing allowScripts section', async () => {

            const fixture = Fixtures.setup('nothing-allowed', [
                'with-install-script',
                'with-postinstall-script',
                'without-scripts'
            ]);

            await expect(Allow.run({})).to.reject('No entry for @example/with-install-script');

            expect(fixture.getActualResult()).to.equal('');
            expect(fixture.getLog()).to.equal('');
        });

        it('crashes on incomplete installed tree', async () => {

            Fixtures.setup('basic', [
                // 'with-preinstall-script',
                'with-install-script',
                // 'with-postinstall-script',
                'without-scripts',
                'without-install-scripts'
            ]);

            await expect(Allow.run({})).to.reject('Failed to read the installed tree - you might want to `rm -rf node_modules && npm i --ignore-scripts`.');
        });
    });
});
