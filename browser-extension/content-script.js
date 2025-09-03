// Browser Extension Content Script
// Adds baseline compatibility indicators to code snippets

class BaselineAnnotator {
  constructor() {
    this.apiEndpoint = 'http://localhost:3000';
    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    
    // Site-specific selectors for code blocks
    this.siteSelectors = {
      'developer.mozilla.org': {
        codeBlocks: [
          'pre code',
          '.code-example pre',
          '.example-bad pre',
          '.example-good pre',
          'div[class*="code-example"] pre'
        ],
        language: this.getMDNLanguage.bind(this)
      },
      'stackoverflow.com': {
        codeBlocks: [
          'pre code',
          '.s-code-block pre',
          '.snippet-code pre'
        ],
        language: this.getSOLanguage.bind(this)
      },
      'github.com': {
        codeBlocks: [
          '.highlight pre',
          '.blob-code-content',
          'pre[lang]',
          'code[class*="language-"]'
        ],
        language: this.getGitHubLanguage.bind(this)
      },
      'gist.github.com': {
        codeBlocks: [
          '.highlight pre',
          '.blob-code-content'
        ],
        language: this.getGitHubLanguage.bind(this)
      },
      'codepen.io': {
        codeBlocks: [
          '.CodeMirror-code',
          'pre code'
        ],
        language: this.getCodePenLanguage.bind(this)
      }
    };
    
    // Feature patterns to detect in code
    this.featurePatterns = {
      // JavaScript features
      'array-at': {
        patterns: [/\\.at\\s*\\(/g, /Array\\.prototype\\.at/g],
        language: 'javascript',
        baseline: false,
        severity: 'high'
      },
      'string-replaceall': {
        patterns: [/\\.replaceAll\\s*\\(/g, /String\\.prototype\\.replaceAll/g],
        language: 'javascript',
        baseline: false,
        severity: 'high'
      },
      'promise-allsettled': {
        patterns: [/Promise\\.allSettled\\s*\\(/g],
        language: 'javascript',
        baseline: false,
        severity: 'high'
      },
      'optional-chaining': {
        patterns: [/\\?\\.\\w/g, /\\?\\.[\\[\\(]/g],
        language: 'javascript',
        baseline: true,
        severity: 'low'
      },
      'nullish-coalescing': {
        patterns: [/\\?\\?\\s/g],
        language: 'javascript', 
        baseline: true,
        severity: 'low'
      },
      'resize-observer': {
        patterns: [/new ResizeObserver/g, /ResizeObserver\\s*\\(/g],
        language: 'javascript',
        baseline: false,
        severity: 'medium'
      },
      'intersection-observer': {
        patterns: [/new IntersectionObserver/g],
        language: 'javascript',
        baseline: true,
        severity: 'low'
      },
      
      // CSS features
      'container-queries': {
        patterns: [/@container\\s/g, /container-type:/g, /container-name:/g],
        language: 'css',
        baseline: false,
        severity: 'high'
      },
      'has-selector': {
        patterns: [/:has\\s*\\(/g],
        language: 'css',
        baseline: false,
        severity: 'high'
      },
      'aspect-ratio': {
        patterns: [/aspect-ratio\\s*:/g],
        language: 'css',
        baseline: false,
        severity: 'high'
      },
      'backdrop-filter': {
        patterns: [/backdrop-filter\\s*:/g],
        language: 'css',
        baseline: false,
        severity: 'high'
      },
      'gap': {
        patterns: [/\\bgap\\s*:/g],
        language: 'css',
        baseline: true,
        severity: 'low'
      },
      'css-grid': {
        patterns: [/display\\s*:\\s*grid/g, /grid-template/g],
        language: 'css',
        baseline: true,
        severity: 'low'
      },
      'flexbox': {
        patterns: [/display\\s*:\\s*flex/g, /flex-direction/g],
        language: 'css',
        baseline: true,
        severity: 'low'
      },
      
      // HTML features
      'dialog-element': {
        patterns: [/<dialog[^>]*>/g, /dialog\\s*>/g],
        language: 'html',
        baseline: false,
        severity: 'medium'
      },
      'popover-attribute': {
        patterns: [/popover\\s*=/g],
        language: 'html',
        baseline: false,
        severity: 'high'
      }
    };
  }
  
  init() {
    console.log('🎯 Baseline Code Annotator initialized');
    this.annotateCodeBlocks();
    
    // Re-annotate when new content loads (SPA navigation)
    this.observeChanges();
  }
  
  observeChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldReAnnotate = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any added nodes contain code blocks
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const hasCodeBlocks = this.getCurrentSiteSelectors().codeBlocks.some(selector => 
                node.querySelector && node.querySelector(selector)
              );
              if (hasCodeBlocks || node.matches && this.getCurrentSiteSelectors().codeBlocks.some(selector => node.matches(selector))) {
                shouldReAnnotate = true;
              }
            }
          });
        }
      });
      
      if (shouldReAnnotate) {
        setTimeout(() => this.annotateCodeBlocks(), 500); // Debounce
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  getCurrentSiteSelectors() {
    const hostname = window.location.hostname;
    return this.siteSelectors[hostname] || this.siteSelectors['stackoverflow.com']; // Default fallback
  }
  
  annotateCodeBlocks() {
    const siteConfig = this.getCurrentSiteSelectors();
    const codeBlocks = [];
    
    // Collect all code blocks
    siteConfig.codeBlocks.forEach(selector => {
      document.querySelectorAll(selector).forEach(block => {
        if (!block.hasAttribute('data-baseline-annotated')) {
          codeBlocks.push(block);
        }
      });
    });
    
    console.log(`🔍 Found ${codeBlocks.length} new code blocks to annotate`);
    
    codeBlocks.forEach(block => this.annotateCodeBlock(block, siteConfig));
  }
  
  async annotateCodeBlock(codeBlock, siteConfig) {
    try {
      const code = this.extractCode(codeBlock);
      const language = siteConfig.language(codeBlock);
      
      if (!code.trim() || code.length < 10) return;
      
      const analysis = this.analyzeCode(code, language);
      
      if (analysis.features.length > 0) {
        this.addAnnotation(codeBlock, analysis);
      } else {
        // Add a subtle safe indicator
        this.addSafeIndicator(codeBlock);
      }
      
      codeBlock.setAttribute('data-baseline-annotated', 'true');
      
    } catch (error) {
      console.error('Error annotating code block:', error);
    }
  }
  
  extractCode(codeBlock) {
    // Try to get clean text without line numbers and UI elements
    let code = codeBlock.textContent || codeBlock.innerText || '';
    
    // Remove common artifacts
    code = code.replace(/^\\d+\\s*/gm, ''); // Line numbers at start of lines
    code = code.replace(/\\u00a0/g, ' '); // Non-breaking spaces
    
    return code.trim();
  }
  
  getMDNLanguage(codeBlock) {
    // MDN often has language indicators in classes or data attributes
    const classList = codeBlock.className || '';
    const parentClasses = codeBlock.parentElement?.className || '';
    
    if (classList.includes('css') || parentClasses.includes('css')) return 'css';
    if (classList.includes('html') || parentClasses.includes('html')) return 'html';
    if (classList.includes('js') || classList.includes('javascript') || parentClasses.includes('js')) return 'javascript';
    
    // Check for specific MDN patterns
    const exampleContainer = codeBlock.closest('[class*="example"]');
    if (exampleContainer) {
      const containerClass = exampleContainer.className;
      if (containerClass.includes('css')) return 'css';
      if (containerClass.includes('html')) return 'html';
      if (containerClass.includes('js')) return 'javascript';
    }
    
    return 'unknown';
  }
  
  getSOLanguage(codeBlock) {
    // Stack Overflow uses highlighting classes
    const classList = codeBlock.className || '';
    
    if (classList.includes('lang-css') || classList.includes('language-css')) return 'css';
    if (classList.includes('lang-html') || classList.includes('language-html')) return 'html';
    if (classList.includes('lang-js') || classList.includes('lang-javascript') || classList.includes('language-javascript')) return 'javascript';
    
    // Check parent for language indicators
    const pre = codeBlock.closest('pre');
    if (pre && pre.className) {
      if (pre.className.includes('css')) return 'css';
      if (pre.className.includes('html')) return 'html';
      if (pre.className.includes('javascript') || pre.className.includes('js')) return 'javascript';
    }
    
    return 'unknown';
  }
  
  getGitHubLanguage(codeBlock) {
    // GitHub uses various patterns for language detection
    const highlight = codeBlock.closest('.highlight');
    if (highlight) {
      const classList = highlight.className;
      if (classList.includes('highlight-source-css')) return 'css';
      if (classList.includes('highlight-text-html')) return 'html';
      if (classList.includes('highlight-source-js') || classList.includes('highlight-source-javascript')) return 'javascript';
    }
    
    // Check for lang attribute
    const langAttr = codeBlock.getAttribute('lang') || codeBlock.closest('[lang]')?.getAttribute('lang');
    if (langAttr) {
      if (langAttr.includes('css')) return 'css';
      if (langAttr.includes('html')) return 'html';
      if (langAttr.includes('javascript') || langAttr.includes('js')) return 'javascript';
    }
    
    return 'unknown';
  }
  
  getCodePenLanguage(codeBlock) {
    // CodePen has different panels for different languages
    const panel = codeBlock.closest('[class*="css"]') ? 'css' :
                  codeBlock.closest('[class*="html"]') ? 'html' :
                  codeBlock.closest('[class*="js"]') ? 'javascript' : 'unknown';
    
    return panel;
  }
  
  analyzeCode(code, language) {
    const analysis = {
      features: [],
      overallRisk: 'safe',
      language
    };
    
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    
    // Check each feature pattern
    Object.entries(this.featurePatterns).forEach(([featureName, feature]) => {
      if (feature.language !== language && feature.language !== 'unknown') return;
      
      let matches = 0;
      feature.patterns.forEach(pattern => {
        const found = code.match(pattern);
        if (found) {
          matches += found.length;
        }
      });
      
      if (matches > 0) {
        analysis.features.push({
          name: featureName,
          matches,
          baseline: feature.baseline,
          severity: feature.severity,
          description: this.getFeatureDescription(featureName, feature)
        });
        
        if (!feature.baseline) {
          if (feature.severity === 'high') highRiskCount++;
          else if (feature.severity === 'medium') mediumRiskCount++;
        }
      }
    });
    
    // Determine overall risk
    if (highRiskCount > 0) {
      analysis.overallRisk = 'high';
    } else if (mediumRiskCount > 0) {
      analysis.overallRisk = 'medium';
    } else if (analysis.features.some(f => !f.baseline)) {
      analysis.overallRisk = 'low';
    }
    
    return analysis;
  }
  
  getFeatureDescription(featureName, feature) {
    const descriptions = {
      'array-at': 'Array.prototype.at() - not baseline safe, use array[array.length - 1] instead',
      'string-replaceall': 'String.prototype.replaceAll() - not baseline safe, use .replace(/pattern/g, replacement)',
      'promise-allsettled': 'Promise.allSettled() - not baseline safe, use Promise.all() with error handling',
      'container-queries': '@container queries - not baseline safe, use media queries instead',
      'has-selector': 'CSS :has() selector - not baseline safe, use JavaScript for conditional styling',
      'aspect-ratio': 'CSS aspect-ratio - not baseline safe, use padding-bottom percentage hack',
      'backdrop-filter': 'backdrop-filter - not baseline safe, use semi-transparent overlays',
      'resize-observer': 'ResizeObserver - limited baseline support, provide fallback',
      'dialog-element': '<dialog> element - not baseline safe, use div with aria-modal',
      'popover-attribute': 'popover attribute - not baseline safe, implement with JavaScript'
    };
    
    return descriptions[featureName] || `${featureName} - check baseline compatibility`;
  }
  
  addAnnotation(codeBlock, analysis) {
    const indicator = this.createIndicator(analysis);
    this.positionIndicator(codeBlock, indicator);
  }
  
  addSafeIndicator(codeBlock) {
    const indicator = this.createSafeIndicator();
    this.positionIndicator(codeBlock, indicator);
  }
  
  createIndicator(analysis) {
    const indicator = document.createElement('div');
    indicator.className = `baseline-indicator baseline-${analysis.overallRisk}`;
    
    const dot = document.createElement('div');
    dot.className = 'baseline-dot';
    dot.textContent = '●';
    
    indicator.appendChild(dot);
    
    // Add tooltip
    const tooltip = this.createTooltip(analysis);
    indicator.appendChild(tooltip);
    
    // Show/hide tooltip on hover
    indicator.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
      tooltip.style.visibility = 'visible';
    });
    
    indicator.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    });
    
    return indicator;
  }
  
  createSafeIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'baseline-indicator baseline-safe';
    
    const dot = document.createElement('div');
    dot.className = 'baseline-dot';
    dot.textContent = '●';
    
    indicator.appendChild(dot);
    
    // Simple tooltip for safe code
    const tooltip = document.createElement('div');
    tooltip.className = 'baseline-tooltip';
    tooltip.innerHTML = `
      <div class="tooltip-header">✅ Baseline Safe</div>
      <div class="tooltip-body">This code uses baseline-compatible features.</div>
    `;
    
    indicator.appendChild(tooltip);
    
    indicator.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
      tooltip.style.visibility = 'visible';
    });
    
    indicator.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    });
    
    return indicator;
  }
  
  createTooltip(analysis) {
    const tooltip = document.createElement('div');
    tooltip.className = 'baseline-tooltip';
    
    const riskEmojis = {
      high: '❌',
      medium: '⚠️',
      low: '⚡',
      safe: '✅'
    };
    
    const riskLabels = {
      high: 'High Risk',
      medium: 'Medium Risk', 
      low: 'Low Risk',
      safe: 'Safe'
    };
    
    let html = `
      <div class="tooltip-header">
        ${riskEmojis[analysis.overallRisk]} ${riskLabels[analysis.overallRisk]}
      </div>
      <div class="tooltip-body">
    `;
    
    if (analysis.features.length > 0) {
      html += '<div class="features-list">';
      analysis.features.slice(0, 5).forEach(feature => { // Limit to 5 features
        const statusIcon = feature.baseline ? '✅' : '❌';
        html += `
          <div class="feature-item">
            ${statusIcon} <strong>${feature.name.replace(/-/g, ' ')}</strong>
            <br><small>${feature.description}</small>
          </div>
        `;
      });
      
      if (analysis.features.length > 5) {
        html += `<div class="more-features">+${analysis.features.length - 5} more features</div>`;
      }
      
      html += '</div>';
    } else {
      html += 'This code snippet appears to use baseline-compatible features.';
    }
    
    html += `
      </div>
      <div class="tooltip-footer">
        <small>Baseline Web Features Check</small>
      </div>
    `;
    
    tooltip.innerHTML = html;
    return tooltip;
  }
  
  positionIndicator(codeBlock, indicator) {
    // Find the best position for the indicator
    let container = codeBlock;
    
    // Try to find a suitable parent container
    const pre = codeBlock.closest('pre');
    const codeContainer = codeBlock.closest('.highlight, .code-example, .snippet-code');
    
    if (codeContainer) {
      container = codeContainer;
    } else if (pre) {
      container = pre;
    }
    
    // Make sure the container is positioned
    const computedStyle = getComputedStyle(container);
    if (computedStyle.position === 'static') {
      container.style.position = 'relative';
    }
    
    container.appendChild(indicator);
  }
}

// Initialize the annotator
const annotator = new BaselineAnnotator();

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => annotator.init(), 1000); // Small delay for dynamic content
  });
} else {
  setTimeout(() => annotator.init(), 1000);
}