#!/usr/bin/env node

'use strict';

const Ansicolors = require('ansicolors');

const Allow = require('..');

const options = {
    dryRun: process.argv.includes('--dry-run')
};

Allow.run(options).catch((err) => {

    let log = err;
    if (err.stack) {

        const [message, ...rest] = err.stack.split('\n');
        log = `${Ansicolors.red(message)}\n${rest.join('\n')}`;
    }

    console.error(`\n\n${log}`);
    process.exit(1);
});
