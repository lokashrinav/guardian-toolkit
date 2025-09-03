const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const TelemetryAnalyzer = require('./lib/TelemetryAnalyzer');

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize telemetry analyzer
const analyzer = new TelemetryAnalyzer();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

// Rate limiting for telemetry ingestion
const telemetryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many telemetry requests, please try again later.'
});

// Apply rate limiting to telemetry endpoints
app.use('/api/telemetry', telemetryLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'telemetry-tuner',
    version: '1.0.0',
    uptime: process.uptime(),
    stats: analyzer.getStats()
  });
});

// Ingest RUM telemetry data
app.post('/api/telemetry/rum', async (req, res) => {
  try {
    const rumData = req.body;
    
    // Validate RUM data structure
    if (!rumData.url || !rumData.userAgent || !rumData.timestamp) {
      return res.status(400).json({
        error: 'Invalid RUM data',
        message: 'Missing required fields: url, userAgent, timestamp'
      });
    }
    
    await analyzer.ingestRumData(rumData);
    
    res.json({
      status: 'success',
      message: 'RUM data ingested successfully'
    });
    
  } catch (error) {
    console.error('Error ingesting RUM data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process RUM data'
    });
  }
});

// Ingest feature usage telemetry
app.post('/api/telemetry/features', async (req, res) => {
  try {
    const featureData = req.body;
    
    // Validate feature data
    if (!featureData.features || !Array.isArray(featureData.features)) {
      return res.status(400).json({
        error: 'Invalid feature data',
        message: 'Missing or invalid features array'
      });
    }
    
    await analyzer.ingestFeatureUsage(featureData);
    
    res.json({
      status: 'success',
      message: 'Feature usage data ingested successfully'
    });
    
  } catch (error) {
    console.error('Error ingesting feature data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process feature data'
    });
  }
});

// Get tuned baseline recommendations based on RUM data
app.get('/api/recommendations', async (req, res) => {
  try {
    const { site, feature } = req.query;
    
    const recommendations = await analyzer.getTunedRecommendations({
      site,
      feature
    });
    
    res.json(recommendations);
    
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate recommendations'
    });
  }
});

// Get browser support analytics
app.get('/api/analytics/browsers', async (req, res) => {
  try {
    const { site, days = 30 } = req.query;
    
    const analytics = await analyzer.getBrowserAnalytics({
      site,
      days: parseInt(days)
    });
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Error getting browser analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get browser analytics'
    });
  }
});

// Get feature usage analytics
app.get('/api/analytics/features', async (req, res) => {
  try {
    const { site, days = 30 } = req.query;
    
    const analytics = await analyzer.getFeatureAnalytics({
      site,
      days: parseInt(days)
    });
    
    res.json(analytics);
    
  } catch (error) {
    console.error('Error getting feature analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get feature analytics'
    });
  }
});

// Get performance impact of features
app.get('/api/analytics/performance', async (req, res) => {
  try {
    const { feature, site } = req.query;
    
    const impact = await analyzer.getPerformanceImpact({
      feature,
      site
    });
    
    res.json(impact);
    
  } catch (error) {
    console.error('Error getting performance analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get performance analytics'
    });
  }
});

// Bulk export analytics data
app.get('/api/export', async (req, res) => {
  try {
    const { format = 'json', site, startDate, endDate } = req.query;
    
    const exportData = await analyzer.exportData({
      format,
      site,
      startDate,
      endDate
    });
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=telemetry-export.csv');
      res.send(exportData);
    } else {
      res.json(exportData);
    }
    
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to export data'
    });
  }
});

// Generate baseline compliance report
app.get('/api/reports/compliance', async (req, res) => {
  try {
    const { site } = req.query;
    
    const report = await analyzer.generateComplianceReport({ site });
    
    res.json(report);
    
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate compliance report'
    });
  }
});

// Client-side telemetry collection script
app.get('/telemetry.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'telemetry-client.js'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.path} does not exist`
  });
});

// Schedule data analysis and cleanup
cron.schedule('0 */6 * * *', async () => {
  console.log('🔄 Running scheduled telemetry analysis...');
  try {
    await analyzer.runScheduledAnalysis();
    console.log('✅ Scheduled analysis completed');
  } catch (error) {
    console.error('❌ Error in scheduled analysis:', error);
  }
});

// Cleanup old data daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('🧹 Running data cleanup...');
  try {
    await analyzer.cleanupOldData();
    console.log('✅ Data cleanup completed');
  } catch (error) {
    console.error('❌ Error in data cleanup:', error);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`📊 Telemetry Tuner Service running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 RUM endpoint: POST http://localhost:${PORT}/api/telemetry/rum`);
  console.log(`🔧 Client script: GET http://localhost:${PORT}/telemetry.js`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Shutting down Telemetry Tuner Service...');
  try {
    await analyzer.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

module.exports = app;