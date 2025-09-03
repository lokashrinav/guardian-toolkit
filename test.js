const { checkFeature } = require('./checkFeature');

console.log('🧪 Testing Baseline Web Features AI Layer Foundation\n');

// Test cases
const testFeatures = [
    'flexbox',
    'grid',
    'fetch',
    'css-variables',
    'nonexistent-feature'
];

console.log('Testing checkFeature function:');
console.log('=====================================');

testFeatures.forEach((feature, index) => {
    console.log(`\n${index + 1}. Testing: "${feature}"`);
    const result = checkFeature(feature);
    
    if (result.found) {
        console.log(`   ✅ Found: ${result.name}`);
        console.log(`   🔒 Safety: ${result.safety}`);
        console.log(`   📊 Baseline: ${result.baseline}`);
        console.log(`   💡 ${result.recommendation}`);
        if (result.support) {
            console.log(`   🌐 Browser support:`, Object.entries(result.support).map(([browser, version]) => `${browser}:${version}`).join(', '));
        }
    } else {
        console.log(`   ❌ Not found: ${result.message}`);
        if (result.suggestions && result.suggestions.length > 0) {
            console.log(`   💭 Suggestions: ${result.suggestions.join(', ')}`);
        }
    }
});

console.log('\n\n🧪 Testing REST API simulation:');
console.log('================================');

// Simulate API calls
function simulateAPICall(feature) {
    const result = checkFeature(feature);
    return {
        query: feature,
        timestamp: new Date().toISOString(),
        isSafe: result.safety === 'safe',
        canUse: result.safety !== 'unsafe',
        ...result
    };
}

const apiTestFeatures = ['flexbox', 'container-queries'];
apiTestFeatures.forEach((feature, index) => {
    console.log(`\n${index + 1}. API test for: "${feature}"`);
    const apiResult = simulateAPICall(feature);
    console.log('   📡 API Response:', JSON.stringify(apiResult, null, 4));
});

console.log('\n✨ All tests completed!');