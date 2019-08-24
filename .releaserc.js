module.exports = {
    npmPublish: true,
    tarballDir: '.',
    assets: 'allow-scripts-*.tgz',
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/npm',
        '@semantic-release/github'
    ]
};
