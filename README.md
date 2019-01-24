# allow-scripts

In `package.json`:
```
  "allowScripts": {
    "install": {
      "fsevents": "*",
      "node-sass": "*"
    }
  }
```

Then:
```
$ npm install --ignore-scripts
$ npx allow-scripts
```
