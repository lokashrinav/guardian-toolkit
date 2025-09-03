/**
 * Baseline Feature-Gate CDN Worker
 * Provides runtime feature gating based on user agent and baseline compatibility
 */

// Feature compatibility data (in production, this would be fetched from a KV store or API)
const FEATURE_COMPATIBILITY = {
  'Array.prototype.at': {
    chrome: '92',
    firefox: '90', 
    safari: '15.4',
    edge: '92'
  },
  'String.prototype.replaceAll': {
    chrome: '85',
    firefox: '77',
    safari: '13.1',
    edge: '85'
  },
  'Promise.allSettled': {
    chrome: '76',
    firefox: '71',
    safari: '13',
    edge: '79'
  },
  'ResizeObserver': {
    chrome: '64',
    firefox: '69',
    safari: '13.1',
    edge: '79'
  },
  'IntersectionObserver': {
    chrome: '51',
    firefox: '55',
    safari: '12.1',
    edge: '15'
  },
  'AbortController': {
    chrome: '66',
    firefox: '57',
    safari: '12.1',
    edge: '16'
  },
  'CSS.has': {
    chrome: '105',
    firefox: '121',
    safari: '15.4',
    edge: '105'
  },
  'navigator.clipboard.writeText': {
    chrome: '66',
    firefox: '63',
    safari: '13.1',
    edge: '79'
  }
};

// Polyfill and fallback URLs (CDN links)
const POLYFILLS = {
  'Array.prototype.at': 'https://polyfill.io/v3/polyfill.min.js?features=Array.prototype.at',
  'String.prototype.replaceAll': 'https://polyfill.io/v3/polyfill.min.js?features=String.prototype.replaceAll',
  'Promise.allSettled': 'https://polyfill.io/v3/polyfill.min.js?features=Promise.allSettled',
  'ResizeObserver': 'https://cdn.jsdelivr.net/npm/resize-observer-polyfill@1.5.1/dist/ResizeObserver.min.js',
  'IntersectionObserver': 'https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver',
  'AbortController': 'https://polyfill.io/v3/polyfill.min.js?features=AbortController',
  'navigator.clipboard': 'https://cdn.jsdelivr.net/npm/clipboard-polyfill@4.0.1/dist/clipboard-polyfill.min.js'
};

class UserAgentParser {
  constructor(userAgent) {
    this.userAgent = userAgent;
    this.parsed = this.parse();
  }
  
  parse() {
    const ua = this.userAgent.toLowerCase();
    
    // Chrome detection (including Edge Chromium)
    if (ua.includes('chrome') && !ua.includes('edg')) {
      const match = ua.match(/chrome\/(\d+)/);
      return {
        browser: 'chrome',
        version: match ? parseInt(match[1]) : 0
      };
    }
    
    // Edge detection (new Chromium-based)
    if (ua.includes('edg')) {
      const match = ua.match(/edg\/(\d+)/);
      return {
        browser: 'edge',
        version: match ? parseInt(match[1]) : 0
      };
    }
    
    // Firefox detection
    if (ua.includes('firefox')) {
      const match = ua.match(/firefox\/(\d+)/);
      return {
        browser: 'firefox',
        version: match ? parseInt(match[1]) : 0
      };
    }
    
    // Safari detection
    if (ua.includes('safari') && !ua.includes('chrome')) {
      const match = ua.match(/version\/(\d+)/);
      return {
        browser: 'safari',
        version: match ? parseInt(match[1]) : 0
      };
    }
    
    return {
      browser: 'unknown',
      version: 0
    };
  }
  
  getBrowser() {
    return this.parsed.browser;
  }
  
  getVersion() {
    return this.parsed.version;
  }
}

class FeatureGate {
  constructor() {
    this.compatibilityData = FEATURE_COMPATIBILITY;
    this.polyfills = POLYFILLS;
  }
  
  isFeatureSupported(feature, userAgent) {
    const parser = new UserAgentParser(userAgent);
    const browser = parser.getBrowser();
    const version = parser.getVersion();
    
    const featureCompat = this.compatibilityData[feature];
    if (!featureCompat) {
      return { supported: 'unknown', reason: 'Feature not in database' };
    }
    
    const requiredVersion = featureCompat[browser];
    if (!requiredVersion) {
      return { supported: false, reason: `No compatibility data for ${browser}` };
    }
    
    const supported = version >= parseInt(requiredVersion);
    
    return {
      supported,
      reason: supported 
        ? `${browser} ${version} supports this feature` 
        : `${browser} ${version} requires version ${requiredVersion} or higher`,
      polyfill: this.polyfills[feature] || null
    };
  }
  
  generateFeatureScript(features, userAgent) {
    const results = {};
    const polyfillUrls = new Set();
    
    for (const feature of features) {
      const support = this.isFeatureSupported(feature, userAgent);
      results[feature] = support;
      
      if (!support.supported && support.polyfill) {
        polyfillUrls.add(support.polyfill);
      }
    }
    
    const polyfillScript = Array.from(polyfillUrls).map(url => 
      `document.createElement('script').src = '${url}'; document.head.appendChild(script);`
    ).join('\\n');
    
    return {
      features: results,
      polyfills: Array.from(polyfillUrls),
      script: `
        window.BaselineFeatureGate = ${JSON.stringify(results)};
        
        // Load required polyfills
        ${polyfillScript}
        
        // Feature detection helpers
        window.isFeatureSupported = function(feature) {
          return window.BaselineFeatureGate[feature]?.supported || false;
        };
        
        window.requireFeature = function(feature, callback) {
          if (window.isFeatureSupported(feature)) {
            callback();
          } else {
            console.warn('Feature not supported:', feature);
          }
        };
        
        console.log('Baseline Feature Gate initialized:', Object.keys(window.BaselineFeatureGate));
      `
    };
  }
}

// Main Cloudflare Worker handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('User-Agent') || '';
    
    // Add CORS headers for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    
    const featureGate = new FeatureGate();
    
    try {
      // Route: Get feature gate script
      if (url.pathname === '/gate.js') {
        const features = url.searchParams.get('features')?.split(',') || [];
        
        if (features.length === 0) {
          return new Response('/* No features specified */', {
            headers: {
              'Content-Type': 'application/javascript',
              'Cache-Control': 'public, max-age=300',
              ...corsHeaders
            }
          });
        }
        
        const result = featureGate.generateFeatureScript(features, userAgent);
        
        return new Response(result.script, {
          headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
            ...corsHeaders
          }
        });
      }
      
      // Route: Check single feature support
      if (url.pathname === '/check') {
        const feature = url.searchParams.get('feature');
        
        if (!feature) {
          return Response.json(
            { error: 'Missing feature parameter' },
            { status: 400, headers: corsHeaders }
          );
        }
        
        const support = featureGate.isFeatureSupported(feature, userAgent);
        
        return Response.json({
          feature,
          userAgent,
          ...support,
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            ...corsHeaders
          }
        });
      }
      
      // Route: Batch check multiple features
      if (url.pathname === '/batch' && request.method === 'POST') {
        const body = await request.json();
        const features = body.features || [];
        
        const results = {};
        
        for (const feature of features) {
          results[feature] = featureGate.isFeatureSupported(feature, userAgent);
        }
        
        return Response.json({
          userAgent,
          results,
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders
          }
        });
      }
      
      // Route: Get polyfill URLs
      if (url.pathname === '/polyfills') {
        const features = url.searchParams.get('features')?.split(',') || [];
        const polyfillUrls = [];
        
        for (const feature of features) {
          const support = featureGate.isFeatureSupported(feature, userAgent);
          if (!support.supported && support.polyfill) {
            polyfillUrls.push({
              feature,
              url: support.polyfill
            });
          }
        }
        
        return Response.json({
          polyfills: polyfillUrls,
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders
          }
        });
      }
      
      // Route: Health check and documentation
      if (url.pathname === '/' || url.pathname === '/health') {
        const parser = new UserAgentParser(userAgent);
        
        return Response.json({
          service: 'Baseline Feature-Gate CDN Worker',
          version: '1.0.0',
          userAgent: {
            raw: userAgent,
            browser: parser.getBrowser(),
            version: parser.getVersion()
          },
          endpoints: {
            '/gate.js?features=feature1,feature2': 'Get feature gate JavaScript',
            '/check?feature=featureName': 'Check single feature support',
            '/batch (POST)': 'Check multiple features',
            '/polyfills?features=feature1,feature2': 'Get polyfill URLs'
          },
          availableFeatures: Object.keys(FEATURE_COMPATIBILITY),
          timestamp: new Date().toISOString()
        }, {
          headers: {
            'Cache-Control': 'public, max-age=300',
            ...corsHeaders
          }
        });
      }
      
      // 404 for unmatched routes
      return Response.json({
        error: 'Not Found',
        message: 'Endpoint not found. Visit / for API documentation.'
      }, {
        status: 404,
        headers: corsHeaders
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      
      return Response.json({
        error: 'Internal Server Error',
        message: error.message
      }, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

// For Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UserAgentParser, FeatureGate, FEATURE_COMPATIBILITY };
}