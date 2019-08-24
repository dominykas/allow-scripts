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
                prepareCmd: `echo otp=$(curl -s $NPM_OTP_URL) >>${process.env.NPM_CONFIG_USERCONFIG || '.npmrc'}`
            }
        ],
        '@semantic-release/github'
    ]
};
