# allow-scripts

In `package.json`:
```
  "allowScripts": {
    "fsevents": "*", # allow install scripts in all versions
    "node-sass": false # ignore install scripts
  }
```

Then:
```
$ npm install --ignore-scripts
$ npx allow-scripts
```
