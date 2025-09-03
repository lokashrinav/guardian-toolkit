// Figma Plugin: Baseline Web Features Checker
// Scans design layers for non-baseline CSS features

// CSS features that commonly appear in designs and their baseline status
const CSS_FEATURES = {
  // Layout features
  'container-queries': { 
    baseline: false, 
    reason: 'Container queries are not baseline safe',
    detectedIn: ['width', 'height', 'constraints']
  },
  'aspect-ratio': {
    baseline: false,
    reason: 'CSS aspect-ratio property is not baseline safe',
    detectedIn: ['constraints', 'layout']
  },
  'gap': {
    baseline: true,
    reason: 'CSS gap property has good baseline support',
    detectedIn: ['layoutMode', 'itemSpacing']
  },
  'grid': {
    baseline: true,
    reason: 'CSS Grid has good baseline support', 
    detectedIn: ['layoutMode']
  },
  'flexbox': {
    baseline: true,
    reason: 'Flexbox has excellent baseline support',
    detectedIn: ['layoutMode']
  },
  
  // Visual effects
  'backdrop-filter': {
    baseline: false,
    reason: 'backdrop-filter is not baseline safe',
    detectedIn: ['effects', 'backgroundBlur']
  },
  'mix-blend-mode': {
    baseline: false,
    reason: 'Advanced blend modes may not be baseline safe',
    detectedIn: ['blendMode']
  },
  'filter': {
    baseline: true,
    reason: 'Basic CSS filters have good baseline support',
    detectedIn: ['effects']
  },
  'border-radius': {
    baseline: true,
    reason: 'border-radius has excellent baseline support',
    detectedIn: ['cornerRadius']
  },
  
  // Typography
  'font-display': {
    baseline: false,
    reason: 'font-display property needs fallback handling',
    detectedIn: ['fontName', 'textCase']
  },
  'text-overflow': {
    baseline: true,
    reason: 'text-overflow has good baseline support',
    detectedIn: ['textTruncation']
  },
  'line-clamp': {
    baseline: false,
    reason: '-webkit-line-clamp is not baseline safe',
    detectedIn: ['textTruncation']
  },
  
  // Colors and gradients
  'color-mix': {
    baseline: false,
    reason: 'CSS color-mix() function is not baseline safe',
    detectedIn: ['fills', 'strokes']
  },
  'conic-gradient': {
    baseline: false,
    reason: 'Conic gradients are not baseline safe',
    detectedIn: ['fills']
  },
  'oklch': {
    baseline: false,
    reason: 'OKLCH color space is not baseline safe',
    detectedIn: ['fills', 'strokes']
  }
};

// Blend modes that may not be baseline safe
const RISKY_BLEND_MODES = [
  'COLOR_DODGE', 'COLOR_BURN', 'HARD_LIGHT', 'SOFT_LIGHT',
  'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY'
];

class BaselineChecker {
  constructor() {
    this.issues = [];
    this.scannedNodes = 0;
    this.apiEndpoint = 'http://localhost:3000'; // Your baseline API
  }
  
  async scanDocument() {
    this.issues = [];
    this.scannedNodes = 0;
    
    figma.ui.postMessage({ type: 'scan-started' });
    
    // Get all nodes in the document
    const pages = figma.root.children;
    
    for (const page of pages) {
      await this.scanNode(page);
    }
    
    // Sort issues by risk level
    this.issues.sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      return riskOrder[a.risk] - riskOrder[b.risk];
    });
    
    figma.ui.postMessage({
      type: 'scan-complete',
      issues: this.issues,
      scannedNodes: this.scannedNodes,
      summary: this.generateSummary()
    });
  }
  
  async scanNode(node) {
    this.scannedNodes++;
    
    // Update progress
    if (this.scannedNodes % 50 === 0) {
      figma.ui.postMessage({
        type: 'scan-progress',
        scanned: this.scannedNodes
      });
    }
    
    // Check different node types for baseline issues
    const nodeIssues = [];
    
    // Check layout properties
    if ('layoutMode' in node) {
      const layoutIssues = this.checkLayoutFeatures(node);
      nodeIssues.push(...layoutIssues);
    }
    
    // Check visual effects
    if ('effects' in node) {
      const effectIssues = this.checkVisualEffects(node);
      nodeIssues.push(...effectIssues);
    }
    
    // Check blend modes
    if ('blendMode' in node) {
      const blendIssues = this.checkBlendMode(node);
      nodeIssues.push(...blendIssues);
    }
    
    // Check fills and strokes
    if ('fills' in node) {
      const fillIssues = this.checkFills(node);
      nodeIssues.push(...fillIssues);
    }
    
    // Check typography
    if ('fontName' in node) {
      const fontIssues = this.checkTypography(node);
      nodeIssues.push(...fontIssues);
    }
    
    // Check constraints for aspect-ratio usage
    if ('constraints' in node) {
      const constraintIssues = this.checkConstraints(node);
      nodeIssues.push(...constraintIssues);
    }
    
    // Add node info to issues
    nodeIssues.forEach(issue => {
      issue.node = {
        id: node.id,
        name: node.name,
        type: node.type,
        page: node.parent?.type === 'PAGE' ? node.parent.name : 'Unknown'
      };
    });
    
    this.issues.push(...nodeIssues);
    
    // Recursively scan children
    if ('children' in node) {
      for (const child of node.children) {
        await this.scanNode(child);
      }
    }
  }
  
  checkLayoutFeatures(node) {
    const issues = [];
    
    // Check for auto-layout (flexbox)
    if (node.layoutMode !== 'NONE') {
      // This is generally safe - flexbox has good support
      // But check for advanced gap usage
      if (node.itemSpacing > 0) {
        // Gap is generally safe now
      }
    }
    
    return issues;
  }
  
  checkVisualEffects(node) {
    const issues = [];
    
    if (node.effects && node.effects.length > 0) {
      node.effects.forEach(effect => {
        // Check for backdrop filters (background blur)
        if (effect.type === 'BACKGROUND_BLUR') {
          issues.push({
            feature: 'backdrop-filter',
            severity: 'high',
            risk: 'high',
            message: 'Background blur uses backdrop-filter which is not baseline safe',
            recommendation: 'Consider using a semi-transparent overlay instead',
            cssProperty: 'backdrop-filter: blur()',
            ...CSS_FEATURES['backdrop-filter']
          });
        }
        
        // Check for advanced shadow effects
        if (effect.type === 'DROP_SHADOW' && effect.blendMode !== 'NORMAL') {
          issues.push({
            feature: 'box-shadow-blend-mode',
            severity: 'medium',
            risk: 'medium',
            message: 'Complex shadow blend modes may not be baseline safe',
            recommendation: 'Use standard drop shadows with normal blend mode',
            cssProperty: `box-shadow with blend-mode: ${effect.blendMode?.toLowerCase()}`
          });
        }
      });
    }
    
    return issues;
  }
  
  checkBlendMode(node) {
    const issues = [];
    
    if (RISKY_BLEND_MODES.includes(node.blendMode)) {
      issues.push({
        feature: 'mix-blend-mode',
        severity: 'high',
        risk: 'high',
        message: `Blend mode "${node.blendMode}" may not be baseline safe`,
        recommendation: 'Use standard blend modes (normal, multiply, screen) or provide fallbacks',
        cssProperty: `mix-blend-mode: ${node.blendMode.toLowerCase().replace('_', '-')}`,
        ...CSS_FEATURES['mix-blend-mode']
      });
    }
    
    return issues;
  }
  
  checkFills(node) {
    const issues = [];
    
    if (node.fills && Array.isArray(node.fills)) {
      node.fills.forEach(fill => {
        // Check for complex gradients
        if (fill.type === 'GRADIENT_ANGULAR') {
          issues.push({
            feature: 'conic-gradient',
            severity: 'medium',
            risk: 'medium',
            message: 'Angular/conic gradients are not baseline safe',
            recommendation: 'Use linear or radial gradients instead',
            cssProperty: 'background: conic-gradient()',
            ...CSS_FEATURES['conic-gradient']
          });
        }
        
        // Check for advanced gradient types
        if (fill.type === 'GRADIENT_DIAMOND') {
          issues.push({
            feature: 'complex-gradient',
            severity: 'medium', 
            risk: 'medium',
            message: 'Diamond gradients may require complex CSS fallbacks',
            recommendation: 'Simplify to linear or radial gradients'
          });
        }
      });
    }
    
    return issues;
  }
  
  checkTypography(node) {
    const issues = [];
    
    // Check for text truncation that might use line-clamp
    if (node.textTruncation === 'ENDING') {
      issues.push({
        feature: 'line-clamp',
        severity: 'medium',
        risk: 'medium', 
        message: 'Text truncation may use -webkit-line-clamp which is not baseline safe',
        recommendation: 'Implement JavaScript-based truncation or use text-overflow: ellipsis',
        cssProperty: '-webkit-line-clamp',
        ...CSS_FEATURES['line-clamp']
      });
    }
    
    // Check for advanced text case transformations
    if (node.textCase && node.textCase !== 'ORIGINAL') {
      // Most text-transform values are baseline safe, but good to note
    }
    
    return issues;
  }
  
  checkConstraints(node) {
    const issues = [];
    
    // Check for aspect ratio constraints that might suggest CSS aspect-ratio usage
    if (node.constraints && 
        node.constraints.horizontal === 'SCALE' && 
        node.constraints.vertical === 'SCALE') {
      
      // This could indicate aspect-ratio usage in CSS
      issues.push({
        feature: 'aspect-ratio',
        severity: 'high',
        risk: 'high',
        message: 'Proportional scaling may use CSS aspect-ratio which is not baseline safe',
        recommendation: 'Use padding-bottom percentage hack or JavaScript for aspect ratios',
        cssProperty: 'aspect-ratio',
        ...CSS_FEATURES['aspect-ratio']
      });
    }
    
    return issues;
  }
  
  generateSummary() {
    const summary = {
      total: this.issues.length,
      byRisk: { high: 0, medium: 0, low: 0 },
      byFeature: {},
      recommendations: []
    };
    
    this.issues.forEach(issue => {
      summary.byRisk[issue.risk]++;
      
      if (!summary.byFeature[issue.feature]) {
        summary.byFeature[issue.feature] = 0;
      }
      summary.byFeature[issue.feature]++;
    });
    
    // Generate top recommendations
    if (summary.byRisk.high > 0) {
      summary.recommendations.push('High-risk features detected - consider baseline-safe alternatives');
    }
    if (summary.byRisk.medium > 3) {
      summary.recommendations.push('Multiple medium-risk features - test thoroughly in older browsers');
    }
    if (summary.total === 0) {
      summary.recommendations.push('Great! No baseline compatibility issues detected');
    }
    
    return summary;
  }
  
  async selectNode(nodeId) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
    }
  }
  
  async highlightIssues() {
    // Create a frame to highlight all problematic nodes
    const highlightFrame = figma.createFrame();
    highlightFrame.name = "⚠️ Baseline Issues";
    highlightFrame.fills = [];
    
    this.issues.forEach(issue => {
      // Add visual indicators (could be implemented with overlays)
    });
  }
}

// Plugin message handlers
const checker = new BaselineChecker();

figma.showUI(__html__, { 
  width: 400, 
  height: 600,
  title: "Baseline Checker"
});

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'scan-document':
      await checker.scanDocument();
      break;
      
    case 'select-node':
      await checker.selectNode(msg.nodeId);
      break;
      
    case 'highlight-issues':
      await checker.highlightIssues();
      break;
      
    case 'close':
      figma.closePlugin();
      break;
  }
};