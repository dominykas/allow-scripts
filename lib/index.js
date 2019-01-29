'use strict';

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

    console.log();

    if (options.dryRun) {
        console.log(`DRY RUN ==> ${stage} ${path || pkg.name}...`);
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

    let output;
    try {
        output = Cp.execSync('npm ls --json', { cwd });
    }
    catch (err) {
        output = err.output[1]; // npm will exist with an error when e.g. there's peer deps missing - attempt to ignore that
    }

    try {
        return JSON.parse(output.toString());
    }
    catch (err) {
        console.error(err);
        throw new Error('Failed to read the contents of node_modules');
    }
};

exports.run = async (options) => {

    const cwd = process.cwd();
    const pkg = require(Path.join(cwd, 'package.json'));

    pkg._id = `${pkg.name}@${pkg.version}`; // @todo: find an official way to do this for top level package

    const tree = Npm.logicalTree(pkg, internals.getLockFile(cwd));
    const queue = internals.queue(tree);

    const allowScripts = pkg.allowScripts || {};

    const allowedPackages = queue
        .map((path) => {

            const childPkg = require(Path.join(cwd, path, 'package.json'));

            return { path, childPkg };
        })
        .filter(({ childPkg }) => {

            return childPkg.scripts && (childPkg.scripts.install || childPkg.scripts.preinstall || childPkg.scripts.postinstall);
        })
        .filter(({ path, childPkg }) => {

            const name = childPkg.name;

            if (allowScripts[name] === undefined) {
                throw new Error(`No entry for ${name}`);
            }

            if (allowScripts[name] === false) {
                console.warn(`==========> skip ${path} (because it is not allowed in package.json)`);
            }

            if (allowScripts[name] === true) {
                return true;
            }

            if (!Semver.validRange(allowScripts[name])) {
                throw new Error(`Invalid version range in allowScripts[${name}]: ${allowScripts[name]}`);
            }

            if (!Semver.satisfies(childPkg.version, allowScripts[name])) {
                console.warn(`==========> skip ${path} (because ${childPkg.version} is outside of allowed range: ${allowScripts[name]})`);
                return false;
            }

            return true;
        });

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
