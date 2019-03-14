'use strict';

const Cp = require('child_process');
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

            expect(fixture.getActualResult()).to.equal(Fixtures.expectedResults.basicFull);
            expect(fixture.getLog()).not.to.contain('without-scripts');
            expect(fixture.getLog()).not.to.contain('without-install-scripts');

            expect(Fs.existsSync(Path.join(fixture.cwd, 'npm-shrinkwrap.json'))).to.equal(false);
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
            expect(fixture.getLog()).to.equal(Fixtures.expectedResults.basicDryRun);
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

            expect(fixture.getActualResult()).to.equal(Fixtures.expectedResults.deep);

            const log = fixture.getLog();
            expect(log).not.to.contain('without-scripts');
            expect(log).not.to.contain('without-install-scripts');
            expect(log).not.to.contain('install @example/deep');
        });

        it('executes allowed scripts (skips cycles)', async () => {

            const fixture = Fixtures.setup('with-cycles', [
                'cycle-a',
                'cycle-b',
                'with-install-script'
            ]);

            await Allow.run({});

            expect(fixture.getActualResult()).to.equal('install from with-install-script');
            expect(fixture.getLog()).to.contain('skip node_modules/@example/cycle-a (because it has a cycle in dependencies)');
            expect(fixture.getLog()).to.contain('skip node_modules/@example/cycle-b (because it has a cycle in dependencies)');
        });

        it('executes allowed scripts (existing shrinkwrap)', async () => {

            const fixture = Fixtures.setup('basic', [
                'with-preinstall-script',
                'with-install-script',
                'with-postinstall-script',
                'without-scripts',
                'without-install-scripts'
            ]);

            Cp.execSync('npm shrinkwrap', { cwd: fixture.cwd });

            await Allow.run({});

            expect(fixture.getActualResult()).to.equal(Fixtures.expectedResults.basicFull);

            expect(Fs.existsSync(Path.join(fixture.cwd, 'npm-shrinkwrap.json'))).to.equal(true);
        });

        it('executes allowed scripts (existing package-lock)', async () => {

            const fixture = Fixtures.setup('basic', [
                'with-preinstall-script',
                'with-install-script',
                'with-postinstall-script',
                'without-scripts',
                'without-install-scripts'
            ]);

            Cp.execSync('npm shrinkwrap', { cwd: fixture.cwd });
            Cp.execSync('mv npm-shrinkwrap.json package-lock.json', { cwd: fixture.cwd });

            await Allow.run({});

            expect(fixture.getActualResult()).to.equal(Fixtures.expectedResults.basicFull);

            expect(Fs.existsSync(Path.join(fixture.cwd, 'package-lock.json'))).to.equal(true);
            expect(Fs.existsSync(Path.join(fixture.cwd, 'npm-shrinkwrap.json'))).to.equal(false);
        });

        it('crashes on script not in allowed list', async () => {

            const fixture = Fixtures.setup('not-in-allowed', [
                'with-install-script',
                'with-postinstall-script',
                'without-scripts'
            ]);

            await expect(Allow.run({})).to.reject('Mis-configured allowedScripts: @example/with-install-script (no entry)');

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

            await expect(Allow.run({})).to.reject('Mis-configured allowedScripts: @example/with-install-script (invalid semver range: not-a-semver-range)');

            expect(fixture.getActualResult()).to.equal('');
            expect(fixture.getLog()).to.equal('');
        });

        it('crashes on missing allowScripts section', async () => {

            const fixture = Fixtures.setup('nothing-allowed', [
                'with-install-script',
                'with-postinstall-script',
                'without-scripts'
            ]);

            await expect(Allow.run({})).to.reject('Mis-configured allowedScripts: @example/with-install-script (no entry), @example/with-postinstall-script (no entry)');

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
