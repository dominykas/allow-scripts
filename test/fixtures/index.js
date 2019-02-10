'use strict';


const Fs = require('fs');
const Mkdirp = require('mkdirp');
const Path = require('path');
const Rimraf = require('rimraf');


const internals = {
    restore: []
};


exports.setup = (main, deps) => {

    const cwd = Path.join(__dirname, '..', 'tmp');
    const output = Path.join(cwd, 'res.txt');

    Rimraf.sync(cwd);
    Mkdirp.sync(cwd);
    Fs.copyFileSync(Path.join(__dirname, `${main}.json`), Path.join(cwd, 'package.json'));
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

    return {
        expectedResult: Fs.readFileSync(Path.join(__dirname, `${main}.txt`)).toString().trim(),
        getResults: () => {

            return Fs.readFileSync(output).toString().trim();
        },

        getLog: () => {

            return console.log.args.map((args) => args[0] || '').join('\n').replace(new RegExp(cwd, 'g'), '.').trim();
        }
    };
};

exports.restore = () => {

    internals.restore.forEach((restore) => restore());
    internals.restore = [];
};
