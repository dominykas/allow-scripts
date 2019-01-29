# allow-scripts

In `package.json`:
```
  "allowScripts": {
    "fsevents": "*",
    "node-sass": "*"
  }
```

Then:
```
$ npm install --ignore-scripts
$ npx allow-scripts
```
