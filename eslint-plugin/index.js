module.exports = {
  rules: {
    'no-nonbaseline': require('./lib/rules/no-nonbaseline')
  },
  configs: {
    recommended: {
      rules: {
        'baseline/no-nonbaseline': 'warn'
      }
    },
    strict: {
      rules: {
        'baseline/no-nonbaseline': 'error'
      }
    }
  }
};