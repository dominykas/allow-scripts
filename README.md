# allow-scripts

Execute allowed `npm install` lifecycle scripts. 

## Usage

Run your `npm install` with `--ignore-scripts` (or add `ignore-scripts=true` in your `.npmrc`), then:

```
$ npx allow-scripts [--dry-run]
```

Running the command will scan the list of installed dependencies (from the first source available: `npm-shrinkwrap.json`, `package-lock.json`, `npm ls --json`). It will then execute the scripts for allowed dependencies that have them in the following order:

- `preinstall` in the main package
- `preinstall` in dependencies
- `install` in dependencies
- `postinstall` in dependencies
- `install` in the main package
- `postinstall` in the main package
- `prepublish` in the main package
- `prepare` in the main package

Allowed package list is configurable in `package.json` by adding an `allowedScripts` property, with an object where the key is a package name and the value is one of:

* a string with a semver specifier for allowed versions
  - non-matching versions will be ignored
* `true` - allow all versions (equivalent to `'*'` semver specifier)
* `false` - ignore all versions

If a package has a lifecycle script, but is neither allowed nor ignored, `allow-scripts` will exit with an error.

Example for `package.json`:
```
  "allowScripts": {
    "fsevents": "*",        # allow install scripts in all versions
    "node-sass": false,     # ignore install scripts for all versions
    "webpack-cli": "3.x.x"  # allow all minors for v3, ignore everything else
  }
```
