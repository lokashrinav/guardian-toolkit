const fs = require('fs');
const path = require('path');
const UAParser = require('ua-parser-js');

class TelemetryAnalyzer {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.rumData = new Map();
    this.featureUsage = new Map();
    this.browserStats = new Map();
    this.performanceData = new Map();
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Load existing data
    this.loadPersistedData();
    
    // Browser baseline thresholds (% of users)
    this.baselineThresholds = {
      high: 95, // 95% of users should support the feature
      medium: 85, // 85% of users should support the feature  
      low: 70   // 70% of users should support the feature
    };
  }
  
  async ingestRumData(rumData) {
    const timestamp = new Date(rumData.timestamp);
    const dayKey = timestamp.toISOString().split('T')[0];
    const userAgent = new UAParser(rumData.userAgent);
    
    const processedData = {
      ...rumData,
      browser: userAgent.getBrowser(),
      os: userAgent.getOS(),
      device: userAgent.getDevice(),
      dayKey,
      timestamp: timestamp.toISOString()
    };
    
    // Store RUM data
    if (!this.rumData.has(dayKey)) {
      this.rumData.set(dayKey, []);
    }
    this.rumData.get(dayKey).push(processedData);
    
    // Update browser statistics
    this.updateBrowserStats(processedData);
    
    // Update performance data
    if (rumData.performanceMetrics) {
      this.updatePerformanceData(processedData);
    }
    
    // Persist data periodically
    if (Math.random() < 0.1) { // 10% chance to persist
      await this.persistData();
    }
  }
  
  async ingestFeatureUsage(featureData) {
    const timestamp = new Date(featureData.timestamp || Date.now());
    const dayKey = timestamp.toISOString().split('T')[0];
    
    if (!this.featureUsage.has(dayKey)) {
      this.featureUsage.set(dayKey, new Map());
    }
    
    const dayData = this.featureUsage.get(dayKey);
    
    featureData.features.forEach(feature => {
      const key = `${featureData.site || 'unknown'}:${feature.name}`;
      
      if (!dayData.has(key)) {
        dayData.set(key, {
          feature: feature.name,
          site: featureData.site,
          usage: 0,
          success: 0,
          failures: 0,
          browsers: new Map()
        });
      }
      
      const stats = dayData.get(key);
      stats.usage += feature.usage || 1;
      stats.success += feature.success || 0;
      stats.failures += feature.failures || 0;
      
      // Track browser-specific usage if available
      if (featureData.userAgent) {
        const userAgent = new UAParser(featureData.userAgent);
        const browserKey = `${userAgent.getBrowser().name} ${userAgent.getBrowser().version}`;
        
        if (!stats.browsers.has(browserKey)) {
          stats.browsers.set(browserKey, 0);
        }
        stats.browsers.set(browserKey, stats.browsers.get(browserKey) + 1);
      }
    });
  }
  
  updateBrowserStats(rumData) {
    const browserKey = `${rumData.browser.name} ${rumData.browser.major}`;
    const siteKey = rumData.site || 'unknown';
    
    if (!this.browserStats.has(siteKey)) {
      this.browserStats.set(siteKey, new Map());
    }
    
    const siteStats = this.browserStats.get(siteKey);
    
    if (!siteStats.has(browserKey)) {
      siteStats.set(browserKey, {
        count: 0,
        lastSeen: rumData.timestamp,
        versions: new Set()
      });
    }
    
    const browserStat = siteStats.get(browserKey);
    browserStat.count += 1;
    browserStat.lastSeen = rumData.timestamp;
    if (rumData.browser.version) {
      browserStat.versions.add(rumData.browser.version);
    }
  }
  
  updatePerformanceData(rumData) {
    if (!rumData.performanceMetrics) return;
    
    const key = rumData.site || 'unknown';
    
    if (!this.performanceData.has(key)) {
      this.performanceData.set(key, {
        samples: 0,
        totalLCP: 0,
        totalFID: 0,
        totalCLS: 0,
        totalFCP: 0,
        features: new Map()
      });
    }
    
    const perfData = this.performanceData.get(key);
    perfData.samples += 1;
    perfData.totalLCP += rumData.performanceMetrics.lcp || 0;
    perfData.totalFID += rumData.performanceMetrics.fid || 0;
    perfData.totalCLS += rumData.performanceMetrics.cls || 0;
    perfData.totalFCP += rumData.performanceMetrics.fcp || 0;
    
    // Track feature-specific performance if available
    if (rumData.usedFeatures) {
      rumData.usedFeatures.forEach(feature => {
        if (!perfData.features.has(feature)) {
          perfData.features.set(feature, {
            samples: 0,
            totalImpact: 0
          });
        }
        
        const featurePerfData = perfData.features.get(feature);
        featurePerfData.samples += 1;
        featurePerfData.totalImpact += rumData.performanceMetrics.lcp || 0;
      });
    }
  }
  
  async getTunedRecommendations(options = {}) {
    const { site, feature } = options;
    
    const recommendations = {
      timestamp: new Date().toISOString(),
      site,
      feature,
      browserSupport: await this.calculateBrowserSupport(site),
      featureRecommendations: await this.getFeatureRecommendations(site, feature),
      baselineCompliance: await this.calculateBaselineCompliance(site),
      riskAssessment: await this.assessRisk(site, feature)
    };
    
    return recommendations;
  }
  
  async calculateBrowserSupport(site) {
    const siteStats = this.browserStats.get(site) || new Map();
    const totalUsers = Array.from(siteStats.values()).reduce((sum, stat) => sum + stat.count, 0);
    
    if (totalUsers === 0) {
      return { message: 'No browser data available for this site' };
    }
    
    const browserSupport = {};
    
    for (const [browserKey, stats] of siteStats) {
      const percentage = (stats.count / totalUsers) * 100;
      browserSupport[browserKey] = {
        usage: percentage.toFixed(2),
        count: stats.count,
        lastSeen: stats.lastSeen
      };
    }
    
    return {
      totalUsers,
      browsers: browserSupport,
      dominantBrowser: this.findDominantBrowser(browserSupport)
    };
  }
  
  async getFeatureRecommendations(site, feature) {
    const recommendations = [];
    
    // Get feature usage data
    const featureData = this.getFeatureUsageData(site, feature);
    
    if (featureData.length === 0) {
      return { message: 'No feature usage data available' };
    }
    
    // Analyze failure rates
    const failureRate = this.calculateFailureRate(featureData);
    
    if (failureRate > 0.05) { // 5% failure rate
      recommendations.push({
        type: 'warning',
        message: `High failure rate detected (${(failureRate * 100).toFixed(1)}%)`,
        suggestion: 'Consider adding feature detection or polyfills'
      });
    }
    
    // Browser compatibility analysis
    const browserCompat = this.analyzeBrowserCompatibility(featureData);
    
    if (browserCompat.unsupportedPercentage > 20) {
      recommendations.push({
        type: 'critical',
        message: `${browserCompat.unsupportedPercentage.toFixed(1)}% of users may not support this feature`,
        suggestion: 'Implement fallback or avoid this feature'
      });
    }
    
    return {
      failureRate,
      browserCompatibility: browserCompat,
      recommendations
    };
  }
  
  async calculateBaselineCompliance(site) {
    const browserSupport = await this.calculateBrowserSupport(site);
    
    if (!browserSupport.browsers) {
      return { compliance: 'unknown', message: 'Insufficient data' };
    }
    
    // Calculate compliance based on browser versions
    let compliantUsers = 0;
    let totalUsers = browserSupport.totalUsers;
    
    for (const [browserKey, stats] of Object.entries(browserSupport.browsers)) {
      const [browserName, version] = browserKey.split(' ');
      
      // Simplified baseline check (in reality, would check against baseline database)
      if (this.isBrowserBaselineCompliant(browserName, version)) {
        compliantUsers += stats.count;
      }
    }
    
    const compliancePercentage = (compliantUsers / totalUsers) * 100;
    
    let level = 'low';
    if (compliancePercentage >= this.baselineThresholds.high) {
      level = 'high';
    } else if (compliancePercentage >= this.baselineThresholds.medium) {
      level = 'medium';
    }
    
    return {
      compliance: level,
      percentage: compliancePercentage.toFixed(1),
      compliantUsers,
      totalUsers
    };
  }
  
  async assessRisk(site, feature) {
    const browserSupport = await this.calculateBrowserSupport(site);
    const featureRecs = await this.getFeatureRecommendations(site, feature);
    
    let riskScore = 0;
    const risks = [];
    
    // Browser diversity risk
    if (browserSupport.browsers) {
      const browserCount = Object.keys(browserSupport.browsers).length;
      if (browserCount > 10) {
        riskScore += 2;
        risks.push('High browser diversity increases compatibility risk');
      }
    }
    
    // Feature failure risk
    if (featureRecs.failureRate > 0.1) {
      riskScore += 3;
      risks.push('High feature failure rate detected');
    }
    
    // Legacy browser risk
    const legacyPercentage = this.calculateLegacyBrowserPercentage(browserSupport);
    if (legacyPercentage > 15) {
      riskScore += 2;
      risks.push(`${legacyPercentage.toFixed(1)}% legacy browser usage`);
    }
    
    let level = 'low';
    if (riskScore >= 5) {
      level = 'high';
    } else if (riskScore >= 3) {
      level = 'medium';
    }
    
    return {
      level,
      score: riskScore,
      risks,
      recommendation: this.getRiskRecommendation(level)
    };
  }
  
  getRiskRecommendation(level) {
    const recommendations = {
      low: 'Proceed with modern web features, monitor usage',
      medium: 'Use feature detection, consider polyfills for critical features',
      high: 'Avoid bleeding-edge features, implement robust fallbacks'
    };
    
    return recommendations[level] || recommendations.medium;
  }
  
  findDominantBrowser(browserSupport) {
    let maxUsage = 0;
    let dominant = null;
    
    for (const [browserKey, stats] of Object.entries(browserSupport)) {
      if (parseFloat(stats.usage) > maxUsage) {
        maxUsage = parseFloat(stats.usage);
        dominant = browserKey;
      }
    }
    
    return { browser: dominant, usage: maxUsage };
  }
  
  isBrowserBaselineCompliant(browserName, version) {
    // Simplified baseline compliance check
    const baselineVersions = {
      'Chrome': 90,
      'Firefox': 90,
      'Safari': 14,
      'Edge': 90
    };
    
    const baselineVersion = baselineVersions[browserName];
    if (!baselineVersion) return false;
    
    const numericVersion = parseInt(version);
    return numericVersion >= baselineVersion;
  }
  
  calculateLegacyBrowserPercentage(browserSupport) {
    if (!browserSupport.browsers) return 0;
    
    let legacyUsers = 0;
    
    for (const [browserKey, stats] of Object.entries(browserSupport.browsers)) {
      const [browserName, version] = browserKey.split(' ');
      
      if (!this.isBrowserBaselineCompliant(browserName, version)) {
        legacyUsers += stats.count;
      }
    }
    
    return (legacyUsers / browserSupport.totalUsers) * 100;
  }
  
  getFeatureUsageData(site, feature) {
    const data = [];
    
    for (const [dayKey, dayData] of this.featureUsage) {
      for (const [key, stats] of dayData) {
        const [statsSite, statsFeature] = key.split(':');
        
        if ((!site || statsSite === site) && (!feature || statsFeature === feature)) {
          data.push({ ...stats, date: dayKey });
        }
      }
    }
    
    return data;
  }
  
  calculateFailureRate(featureData) {
    const totalUsage = featureData.reduce((sum, data) => sum + data.usage, 0);
    const totalFailures = featureData.reduce((sum, data) => sum + data.failures, 0);
    
    return totalUsage > 0 ? totalFailures / totalUsage : 0;
  }
  
  analyzeBrowserCompatibility(featureData) {
    // Simplified browser compatibility analysis
    let totalSamples = 0;
    let unsupportedSamples = 0;
    
    featureData.forEach(data => {
      for (const [browserKey, count] of data.browsers) {
        totalSamples += count;
        
        const [browserName, version] = browserKey.split(' ');
        if (!this.isBrowserBaselineCompliant(browserName, version)) {
          unsupportedSamples += count;
        }
      }
    });
    
    return {
      totalSamples,
      unsupportedSamples,
      unsupportedPercentage: totalSamples > 0 ? (unsupportedSamples / totalSamples) * 100 : 0
    };
  }
  
  getStats() {
    return {
      rumDataPoints: Array.from(this.rumData.values()).reduce((sum, arr) => sum + arr.length, 0),
      featureDataPoints: Array.from(this.featureUsage.values()).reduce((sum, dayData) => sum + dayData.size, 0),
      trackedSites: this.browserStats.size,
      lastUpdate: new Date().toISOString()
    };
  }
  
  async persistData() {
    // Save data to files (in production, use a proper database)
    const data = {
      rumData: Array.from(this.rumData.entries()),
      featureUsage: Array.from(this.featureUsage.entries()).map(([key, value]) => [key, Array.from(value.entries())]),
      browserStats: Array.from(this.browserStats.entries()).map(([key, value]) => [key, Array.from(value.entries())]),
      performanceData: Array.from(this.performanceData.entries())
    };
    
    fs.writeFileSync(path.join(this.dataDir, 'telemetry-data.json'), JSON.stringify(data, null, 2));
  }
  
  loadPersistedData() {
    try {
      const dataFile = path.join(this.dataDir, 'telemetry-data.json');
      if (fs.existsSync(dataFile)) {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        
        this.rumData = new Map(data.rumData || []);
        this.featureUsage = new Map((data.featureUsage || []).map(([key, value]) => [key, new Map(value)]));
        this.browserStats = new Map((data.browserStats || []).map(([key, value]) => [key, new Map(value)]));
        this.performanceData = new Map(data.performanceData || []);
      }
    } catch (error) {
      console.error('Error loading persisted data:', error);
    }
  }
  
  async runScheduledAnalysis() {
    // Run periodic analysis and optimization
    console.log('Running telemetry analysis...');
    
    // Cleanup old data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days
    
    for (const dayKey of this.rumData.keys()) {
      if (new Date(dayKey) < cutoffDate) {
        this.rumData.delete(dayKey);
      }
    }
    
    for (const dayKey of this.featureUsage.keys()) {
      if (new Date(dayKey) < cutoffDate) {
        this.featureUsage.delete(dayKey);
      }
    }
    
    // Persist updated data
    await this.persistData();
  }
  
  async cleanupOldData() {
    // Clean up data older than retention period
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    let cleanedRum = 0;
    let cleanedFeatures = 0;
    
    // Clean RUM data
    for (const dayKey of this.rumData.keys()) {
      if (new Date(dayKey) < cutoffDate) {
        cleanedRum += this.rumData.get(dayKey).length;
        this.rumData.delete(dayKey);
      }
    }
    
    // Clean feature usage data
    for (const dayKey of this.featureUsage.keys()) {
      if (new Date(dayKey) < cutoffDate) {
        cleanedFeatures += this.featureUsage.get(dayKey).size;
        this.featureUsage.delete(dayKey);
      }
    }
    
    console.log(`🧹 Cleaned ${cleanedRum} RUM data points and ${cleanedFeatures} feature usage records`);
    
    await this.persistData();
  }
  
  async shutdown() {
    console.log('Shutting down TelemetryAnalyzer...');
    await this.persistData();
    console.log('Data persisted successfully');
  }
}

module.exports = TelemetryAnalyzer;