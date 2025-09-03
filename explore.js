const webFeatures = require('web-features');

// Explore the structure
console.log('Top level keys:', Object.keys(webFeatures));
console.log('\nFeatures keys:', Object.keys(webFeatures.features).slice(0, 10));
console.log('\nSample feature:', JSON.stringify(webFeatures.features[Object.keys(webFeatures.features)[0]], null, 2));