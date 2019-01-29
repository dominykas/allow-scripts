#!/usr/bin/env node

'use strict';

const Allow = require('..');

Allow.run().catch((err) => {

    console.error(err);
    process.exit(1);
});
