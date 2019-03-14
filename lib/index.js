'use strict';

const Assert = require('assert');
const Cp = require('child_process');
const Fs = require('fs');
const Npm = require('libnpm');
const Path = require('path');
const Semver = require('semver');
const Topo = require('topo');


const internals = {};


internals.scan = (tree, parent, map = new Map(), scanned = new Set()) => {

    for (const [, v] of tree.dependencies) {

        if (v.hasCycle()) {
            console.warn(`==========> skip ${v.path()} (because it has a cycle in dependencies)`);
            continue;
        }

        const path = v.path();
        if (!map.has(path)) {
            map.set(path, []);
        }

        const node = map.get(path);
        node.push(parent);

        if (!scanned.has(v)) {
            scanned.add(v);
            internals.scan(v, v.path(), map, scanned);
        }
    }

    return map;
};


internals.queue = (tree) => {

    const map = internals.scan(tree);
    const topo = new Topo();
    for (const [group, before] of map) {
        topo.add(group, { group, before });
    }

    return topo.nodes;
};

internals.runScript = (stage, { pkg, path, cwd, unsafePerm }, options) => {

    if (!pkg.scripts || !pkg.scripts[stage]) {
        return;
    }

    console.log();

    if (options.dryRun) {
        console.log(`DRY RUN ==> ${stage} ${path || pkg.name}`);
        return;
    }

    console.log(`==========> ${stage} ${path || pkg.name}...`);
    return Npm.runScript(pkg, stage, Path.join(cwd, path), {
        dir: cwd,
        unsafePerm, // @todo: find an official way to do this for top level package
        log: Object.assign({
            pause: () => {},
            clearProgress: () => {},
            showProgress: () => {},
            verbose: () => {},
            silly: () => {},
            resume: () => {}
        }, console),
        config: {}
    });
};

internals.getLockFile = (cwd) => {

    if (Fs.existsSync(Path.join(cwd, 'npm-shrinkwrap.json'))) {
        return require(Path.join(cwd, 'npm-shrinkwrap.json'));
    }

    if (Fs.existsSync(Path.join(cwd, 'package-lock.json'))) {
        return require(Path.join(cwd, 'package-lock.json'));
    }

    Cp.execSync('npm shrinkwrap');

    const lockFilePath = Path.join(cwd, 'npm-shrinkwrap.json');
    const lockFileContents = require(lockFilePath);

    Fs.unlinkSync(lockFilePath);
    return lockFileContents;
};

exports.run = async (options) => {

    const cwd = process.cwd();
    const pkg = require(Path.join(cwd, 'package.json'));

    pkg._id = `${pkg.name}@${pkg.version}`; // @todo: find an official way to do this for top level package

    try {
        var tree = Npm.logicalTree(pkg, internals.getLockFile(cwd));
    }
    catch (err) {
        throw new Error('Failed to read the installed tree - you might want to `rm -rf node_modules && npm i --ignore-scripts`.');
    }

    const queue = internals.queue(tree);

    const allowScripts = pkg.allowScripts || {};

    const packagesWithScripts = queue
        .map((path) => {

            const childPkg = require(Path.join(cwd, path, 'package.json'));

            return { path, childPkg };
        })
        .filter(({ childPkg }) => {

            return childPkg.scripts && (childPkg.scripts.install || childPkg.scripts.preinstall || childPkg.scripts.postinstall);
        });

    const allowedPackages = [];
    const warnings = [];
    const errors = [];

    packagesWithScripts
        .forEach((entry) => {

            const { path, childPkg } = entry;
            const name = entry.childPkg.name;

            if (allowScripts[name] === undefined) {
                errors.push(`${name} (no entry)`);
                return;
            }

            if (allowScripts[name] === false) {
                warnings.push(`==========> skip ${path} (because it is not allowed in package.json)`);
                return;
            }

            if (allowScripts[name] === true) {
                allowedPackages.push(entry);
                return;
            }

            if (!Semver.validRange(allowScripts[name])) {
                errors.push(`${name} (invalid semver range: ${allowScripts[name]})`);
                return;
            }

            if (!Semver.satisfies(entry.childPkg.version, allowScripts[name])) {
                warnings.push(`==========> skip ${path} (because ${childPkg.version} is outside of allowed range: ${allowScripts[name]})`);
                return;
            }

            allowedPackages.push(entry);
        });

    Assert.strictEqual(packagesWithScripts.length, errors.length + warnings.length + allowedPackages.length, 'Package count does not match. Please raise an issue at https://github.com/dominykas/allow-scripts');

    if (errors.length) {
        throw new Error(`Mis-configured allowedScripts: ${errors.join(', ')}`);
    }

    if (warnings.length) {
        console.warn(warnings.join('\n'));
    }

    await internals.runScript('preinstall', { pkg, path: '', cwd, unsafePerm: true }, options);

    for (const { path, childPkg } of allowedPackages) {
        await internals.runScript('preinstall', { pkg: childPkg, path, cwd }, options);
    }

    for (const { path, childPkg } of allowedPackages) {
        await internals.runScript('install', { pkg: childPkg, path, cwd }, options);
    }

    for (const { path, childPkg } of allowedPackages) {
        await internals.runScript('postinstall', { pkg: childPkg, path, cwd }, options);
    }

    await internals.runScript('install', { pkg, path: '', cwd, unsafePerm: true }, options);
    await internals.runScript('postinstall', { pkg, path: '', cwd, unsafePerm: true }, options);
    await internals.runScript('prepublish', { pkg, path: '', cwd, unsafePerm: true }, options);
    await internals.runScript('prepare', { pkg, path: '', cwd, unsafePerm: true }, options);
};
