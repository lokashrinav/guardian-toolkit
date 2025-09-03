const express = require('express');
const cors = require('cors');
const axios = require('axios');

const BadgeGenerator = require('./lib/BadgeGenerator');

const app = express();
const PORT = process.env.PORT || 3003;

const badgeGenerator = new BadgeGenerator();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'baseline-health-badge',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Generate badge from scan report
app.get('/badge/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { style = 'flat', label = 'baseline' } = req.query;
    
    // Fetch report from dashboard API (configurable endpoint)
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3001';
    
    let reportData;
    try {
      const response = await axios.get(`${dashboardUrl}/api/reports/${reportId}`);
      reportData = response.data;
    } catch (error) {
      // If report not found, generate an error badge
      const errorBadge = badgeGenerator.generateErrorBadge(label, 'report not found', style);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(errorBadge);
    }
    
    const badge = badgeGenerator.generateReportBadge(reportData, { style, label });
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'max-age=300'); // Cache for 5 minutes
    res.send(badge);
    
  } catch (error) {
    console.error('Error generating badge:', error);
    const errorBadge = badgeGenerator.generateErrorBadge('baseline', 'error', req.query.style);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(errorBadge);
  }
});

// Generate badge from repository scan
app.get('/badge/repo/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { style = 'flat', label = 'baseline', branch = 'main' } = req.query;
    
    // This would integrate with GitHub API to scan the repository
    // For now, we'll generate a sample badge
    const mockScanResults = {
      totalIssues: Math.floor(Math.random() * 10),
      riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      repository: `${owner}/${repo}`,
      branch
    };
    
    const badge = badgeGenerator.generateRepoScanBadge(mockScanResults, { style, label });
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'max-age=900'); // Cache for 15 minutes
    res.send(badge);
    
  } catch (error) {
    console.error('Error generating repo badge:', error);
    const errorBadge = badgeGenerator.generateErrorBadge('baseline', 'error', req.query.style);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(errorBadge);
  }
});

// Generate custom status badge
app.get('/badge/status', async (req, res) => {
  try {
    const { 
      issues = '0',
      risk = 'low',
      style = 'flat',
      label = 'baseline',
      color = 'auto'
    } = req.query;
    
    const statusData = {
      issues: parseInt(issues),
      riskLevel: risk,
      color: color === 'auto' ? null : color
    };
    
    const badge = badgeGenerator.generateStatusBadge(statusData, { style, label });
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'max-age=60'); // Cache for 1 minute
    res.send(badge);
    
  } catch (error) {
    console.error('Error generating status badge:', error);
    const errorBadge = badgeGenerator.generateErrorBadge('baseline', 'error', req.query.style);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(errorBadge);
  }
});

// Generate compliance badge
app.get('/badge/compliance', async (req, res) => {
  try {
    const {
      percentage = '0',
      level = 'unknown',
      style = 'flat',
      label = 'compliance'
    } = req.query;
    
    const complianceData = {
      percentage: parseFloat(percentage),
      level,
      message: `${percentage}%`
    };
    
    const badge = badgeGenerator.generateComplianceBadge(complianceData, { style, label });
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'max-age=300'); // Cache for 5 minutes
    res.send(badge);
    
  } catch (error) {
    console.error('Error generating compliance badge:', error);
    const errorBadge = badgeGenerator.generateErrorBadge('compliance', 'error', req.query.style);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(errorBadge);
  }
});

// Generate feature support badge
app.get('/badge/feature/:feature', async (req, res) => {
  try {
    const { feature } = req.params;
    const { style = 'flat', api = 'http://localhost:3000' } = req.query;
    
    // Check feature support using baseline API
    let featureData;
    try {
      const response = await axios.post(`${api}/isSafe`, { feature }, { timeout: 3000 });
      featureData = response.data;
    } catch (error) {
      const errorBadge = badgeGenerator.generateErrorBadge(feature, 'API unavailable', style);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(errorBadge);
    }
    
    const badge = badgeGenerator.generateFeatureBadge(feature, featureData, { style });
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'max-age=3600'); // Cache for 1 hour
    res.send(badge);
    
  } catch (error) {
    console.error('Error generating feature badge:', error);
    const errorBadge = badgeGenerator.generateErrorBadge(req.params.feature, 'error', req.query.style);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(errorBadge);
  }
});

// Documentation endpoint
app.get('/docs', (req, res) => {
  res.json({
    name: 'Baseline Health Badge API',
    version: '1.0.0',
    endpoints: {
      '/badge/:reportId': {
        description: 'Generate badge from scan report ID',
        parameters: {
          style: 'Badge style (flat, for-the-badge, plastic)',
          label: 'Left side label text'
        },
        example: '/badge/report-123?style=flat&label=baseline'
      },
      '/badge/repo/:owner/:repo': {
        description: 'Generate badge for GitHub repository',
        parameters: {
          style: 'Badge style',
          label: 'Left side label text',
          branch: 'Branch to scan (default: main)'
        },
        example: '/badge/repo/username/project?style=flat'
      },
      '/badge/status': {
        description: 'Generate custom status badge',
        parameters: {
          issues: 'Number of issues',
          risk: 'Risk level (low, medium, high)',
          style: 'Badge style',
          label: 'Left side label text',
          color: 'Custom color (auto for risk-based)'
        },
        example: '/badge/status?issues=3&risk=medium&label=baseline'
      },
      '/badge/compliance': {
        description: 'Generate compliance percentage badge',
        parameters: {
          percentage: 'Compliance percentage',
          level: 'Compliance level',
          style: 'Badge style',
          label: 'Left side label text'
        },
        example: '/badge/compliance?percentage=95&level=high'
      },
      '/badge/feature/:feature': {
        description: 'Generate badge for specific web feature',
        parameters: {
          style: 'Badge style',
          api: 'Baseline API endpoint'
        },
        example: '/badge/feature/resize-observer?style=flat'
      }
    },
    styles: ['flat', 'for-the-badge', 'plastic'],
    colors: {
      low: 'brightgreen',
      medium: 'orange', 
      high: 'red',
      safe: 'brightgreen',
      unsafe: 'red',
      unknown: 'lightgrey'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const errorBadge = badgeGenerator.generateErrorBadge('error', 'server error', 'flat');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(errorBadge);
});

// Start server
app.listen(PORT, () => {
  console.log(`🏥 Health Badge Service running on port ${PORT}`);
  console.log(`🔗 Documentation: http://localhost:${PORT}/docs`);
  console.log(`🏷️  Example badge: http://localhost:${PORT}/badge/status?issues=2&risk=low`);
});

module.exports = app;