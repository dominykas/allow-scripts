'use strict';

const path = require('path');

const npmrcPath = process.env.NPM_CONFIG_USERCONFIG || path.resolve(process.cwd, '.npmrc');

module.exports = {
    npmPublish: true,
    tarballDir: '.',
    assets: 'allow-scripts-*.tgz',
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/npm',
        [
            '@semantic-release/exec',
            {
                prepareCmd: `echo -e "\notp=$(curl -s $NPM_OTP_URL)" >>${npmrcPath}`
            }
        ],
        '@semantic-release/github'
    ]
};
