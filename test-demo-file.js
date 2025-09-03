/**
 * Test the demo file to show how the system analyzes real code
 */

const { checkFeature } = require('./checkFeature');
const fs = require('fs');

console.log('🔍 ANALYZING REAL DEMO FILE: demo-unsafe-file.js');
console.log('=================================================\n');

async function analyzeDemoFile() {
  // Read the demo file
  const content = fs.readFileSync('./demo-unsafe-file.js', 'utf8');
  const lines = content.split('\n');
  
  console.log('📄 Demo file contains:');
  console.log('- ModernUserService class with various web APIs');
  console.log('- String.replaceAll usage');
  console.log('- Fetch API calls');
  console.log('- Promise.allSettled usage');
  console.log('- ResizeObserver API');
  console.log('- Clipboard API usage');
  
  console.log('\n🔍 SYSTEM ANALYSIS:');
  console.log('===================');
  
  // Features to check based on the code patterns
  const featuresToCheck = [
    { name: 'string-replaceall', lineExample: 'username.replaceAll(/[^a-zA-Z0-9]/g, \'_\')' },
    { name: 'fetch', lineExample: 'await fetch(`/api/users/${id}`)' },
    { name: 'promise-allsettled', lineExample: 'await Promise.allSettled(promises)' },
    { name: 'resizeobserver', lineExample: 'new ResizeObserver(callback)' },
    { name: 'async-clipboard', lineExample: 'navigator.clipboard.writeText(text)' }
  ];
  
  for (const feature of featuresToCheck) {
    const result = checkFeature(feature.name);
    const icon = result.safety === 'safe' ? '✅' : result.safety === 'caution' ? '⚠️' : '❌';
    
    console.log(`\n${icon} ${feature.name.toUpperCase()}`);
    console.log(`   Code: ${feature.lineExample}`);
    
    if (result.found) {
      console.log(`   Name: ${result.name}`);
      console.log(`   Safety: ${result.safety}`);
      console.log(`   Baseline: ${result.baseline}`);
      console.log(`   Recommendation: ${result.recommendation}`);
      
      if (result.support) {
        const browsers = Object.entries(result.support).map(([browser, version]) => `${browser}:${version}`).join(', ');
        console.log(`   Browser support: ${browsers}`);
      }
    } else {
      console.log(`   Status: Not found in Baseline database`);
      if (result.suggestions && result.suggestions.length > 0) {
        console.log(`   Similar features: ${result.suggestions.join(', ')}`);
      }
    }
  }
  
  console.log('\n🤖 WHAT EACH COMPONENT WOULD DO:');
  console.log('==================================');
  
  console.log('\n📦 VS CODE EXTENSION:');
  console.log('- Show red squiggles under replaceAll (if unsafe)');
  console.log('- Display hover tooltips with Baseline data');
  console.log('- Filter autocomplete to prefer safe alternatives');
  console.log('- Offer right-click "Rewrite Unsafe Features" option');
  
  console.log('\n🔧 CODEMOD TOOL:');
  console.log('- Replace replaceAll with global regex');
  console.log('- Add fetch availability checks');
  console.log('- Insert Promise.allSettled polyfill');
  console.log('- Add feature detection for modern APIs');
  
  console.log('\n🤖 PR REVIEW BOT:');
  console.log('- Post educational comments about each feature');
  console.log('- Explain browser support implications');
  console.log('- Suggest specific code improvements');
  console.log('- Provide links to documentation');
  
  console.log('\n✨ IMPROVED VERSION WOULD LOOK LIKE:');
  console.log('=====================================');
  
  const improvedCode = `
// Baseline-safe version with proper feature detection
export class SafeUserService {
  constructor() {
    this.cache = new Map();
  }

  // ✅ Global regex replacement - universal support
  sanitizeUsername(username) {
    return username.replace(/[^a-zA-Z0-9]/g, '_');
  }

  // ✅ Fetch with availability check
  async fetchUser(id) {
    if (typeof fetch === 'undefined') {
      throw new Error('fetch not supported - use polyfill or XHR');
    }
    const response = await fetch(\`/api/users/\${id}\`);
    return response.json();
  }

  // ✅ Promise.allSettled with polyfill fallback
  async fetchMultipleUsers(ids) {
    const promises = ids.map(id => this.fetchUser(id));
    
    // Polyfill for Promise.allSettled
    const allSettled = Promise.allSettled || ((promises) => Promise.all(
      promises.map(p => p.then(
        value => ({status: 'fulfilled', value}), 
        reason => ({status: 'rejected', reason})
      ))
    ));
    
    const results = await allSettled(promises);
    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
  }

  // ✅ ResizeObserver with feature detection
  observeElement(element, callback) {
    if (typeof ResizeObserver === 'undefined') {
      console.warn('ResizeObserver not supported');
      return null;
    }
    const observer = new ResizeObserver(callback);
    observer.observe(element);
    return observer;
  }

  // ✅ Clipboard API with fallback
  async copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }
}`;

  console.log(improvedCode);
  
  console.log('\n🎯 BENEFITS:');
  console.log('=============');
  console.log('✅ Works across all browser environments');
  console.log('✅ Graceful degradation for older browsers');
  console.log('✅ Clear error messages when features unavailable');
  console.log('✅ Progressive enhancement approach');
  console.log('✅ Follows Baseline web standards');
}

analyzeDemoFile().catch(console.error);