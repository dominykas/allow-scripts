'use strict';

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

exports.run = (cmd = 'install') => {

    const cwd = process.cwd();
    const pkg = require(Path.join(cwd, 'package.json'));
    const shrinkwrap = require(Path.join(cwd, 'npm-shrinkwrap.json'));

    const tree = Npm.logicalTree(pkg, shrinkwrap);
    const queue = internals.queue(tree);

    const allowed = pkg.allowScripts || {};

    queue
        .map((path) => {

            const childPkg = require(Path.join(cwd, path, 'package.json'));

            return [path, childPkg];
        })
        .filter(([,childPkg]) => {

            return childPkg.scripts && (childPkg.scripts[cmd] || childPkg.scripts[`pre${cmd}`] || childPkg.scripts[`post${childPkg}`]);
        })
        .filter(([path, childPkg]) => {

            const name = childPkg.name;

            if (allowed[name] === undefined) {
                throw new Error(`No entry for ${name}`);
            }

            if (!allowed[name]) {
                console.warn(`==========> skip ${path} (because it is not allowed in package.json)`);
            }

            return allowed[name];
        })
        .forEach(([path, childPkg]) => {

            console.log(`==========> install ${path}...`);

            Npm.runScript(childPkg, 'install', Path.join(cwd, path), {
                dir: cwd,
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

            console.log(`==========> postinstall ${path}...`);

            Npm.runScript(childPkg, 'postinstall', Path.join(cwd, path), {
                dir: cwd,
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
        });
};
