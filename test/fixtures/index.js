'use strict';


const Fs = require('fs');
const Mkdirp = require('mkdirp');
const Path = require('path');
const Rimraf = require('rimraf');
const Sinon = require('sinon');


const internals = {
    restore: []
};


internals.readFile = (path) => Fs.readFileSync(path).toString().trim();


exports.expectedResults = {
    basicFull: internals.readFile(Path.join(__dirname, 'basic.full.txt')),
    basicDryRun: internals.readFile(Path.join(__dirname, 'basic.dry-run.txt')),
    deep: internals.readFile(Path.join(__dirname, 'deep.txt')),
    withCycles: internals.readFile(Path.join(__dirname, 'with-cycles.txt'))
};


exports.setup = (main, deps) => {

    const cwd = Path.join(__dirname, '..', 'tmp');
    const output = Path.join(cwd, 'res.txt');

    Rimraf.sync(cwd);
    Mkdirp.sync(cwd);
    Fs.copyFileSync(Path.join(__dirname, `${main}.json`), Path.join(cwd, 'package.json'));
    Fs.writeFileSync(Path.join(cwd, 'res.txt'), '');

    deps.forEach((dep) => {

        const pkg = require(`./${dep}.json`);

        Mkdirp.sync(Path.join(cwd, 'node_modules', pkg.name));
        const pkgJsonPath = Path.join(cwd, 'node_modules', pkg.name, 'package.json');
        Fs.writeFileSync(pkgJsonPath, JSON.stringify(Object.assign({}, pkg, {
            _id: `${pkg.name}@${pkg.version}`
        })));
    });

    process.chdir(cwd);

    const originalOutput = process.env.output;
    process.env.OUTPUT = output;

    internals.restore.push(() => {

        process.env.OUTPUT = originalOutput;
        Object.keys(require.cache).forEach((k) => {

            if (k.startsWith(cwd)) {
                delete require.cache[k];
            }
        });
    });

    const log = [];
    const appendLog = (...items) => {

        // @todo: should suppress this in production code
        if (items[0] === 'npm notice created a lockfile as npm-shrinkwrap.json. You should commit this file.\n') {
            return;
        }

        log.push(items.map((i) => i || '').join(' ').replace(new RegExp(cwd, 'g'), '.'));
    };

    Sinon.stub(console, 'info').callsFake(appendLog);
    Sinon.stub(console, 'log').callsFake(appendLog);
    Sinon.stub(console, 'warn').callsFake(appendLog);
    Sinon.stub(process.stderr, 'write').callsFake((data) => appendLog(data.toString()));

    return {
        cwd,
        getActualResult: () => internals.readFile(output),
        getLog: () => log.join('\n').trim()
    };
};

exports.restore = () => {

    internals.restore.forEach((restore) => restore());
    internals.restore = [];
    Sinon.restore();
};
