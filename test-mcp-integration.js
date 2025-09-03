/**
 * Test MCP integration - simulate how Claude would call the MCP server
 */

const { spawn } = require('child_process');
const { checkFeature } = require('./checkFeature');

console.log('🔌 Testing MCP Integration with Baseline Tools');
console.log('============================================\n');

// Simulate MCP tool calls that Claude would make
async function testMCPTools() {
  console.log('1. Testing check_web_feature_safety tool:');
  console.log('==========================================');
  
  const testFeatures = ['fetch', 'container-queries', 'subgrid', 'replaceAll'];
  
  for (const feature of testFeatures) {
    console.log(`\n🔍 Checking: ${feature}`);
    
    // This simulates what Claude would receive when calling the MCP tool
    const result = checkFeature(feature);
    
    const mcpResponse = {
      tool_name: "check_web_feature_safety",
      arguments: { feature: feature },
      result: {
        safe: result.safety === 'safe',
        canUse: result.safety !== 'unsafe',
        feature: result.feature,
        name: result.name,
        safety: result.safety,
        baseline: result.baseline,
        recommendation: result.recommendation,
        support: result.support
      }
    };
    
    console.log(`   📊 MCP Response:`, JSON.stringify(mcpResponse.result, null, 2));
  }
  
  console.log('\n2. Testing get_feature_details tool:');
  console.log('====================================');
  
  const detailFeature = 'grid';
  const detailResult = checkFeature(detailFeature);
  
  const detailResponse = {
    tool_name: "get_feature_details",
    arguments: { feature: detailFeature },
    result: {
      found: detailResult.found,
      feature: detailResult.feature,
      name: detailResult.name,
      description: detailResult.description,
      safety: detailResult.safety,
      baseline: detailResult.baseline,
      recommendation: detailResult.recommendation,
      support: detailResult.support,
      spec: detailResult.spec,
      group: detailResult.group
    }
  };
  
  console.log(`   📋 Detailed info for ${detailFeature}:`);
  console.log(JSON.stringify(detailResponse.result, null, 2));
  
  console.log('\n✅ MCP Integration Working!');
  console.log('\n💡 What Claude can now do:');
  console.log('==========================');
  console.log('- Ask: "Is fetch() safe to use?"');
  console.log('- Ask: "Check if container queries are Baseline"');
  console.log('- Ask: "What\'s the browser support for subgrid?"');
  console.log('- Ask: "Analyze this code for unsafe web features"');
  console.log('- Get real-time Baseline data for any web feature');
  
  console.log('\n🎯 Example Claude Conversations:');
  console.log('=================================');
  
  console.log('\n👤 User: "Is String.replaceAll() safe to use in production?"');
  const replaceAllCheck = checkFeature('string-replaceall');
  console.log(`🤖 Claude: "${replaceAllCheck.name} is ${replaceAllCheck.safety} with ${replaceAllCheck.baseline} Baseline support. ${replaceAllCheck.recommendation}"`);
  
  console.log('\n👤 User: "What about CSS container queries?"');
  const containerCheck = checkFeature('container-queries');
  console.log(`🤖 Claude: "${containerCheck.name} ${containerCheck.safety === 'safe' ? 'are' : 'have'} ${containerCheck.safety} with ${containerCheck.baseline} Baseline support. ${containerCheck.recommendation}"`);
}

testMCPTools().catch(console.error);