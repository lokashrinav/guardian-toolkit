class BadgeGenerator {
  constructor() {
    // Color schemes for different risk levels and statuses
    this.colors = {
      // Risk levels
      low: '#4c1',
      medium: '#fe7d37', 
      high: '#e05d44',
      
      // Safety levels
      safe: '#4c1',
      unsafe: '#e05d44',
      caution: '#fe7d37',
      unknown: '#9f9f9f',
      
      // Compliance levels
      excellent: '#4c1',
      good: '#97ca00',
      fair: '#dfb317',
      poor: '#e05d44',
      
      // General statuses
      passing: '#4c1',
      failing: '#e05d44',
      error: '#e05d44',
      
      // Default
      default: '#007ec6'
    };
    
    // Badge styles
    this.styles = {
      flat: {
        height: 20,
        borderRadius: 3,
        fontSize: 11,
        fontFamily: 'DejaVu Sans,Verdana,Geneva,sans-serif'
      },
      'for-the-badge': {
        height: 28,
        borderRadius: 0,
        fontSize: 12,
        fontFamily: 'Verdana,Geneva,DejaVu Sans,sans-serif',
        textTransform: 'uppercase'
      },
      plastic: {
        height: 18,
        borderRadius: 4,
        fontSize: 10,
        fontFamily: 'DejaVu Sans,Verdana,Geneva,sans-serif',
        gradient: true
      }
    };
  }
  
  generateReportBadge(reportData, options = {}) {
    const { style = 'flat', label = 'baseline' } = options;
    
    const totalIssues = reportData.summary?.totalIssues || 0;
    const riskLevel = reportData.summary?.riskLevel || 'unknown';
    
    let message, color;
    
    if (totalIssues === 0) {
      message = 'passing';
      color = this.colors.passing;
    } else {
      message = `${totalIssues} issue${totalIssues === 1 ? '' : 's'}`;
      color = this.colors[riskLevel] || this.colors.unknown;
    }
    
    return this.generateSVGBadge(label, message, color, style);
  }
  
  generateRepoScanBadge(scanResults, options = {}) {
    const { style = 'flat', label = 'baseline' } = options;
    
    const totalIssues = scanResults.totalIssues || 0;
    const riskLevel = scanResults.riskLevel || 'unknown';
    
    let message, color;
    
    if (totalIssues === 0) {
      message = 'clean';
      color = this.colors.passing;
    } else {
      message = `${totalIssues} issue${totalIssues === 1 ? '' : 's'}`;
      color = this.colors[riskLevel] || this.colors.unknown;
    }
    
    return this.generateSVGBadge(label, message, color, style);
  }
  
  generateStatusBadge(statusData, options = {}) {
    const { style = 'flat', label = 'baseline' } = options;
    
    const issues = statusData.issues || 0;
    const riskLevel = statusData.riskLevel || 'unknown';
    
    let message, color;
    
    if (statusData.color) {
      color = statusData.color;
    } else {
      color = this.colors[riskLevel] || this.colors.unknown;
    }
    
    if (issues === 0) {
      message = 'passing';
    } else {
      message = `${issues} issue${issues === 1 ? '' : 's'}`;
    }
    
    return this.generateSVGBadge(label, message, color, style);
  }
  
  generateComplianceBadge(complianceData, options = {}) {
    const { style = 'flat', label = 'compliance' } = options;
    
    const percentage = complianceData.percentage || 0;
    const message = complianceData.message || `${percentage}%`;
    
    let color;
    if (percentage >= 95) {
      color = this.colors.excellent;
    } else if (percentage >= 85) {
      color = this.colors.good;
    } else if (percentage >= 70) {
      color = this.colors.fair;
    } else {
      color = this.colors.poor;
    }
    
    return this.generateSVGBadge(label, message, color, style);
  }
  
  generateFeatureBadge(featureName, featureData, options = {}) {
    const { style = 'flat' } = options;
    
    let message, color;
    
    if (!featureData.found) {
      message = 'unknown';
      color = this.colors.unknown;
    } else if (featureData.isSafe) {
      message = featureData.safety || 'safe';
      color = this.colors[featureData.safety] || this.colors.safe;
    } else {
      message = featureData.safety || 'unsafe';
      color = this.colors[featureData.safety] || this.colors.unsafe;
    }
    
    return this.generateSVGBadge(featureName, message, color, style);
  }
  
  generateErrorBadge(label, errorMessage, style = 'flat') {
    return this.generateSVGBadge(label, errorMessage, this.colors.error, style);
  }
  
  generateSVGBadge(leftText, rightText, color, styleName = 'flat') {
    const styleConfig = this.styles[styleName] || this.styles.flat;
    
    // Calculate text widths (approximate)
    const leftWidth = this.calculateTextWidth(leftText, styleConfig.fontSize);
    const rightWidth = this.calculateTextWidth(rightText, styleConfig.fontSize);
    const totalWidth = leftWidth + rightWidth;
    
    const height = styleConfig.height;
    const borderRadius = styleConfig.borderRadius;
    
    // Apply text transform if specified
    if (styleConfig.textTransform === 'uppercase') {
      leftText = leftText.toUpperCase();
      rightText = rightText.toUpperCase();
    }
    
    // Generate gradient definitions if plastic style
    const gradientDefs = styleConfig.gradient ? `
      <defs>
        <linearGradient id="b" x2="0" y2="100%">
          <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
          <stop offset="1" stop-opacity=".1"/>
        </linearGradient>
      </defs>
    ` : '';
    
    const gradientOverlay = styleConfig.gradient ? `
      <rect rx="${borderRadius}" width="${totalWidth}" height="${height}" fill="url(#b)"/>
    ` : '';
    
    return `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${height}" role="img" aria-label="${leftText}: ${rightText}">
  <title>${leftText}: ${rightText}</title>
  ${gradientDefs}
  <clipPath id="r">
    <rect width="${totalWidth}" height="${height}" rx="${borderRadius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="${height}" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${color}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${styleConfig.fontFamily}" text-rendering="geometricPrecision" font-size="${styleConfig.fontSize}">
    <text aria-hidden="true" x="${leftWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${this.escapeXml(leftText)}</text>
    <text x="${leftWidth / 2}" y="14" fill="#fff">${this.escapeXml(leftText)}</text>
    <text aria-hidden="true" x="${leftWidth + (rightWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${this.escapeXml(rightText)}</text>
    <text x="${leftWidth + (rightWidth / 2)}" y="14" fill="#fff">${this.escapeXml(rightText)}</text>
  </g>
  ${gradientOverlay}
</svg>`.trim();
  }
  
  calculateTextWidth(text, fontSize) {
    // Approximate character width calculation
    // This is a simplified calculation; in a real implementation,
    // you might want to use a more accurate text measurement
    const avgCharWidth = fontSize * 0.6;
    return Math.ceil((text.length * avgCharWidth) + 20); // Add padding
  }
  
  escapeXml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  // Generate a simple shields.io compatible badge URL
  generateShieldsUrl(label, message, color, style = 'flat') {
    const encodedLabel = encodeURIComponent(label);
    const encodedMessage = encodeURIComponent(message);
    const encodedColor = encodeURIComponent(color.replace('#', ''));
    
    return `https://img.shields.io/badge/${encodedLabel}-${encodedMessage}-${encodedColor}?style=${style}`;
  }
  
  // Generate markdown for embedding badges
  generateMarkdown(badgeUrl, altText, linkUrl = null) {
    const badge = `![${altText}](${badgeUrl})`;
    return linkUrl ? `[${badge}](${linkUrl})` : badge;
  }
  
  // Generate HTML for embedding badges
  generateHTML(badgeUrl, altText, linkUrl = null) {
    const img = `<img src="${badgeUrl}" alt="${altText}">`;
    return linkUrl ? `<a href="${linkUrl}">${img}</a>` : img;
  }
}

module.exports = BadgeGenerator;