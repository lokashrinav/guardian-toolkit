// Content Script: Baseline Features Scanner
// Scans the current page for non-baseline web features

class BaselineScanner {
  constructor() {
    this.apiEndpoint = 'http://localhost:3000';
    this.issues = [];
    this.elementsScanned = 0;
    
    // Features to detect in CSS
    this.cssFeatures = {
      'container-queries': {
        patterns: ['@container', 'container-type:', 'container-name:'],
        severity: 'critical',
        description: 'Container queries are not baseline safe'
      },
      'aspect-ratio': {
        patterns: ['aspect-ratio:'],
        severity: 'critical', 
        description: 'CSS aspect-ratio property is not baseline safe'
      },
      'backdrop-filter': {
        patterns: ['backdrop-filter:'],
        severity: 'critical',
        description: 'backdrop-filter is not baseline safe'
      },
      'has-selector': {
        patterns: [':has('],
        severity: 'critical',
        description: 'CSS :has() selector is not baseline safe'
      },
      'color-mix': {
        patterns: ['color-mix('],
        severity: 'warning',
        description: 'CSS color-mix() function is not baseline safe'
      },
      'conic-gradient': {
        patterns: ['conic-gradient('],
        severity: 'warning',
        description: 'Conic gradients are not baseline safe'
      },
      'oklch': {
        patterns: ['oklch(', 'color(display-p3'],
        severity: 'warning',
        description: 'Advanced color spaces may not be baseline safe'
      }
    };
    
    // Features to detect in JavaScript
    this.jsFeatures = {
      'array-at': {
        patterns: ['.at(', 'Array.prototype.at'],
        severity: 'critical',
        description: 'Array.prototype.at() is not baseline safe'
      },
      'string-replaceall': {
        patterns: ['.replaceAll(', 'String.prototype.replaceAll'],
        severity: 'critical',
        description: 'String.prototype.replaceAll() is not baseline safe'
      },
      'promise-allsettled': {
        patterns: ['Promise.allSettled('],
        severity: 'critical',
        description: 'Promise.allSettled() is not baseline safe'
      },
      'resize-observer': {
        patterns: ['new ResizeObserver(', 'ResizeObserver('],
        severity: 'warning',
        description: 'ResizeObserver API may not be baseline safe'
      },
      'abort-controller': {
        patterns: ['new AbortController(', 'AbortController('],
        severity: 'warning',
        description: 'AbortController API has good baseline support'
      },
      'clipboard-api': {
        patterns: ['navigator.clipboard', '.writeText(', '.readText('],
        severity: 'critical',
        description: 'Clipboard API is not baseline safe'
      }
    };
  }
  
  async scanPage() {
    this.issues = [];
    this.elementsScanned = 0;
    
    console.log('🔍 Starting baseline compatibility scan...');
    
    // Scan CSS
    await this.scanCSS();
    
    // Scan JavaScript
    await this.scanJavaScript();
    
    // Scan HTML
    await this.scanHTML();
    
    console.log(`✅ Scan complete: ${this.issues.length} issues found in ${this.elementsScanned} elements`);
    
    // Send results to DevTools panel
    const results = {
      issues: this.issues,
      elementsScanned: this.elementsScanned,
      timestamp: new Date().toISOString()
    };
    
    chrome.runtime.sendMessage({
      type: 'BASELINE_SCAN_RESULT',
      data: results
    });
    
    return results;
  }
  
  async scanCSS() {
    // Scan inline styles
    const elementsWithStyles = document.querySelectorAll('[style]');
    elementsWithStyles.forEach(element => {
      this.elementsScanned++;
      const style = element.getAttribute('style');
      this.checkCSSText(style, 'inline style', element);
    });
    
    // Scan stylesheets
    for (const stylesheet of document.styleSheets) {
      try {
        // Skip external stylesheets we can't access due to CORS
        if (stylesheet.href && !stylesheet.href.startsWith(window.location.origin)) {
          continue;
        }
        
        for (const rule of stylesheet.cssRules) {
          this.scanCSSRule(rule, stylesheet.href || 'inline stylesheet');
        }
      } catch (e) {
        // CORS or other access issues
        console.log('Could not access stylesheet:', stylesheet.href);
      }
    }
  }
  
  scanCSSRule(rule, source) {
    if (rule.type === CSSRule.STYLE_RULE) {
      this.elementsScanned++;
      const cssText = rule.cssText;
      this.checkCSSText(cssText, source, null, rule.selectorText);
    } else if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
      // Scan nested rules
      for (const nestedRule of rule.cssRules) {
        this.scanCSSRule(nestedRule, source);
      }
    }
  }
  
  checkCSSText(cssText, source, element = null, selector = null) {
    for (const [featureName, feature] of Object.entries(this.cssFeatures)) {
      for (const pattern of feature.patterns) {
        if (cssText.toLowerCase().includes(pattern.toLowerCase())) {
          const issue = {
            id: `css-${featureName}-${this.issues.length}`,
            type: 'css',
            feature: featureName,
            severity: feature.severity,
            description: feature.description,
            location: source,
            selector: selector || (element ? this.getSelector(element) : null),
            code: this.extractRelevantCode(cssText, pattern),
            element: element
          };
          
          this.issues.push(issue);
        }
      }
    }
  }
  
  async scanJavaScript() {
    // Scan inline scripts
    const inlineScripts = document.querySelectorAll('script:not([src])');
    inlineScripts.forEach(script => {
      this.elementsScanned++;
      if (script.textContent) {
        this.checkJSText(script.textContent, 'inline script', script);
      }
    });
    
    // Scan external scripts (limited by CORS)
    const externalScripts = document.querySelectorAll('script[src]');
    for (const script of externalScripts) {
      this.elementsScanned++;
      
      // Try to fetch and analyze external scripts from same origin
      if (script.src.startsWith(window.location.origin)) {
        try {
          const response = await fetch(script.src);
          const jsText = await response.text();
          this.checkJSText(jsText, script.src, script);
        } catch (e) {
          // Can't access external script
        }
      }
    }
    
    // Scan event handlers
    const elementsWithEvents = document.querySelectorAll('[onclick], [onload], [onchange]');
    elementsWithEvents.forEach(element => {
      this.elementsScanned++;
      
      ['onclick', 'onload', 'onchange', 'onsubmit'].forEach(attr => {
        const handler = element.getAttribute(attr);
        if (handler) {
          this.checkJSText(handler, `${attr} handler`, element);
        }
      });
    });
  }
  
  checkJSText(jsText, source, element = null) {
    for (const [featureName, feature] of Object.entries(this.jsFeatures)) {
      for (const pattern of feature.patterns) {
        const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&'), 'gi');
        const matches = jsText.match(regex);
        
        if (matches) {
          const issue = {
            id: `js-${featureName}-${this.issues.length}`,
            type: 'javascript',
            feature: featureName,
            severity: feature.severity,
            description: feature.description,
            location: source,
            selector: element ? this.getSelector(element) : null,
            code: this.extractRelevantCode(jsText, pattern),
            element: element
          };
          
          this.issues.push(issue);
        }
      }
    }
  }
  
  async scanHTML() {
    // Check for HTML features that might not be baseline safe
    const elementsToCheck = [
      { selector: 'dialog', feature: 'dialog-element', severity: 'warning' },
      { selector: 'details', feature: 'details-element', severity: 'info' },
      { selector: '[popover]', feature: 'popover-attribute', severity: 'critical' },
      { selector: 'input[type="color"]', feature: 'color-input', severity: 'info' },
      { selector: 'input[type="date"]', feature: 'date-input', severity: 'info' }
    ];
    
    elementsToCheck.forEach(({ selector, feature, severity }) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        this.elementsScanned++;
        
        const issue = {
          id: `html-${feature}-${this.issues.length}`,
          type: 'html',
          feature: feature,
          severity: severity,
          description: `${feature} may not be baseline safe`,
          location: 'HTML',
          selector: this.getSelector(element),
          code: element.outerHTML.substring(0, 100),
          element: element
        };
        
        this.issues.push(issue);
      });
    });
  }
  
  getSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.toString().trim().split(/\\s+/);
      return `${element.tagName.toLowerCase()}.${classes[0]}`;
    }
    
    // Generate a more specific selector
    let selector = element.tagName.toLowerCase();
    let parent = element.parentElement;
    let child = element;
    
    while (parent && selector.length < 50) {
      const siblings = Array.from(parent.children).filter(el => el.tagName === child.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(child) + 1;
        selector = `${parent.tagName.toLowerCase()} > ${child.tagName.toLowerCase()}:nth-child(${index})`;
      }
      child = parent;
      parent = parent.parentElement;
    }
    
    return selector;
  }
  
  extractRelevantCode(text, pattern) {
    const index = text.toLowerCase().indexOf(pattern.toLowerCase());
    if (index === -1) return text.substring(0, 50);
    
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + pattern.length + 20);
    
    return text.substring(start, end);
  }
  
  highlightElement(selector) {
    try {
      const element = document.querySelector(selector);
      if (!element) return;
      
      // Remove any existing highlights
      document.querySelectorAll('.baseline-highlight').forEach(el => {
        el.classList.remove('baseline-highlight');
      });
      
      // Add highlight styles
      if (!document.getElementById('baseline-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'baseline-highlight-styles';
        style.textContent = `
          .baseline-highlight {
            outline: 2px solid #ea4335 !important;
            outline-offset: 2px !important;
            background-color: rgba(234, 67, 53, 0.1) !important;
          }
        `;
        document.head.appendChild(style);
      }
      
      element.classList.add('baseline-highlight');
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.classList.remove('baseline-highlight');
      }, 3000);
      
    } catch (error) {
      console.error('Error highlighting element:', error);
    }
  }
}

// Initialize scanner
const scanner = new BaselineScanner();

// Listen for messages from DevTools panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_BASELINE_SCAN') {
    scanner.scanPage().then(results => {
      sendResponse({ success: true, results });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Will respond asynchronously
  }
  
  if (message.type === 'HIGHLIGHT_ELEMENT') {
    scanner.highlightElement(message.selector);
    sendResponse({ success: true });
  }
  
  return true;
});