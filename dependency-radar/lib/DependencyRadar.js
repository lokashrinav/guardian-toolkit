const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const semver = require('semver');

class DependencyRadar {
  constructor(options = {}) {
    this.apiEndpoint = options.apiEndpoint || 'http://localhost:3000';
    this.includeDev = options.includeDev || false;
    this.maxDepth = options.maxDepth || 2;
    this.verbose = options.verbose || false;
    this.cache = new Map();
    
    // Known risky packages and their safe alternatives
    this.riskyPackages = {
      'core-js': {
        risk: 'medium',
        reason: 'Polyfills many modern features, check baseline compatibility',
        alternatives: ['@babel/polyfill with selective imports']
      },
      'whatwg-fetch': {
        risk: 'low',
        reason: 'Fetch polyfill - modern browsers have native support',
        alternatives: ['Native fetch API']
      },
      'intersection-observer': {
        risk: 'low', 
        reason: 'Polyfill for IntersectionObserver API',
        alternatives: ['Native IntersectionObserver API']
      },
      'resize-observer-polyfill': {
        risk: 'medium',
        reason: 'ResizeObserver not baseline safe',
        alternatives: ['window.resize event with debouncing']
      },
      'abort-controller': {
        risk: 'low',
        reason: 'AbortController polyfill - good baseline support now',
        alternatives: ['Native AbortController']
      },
      'smoothscroll-polyfill': {
        risk: 'medium', 
        reason: 'Smooth scrolling not baseline safe',
        alternatives: ['Traditional scrollTo without smooth behavior']
      },
      'element-closest': {
        risk: 'low',
        reason: 'Element.closest() has good baseline support',
        alternatives: ['Native Element.closest()']
      }
    };
  }
  
  async scanProject(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('No package.json found in project directory');
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const dependencies = {
      ...packageJson.dependencies || {},
      ...(this.includeDev ? packageJson.devDependencies || {} : {})
    };
    
    const results = {
      project: packageJson.name || 'Unknown',
      version: packageJson.version || 'Unknown',
      scanDate: new Date().toISOString(),
      totalDependencies: Object.keys(dependencies).length,
      scannedDependencies: 0,
      riskySummary: { low: 0, medium: 0, high: 0 },
      dependencies: [],
      recommendations: []
    };
    
    console.log(chalk.blue(`📦 Found ${results.totalDependencies} dependencies to scan`));
    
    for (const [name, version] of Object.entries(dependencies)) {
      if (this.verbose) {
        console.log(chalk.gray(`  Checking: ${name}@${version}`));
      }
      
      try {
        const analysis = await this.analyzeDependency(name, version);
        results.dependencies.push(analysis);
        results.scannedDependencies++;
        
        // Update risk summary
        results.riskySummary[analysis.riskLevel]++;
        
        // Add recommendations for risky packages
        if (analysis.riskLevel === 'high' || analysis.riskLevel === 'medium') {
          if (this.riskyPackages[name]) {
            results.recommendations.push({
              package: name,
              current: version,
              recommendation: this.riskyPackages[name].alternatives[0],
              reason: this.riskyPackages[name].reason
            });
          }
        }
        
      } catch (error) {
        if (this.verbose) {
          console.log(chalk.red(`    Error analyzing ${name}: ${error.message}`));
        }
        
        results.dependencies.push({
          name,
          version,
          riskLevel: 'unknown',
          features: [],
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  async analyzeDependency(name, version) {
    const cacheKey = `${name}@${version}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const analysis = {
      name,
      version,
      riskLevel: 'low',
      features: [],
      description: '',
      hasKnownIssues: false
    };
    
    // Check if this is a known risky package
    if (this.riskyPackages[name]) {
      const riskInfo = this.riskyPackages[name];
      analysis.riskLevel = riskInfo.risk;
      analysis.hasKnownIssues = true;
      analysis.description = riskInfo.reason;
      analysis.alternatives = riskInfo.alternatives;
    }
    
    // Try to get package info from npm registry
    try {
      const packageInfo = await this.getPackageInfo(name);
      analysis.description = packageInfo.description || '';
      
      // Look for web feature keywords in description and keywords
      const webFeatureKeywords = [
        'polyfill', 'shim', 'fetch', 'promise', 'async', 'await',
        'intersectionobserver', 'resizeobserver', 'mutationobserver',
        'webcomponents', 'shadow-dom', 'custom-elements',
        'service-worker', 'webworker', 'indexed-db', 'websocket',
        'geolocation', 'notification', 'vibration', 'gamepad',
        'css-custom-properties', 'css-grid', 'flexbox', 'backdrop-filter'
      ];
      
      const text = `${analysis.description} ${packageInfo.keywords?.join(' ') || ''}`.toLowerCase();
      const foundFeatures = webFeatureKeywords.filter(keyword => text.includes(keyword));
      
      if (foundFeatures.length > 0) {
        analysis.features = foundFeatures;
        
        // Increase risk level if many modern features detected
        if (foundFeatures.length > 3 && analysis.riskLevel === 'low') {
          analysis.riskLevel = 'medium';
        }
      }
      
    } catch (error) {
      if (this.verbose) {
        console.log(chalk.yellow(`    Could not fetch info for ${name}: ${error.message}`));
      }
    }
    
    this.cache.set(cacheKey, analysis);
    return analysis;
  }
  
  async getPackageInfo(packageName) {
    try {
      const response = await axios.get(`https://registry.npmjs.org/${packageName}`, {
        timeout: 5000
      });
      
      return {
        description: response.data.description,
        keywords: response.data.keywords,
        homepage: response.data.homepage,
        repository: response.data.repository
      };
    } catch (error) {
      throw new Error(`Failed to fetch package info: ${error.message}`);
    }
  }
  
  async checkPackage(packageName, version = 'latest') {
    console.log(chalk.blue(`🔍 Checking ${packageName}${version !== 'latest' ? `@${version}` : ''}...`));
    
    const analysis = await this.analyzeDependency(packageName, version);
    const packageInfo = await this.getPackageInfo(packageName);
    
    return {
      ...analysis,
      ...packageInfo
    };
  }
  
  displayPackageInfo(packageInfo) {
    const riskColor = {
      low: chalk.green,
      medium: chalk.yellow,
      high: chalk.red,
      unknown: chalk.gray
    };
    
    console.log(chalk.bold(`\n📦 ${packageInfo.name}@${packageInfo.version}`));
    console.log(`Description: ${packageInfo.description || 'No description'}`);
    console.log(`Risk Level: ${riskColor[packageInfo.riskLevel](packageInfo.riskLevel.toUpperCase())}`);
    
    if (packageInfo.features && packageInfo.features.length > 0) {
      console.log(`Detected Features: ${packageInfo.features.join(', ')}`);
    }
    
    if (packageInfo.alternatives) {
      console.log(chalk.cyan(`Alternatives: ${packageInfo.alternatives.join(', ')}`));
    }
    
    if (packageInfo.homepage) {
      console.log(`Homepage: ${packageInfo.homepage}`);
    }
  }
  
  outputSummary(results) {
    console.log(chalk.bold('\n📊 Dependency Radar Summary'));
    console.log(`Project: ${results.project}`);
    console.log(`Total Dependencies: ${results.totalDependencies}`);
    console.log(`Scanned: ${results.scannedDependencies}`);
    
    const riskColors = {
      low: chalk.green,
      medium: chalk.yellow,
      high: chalk.red
    };
    
    console.log('\n🎯 Risk Distribution:');
    console.log(`${riskColors.low('●')} Low Risk: ${results.riskySummary.low}`);
    console.log(`${riskColors.medium('●')} Medium Risk: ${results.riskySummary.medium}`);  
    console.log(`${riskColors.high('●')} High Risk: ${results.riskySummary.high}`);
    
    // Show high-risk packages
    const highRiskPackages = results.dependencies.filter(d => d.riskLevel === 'high');
    if (highRiskPackages.length > 0) {
      console.log(chalk.red('\n❌ High Risk Packages:'));
      highRiskPackages.forEach(pkg => {
        console.log(`  • ${pkg.name}@${pkg.version} - ${pkg.description}`);
      });
    }
    
    // Show medium-risk packages  
    const mediumRiskPackages = results.dependencies.filter(d => d.riskLevel === 'medium');
    if (mediumRiskPackages.length > 0) {
      console.log(chalk.yellow('\n⚠️  Medium Risk Packages:'));
      mediumRiskPackages.forEach(pkg => {
        console.log(`  • ${pkg.name}@${pkg.version} - ${pkg.description}`);
      });
    }
    
    // Show recommendations
    if (results.recommendations.length > 0) {
      console.log(chalk.cyan('\n💡 Recommendations:'));
      results.recommendations.forEach(rec => {
        console.log(`  • ${rec.package}: Consider ${rec.recommendation}`);
        console.log(`    Reason: ${rec.reason}`);
      });
    }
  }
  
  outputTable(results) {
    console.log(chalk.bold('\n📋 Dependency Analysis Table'));
    
    const riskEmojis = { low: '✅', medium: '⚠️', high: '❌', unknown: '❓' };
    
    // Header
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.bold('Package'.padEnd(25) + 'Version'.padEnd(15) + 'Risk'.padEnd(10) + 'Description'));
    console.log(chalk.gray('─'.repeat(80)));
    
    // Sort by risk level (high first)
    const sorted = results.dependencies.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2, unknown: 3 };
      return order[a.riskLevel] - order[b.riskLevel];
    });
    
    sorted.forEach(dep => {
      const risk = `${riskEmojis[dep.riskLevel]} ${dep.riskLevel}`;
      const description = (dep.description || 'No description').substring(0, 40);
      
      console.log(
        dep.name.padEnd(25) +
        dep.version.padEnd(15) +
        risk.padEnd(10) +
        description
      );
    });
    
    console.log(chalk.gray('─'.repeat(80)));
  }
  
  outputJson(results, filename) {
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(chalk.green(`✅ Results saved to ${filename}`));
  }
  
  displayRiskyPackages() {
    console.log(chalk.bold('🚨 Known Risky Packages'));
    console.log(chalk.gray('These packages commonly use non-baseline web features:\n'));
    
    Object.entries(this.riskyPackages).forEach(([name, info]) => {
      const riskColor = info.risk === 'high' ? chalk.red : info.risk === 'medium' ? chalk.yellow : chalk.green;
      
      console.log(riskColor(`📦 ${name} (${info.risk} risk)`));
      console.log(`   Reason: ${info.reason}`);
      console.log(`   Alternative: ${info.alternatives[0]}`);
      console.log('');
    });
  }
}

module.exports = DependencyRadar;