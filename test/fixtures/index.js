'use strict';


const Fs = require('fs');
const Mkdirp = require('mkdirp');
const Path = require('path');
const Rimraf = require('rimraf');
const Sinon = require('sinon');


const internals = {
    restore: []
};


exports.setup = (main, deps) => {

    const cwd = Path.join(__dirname, '..', 'tmp');
    const output = Path.join(cwd, 'res.txt');

    Rimraf.sync(cwd);
    Mkdirp.sync(cwd);
    Fs.copyFileSync(Path.join(__dirname, `${main}.json`), Path.join(cwd, 'package.json'));
    Fs.writeFileSync(Path.join(cwd, 'res.txt'), '');
    delete require.cache[Path.join(cwd, 'package.json')];

    deps.forEach((dep) => {

        const pkg = require(`./${dep}.json`);

        Mkdirp.sync(Path.join(cwd, 'node_modules', pkg.name));
        Fs.writeFileSync(Path.join(cwd, 'node_modules', pkg.name, 'package.json'), JSON.stringify(Object.assign({}, pkg, {
            _id: `${pkg.name}@${pkg.version}`
        })));
    });

    process.chdir(cwd);

    const originalOutput = process.env.output;
    process.env.OUTPUT = output;

    internals.restore.push(() => {

        process.env.OUTPUT = originalOutput;
    });

    const log = [];
    const appendLog = (...items) => {

        log.push(items.map((i) => i || '').join(' ').replace(new RegExp(cwd, 'g'), '.'));
    };

    Sinon.stub(console, 'info').callsFake(appendLog);
    Sinon.stub(console, 'log').callsFake(appendLog);
    Sinon.stub(console, 'warn').callsFake(appendLog);
    Sinon.stub(process.stderr, 'write').callsFake((data) => appendLog(data.toString()));

    return {
        getActualResult: () => {

            return Fs.readFileSync(output).toString().trim();
        },

        getLog: () => {

            return log.join('\n').trim();
        }
    };
};

exports.restore = () => {

    internals.restore.forEach((restore) => restore());
    internals.restore = [];
    Sinon.restore();
};
