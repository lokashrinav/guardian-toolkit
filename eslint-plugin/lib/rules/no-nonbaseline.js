const axios = require('axios');

// Cache for API responses to avoid repeated requests
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Web features that commonly appear in code
const WEB_FEATURES = {
  // Array methods
  'at': 'array-at',
  // String methods  
  'replaceAll': 'string-replaceall',
  // Promise methods
  'allSettled': 'promise-allsettled',
  // DOM APIs
  'AbortController': 'abortcontroller',
  'ResizeObserver': 'resize-observer',
  // Navigator APIs
  'clipboard': 'clipboard',
  'writeText': 'clipboard',
  // CSS features in JS strings
  ':has(': 'has-selector'
};

async function checkFeature(feature, apiEndpoint = 'http://localhost:3000') {
  const cacheKey = feature;
  
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  try {
    const response = await axios.post(`${apiEndpoint}/isSafe`, 
      { feature }, 
      { timeout: 3000 }
    );
    
    const result = response.data;
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    // If API is down, assume feature is safe to avoid false positives
    return { found: false, safety: 'unknown', isSafe: true };
  }
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow use of non-baseline web features',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: 'object',
        properties: {
          apiEndpoint: {
            type: 'string',
            default: 'http://localhost:3000'
          },
          severity: {
            type: 'string',
            enum: ['unsafe', 'caution', 'all'],
            default: 'unsafe'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      nonBaseline: '{{feature}} is not baseline-safe ({{safety}}): {{reason}}',
      apiError: 'Could not check baseline safety for {{feature}}: API unavailable'
    }
  },

  create(context) {
    const options = context.options[0] || {};
    const apiEndpoint = options.apiEndpoint || 'http://localhost:3000';
    const severity = options.severity || 'unsafe';
    
    const sourceCode = context.getSourceCode();
    const pendingChecks = new Map();

    function shouldReport(safety) {
      if (severity === 'all') return true;
      if (severity === 'caution') return safety === 'unsafe' || safety === 'caution';
      return safety === 'unsafe';
    }

    async function checkAndReport(node, feature, detectedFeature) {
      if (pendingChecks.has(feature)) {
        return;
      }
      
      pendingChecks.set(feature, true);
      
      try {
        const result = await checkFeature(detectedFeature, apiEndpoint);
        
        if (result.found && result.safety && shouldReport(result.safety)) {
          context.report({
            node,
            messageId: 'nonBaseline',
            data: {
              feature: feature,
              safety: result.safety,
              reason: result.recommendation || 'May not be supported in older browsers'
            }
          });
        }
      } catch (error) {
        // Silently fail - don't spam with API errors
      } finally {
        pendingChecks.delete(feature);
      }
    }

    return {
      // Check member expressions (e.g., array.at(), string.replaceAll())
      MemberExpression(node) {
        const propertyName = node.property.name;
        if (WEB_FEATURES[propertyName]) {
          checkAndReport(node, propertyName, WEB_FEATURES[propertyName]);
        }
      },

      // Check function calls (e.g., Promise.allSettled())
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression') {
          const objectName = node.callee.object.name;
          const propertyName = node.callee.property.name;
          
          // Promise.allSettled()
          if (objectName === 'Promise' && propertyName === 'allSettled') {
            checkAndReport(node, 'Promise.allSettled', 'promise-allsettled');
          }
          
          // navigator.clipboard.writeText()
          if (objectName === 'navigator' && propertyName === 'clipboard') {
            checkAndReport(node, 'navigator.clipboard', 'clipboard');
          }
          if (node.callee.object.type === 'MemberExpression' && 
              node.callee.object.property.name === 'clipboard' &&
              propertyName === 'writeText') {
            checkAndReport(node, 'clipboard.writeText', 'clipboard');
          }
        }
      },

      // Check new expressions (e.g., new AbortController(), new ResizeObserver())
      NewExpression(node) {
        const constructorName = node.callee.name;
        if (WEB_FEATURES[constructorName]) {
          checkAndReport(node, constructorName, WEB_FEATURES[constructorName]);
        }
      },

      // Check CSS :has() selector in template literals and strings
      TemplateLiteral(node) {
        const code = sourceCode.getText(node);
        if (code.includes(':has(')) {
          checkAndReport(node, 'CSS :has() selector', 'has-selector');
        }
      },

      Literal(node) {
        if (typeof node.value === 'string' && node.value.includes(':has(')) {
          checkAndReport(node, 'CSS :has() selector', 'has-selector');
        }
      }
    };
  }
};