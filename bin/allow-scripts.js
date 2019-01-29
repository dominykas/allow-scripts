#!/usr/bin/env node

'use strict';

const Allow = require('..');

const options = {
    dryRun: process.argv.includes('--dry-run')
};

Allow.run(options).catch((err) => {

    console.error(err);
    process.exit(1);
});
