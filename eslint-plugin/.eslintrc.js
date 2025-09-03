module.exports = {
  "env": {
    "node": true,
    "es2021": true
  },
  "plugins": ["baseline"],
  "rules": {
    "baseline/no-nonbaseline": ["warn", {
      "apiEndpoint": "http://localhost:3000",
      "severity": "unsafe"
    }]
  }
};