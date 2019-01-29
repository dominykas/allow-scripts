'use strict';

const Cp = require('child_process');
const Fs = require('fs');
const Npm = require('libnpm');
const Path = require('path');
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

internals.runScript = (stage, { pkg, path, cwd, unsafePerm }) => {

    console.log();
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

exports.run = async (cmd = 'install') => {

    const cwd = process.cwd();
    const pkg = require(Path.join(cwd, 'package.json'));

    pkg._id = `${pkg.name}@${pkg.version}`; // @todo: find an official way to do this for top level package

    const tree = Npm.logicalTree(pkg, internals.getLockFile(cwd));
    const queue = internals.queue(tree);

    const allowScripts = pkg.allowScripts || {};

    const allowedScripts = queue
        .map((path) => {

            const childPkg = require(Path.join(cwd, path, 'package.json'));

            return { path, childPkg };
        })
        .filter(({ childPkg }) => {

            return childPkg.scripts && (childPkg.scripts[cmd] || childPkg.scripts[`pre${cmd}`] || childPkg.scripts[`post${childPkg}`]);
        })
        .filter(({ path, childPkg }) => {

            const name = childPkg.name;

            if (allowScripts[name] === undefined) {
                throw new Error(`No entry for ${name}`);
            }

            if (!allowScripts[name]) {
                console.warn(`==========> skip ${path} (because it is not allowed in package.json)`);
            }

            return allowScripts[name];
        });

    await internals.runScript('preinstall', { pkg, path: '', cwd, unsafePerm: true });

    for (const { path, childPkg } of allowedScripts) {
        await internals.runScript('preinstall', { pkg: childPkg, path, cwd });
    }

    for (const { path, childPkg } of allowedScripts) {
        await internals.runScript('install', { pkg: childPkg, path, cwd });
    }

    for (const { path, childPkg } of allowedScripts) {
        await internals.runScript('postinstall', { pkg: childPkg, path, cwd });
    }

    await internals.runScript('install', { pkg, path: '', cwd, unsafePerm: true });
    await internals.runScript('postinstall', { pkg, path: '', cwd, unsafePerm: true });
    await internals.runScript('prepublish', { pkg, path: '', cwd, unsafePerm: true });
    await internals.runScript('prepare', { pkg, path: '', cwd, unsafePerm: true });
};
