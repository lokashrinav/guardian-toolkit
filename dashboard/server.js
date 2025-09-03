const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'), false);
    }
  }
});

// Store reports in memory (in production, use a database)
let reports = [];
const reportsDir = './reports';

// Ensure reports directory exists
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

// Load existing reports on startup
try {
  const files = fs.readdirSync(reportsDir);
  files.filter(f => f.endsWith('.json')).forEach(file => {
    try {
      const data = fs.readFileSync(path.join(reportsDir, file), 'utf8');
      const report = JSON.parse(data);
      report.id = file.replace('.json', '');
      reports.push(report);
    } catch (e) {
      console.log(`Error loading report ${file}:`, e.message);
    }
  });
  console.log(`📊 Loaded ${reports.length} existing reports`);
} catch (e) {
  console.log('No existing reports found');
}

// Routes

// Upload report endpoint
app.post('/api/reports', upload.single('report'), (req, res) => {
  try {
    let reportData;
    
    if (req.file) {
      // File upload
      reportData = JSON.parse(req.file.buffer.toString());
    } else if (req.body) {
      // JSON body
      reportData = req.body;
    } else {
      return res.status(400).json({ error: 'No report data provided' });
    }
    
    // Add metadata
    const report = {
      ...reportData,
      id: `report-${Date.now()}`,
      uploadedAt: new Date().toISOString()
    };
    
    // Save to file and memory
    fs.writeFileSync(path.join(reportsDir, `${report.id}.json`), JSON.stringify(report, null, 2));
    reports.unshift(report); // Add to beginning
    
    // Keep only last 50 reports in memory
    if (reports.length > 50) {
      reports = reports.slice(0, 50);
    }
    
    res.json({ 
      message: 'Report uploaded successfully', 
      id: report.id,
      summary: report.summary
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid JSON data: ' + error.message });
  }
});

// Get all reports
app.get('/api/reports', (req, res) => {
  const summaries = reports.map(r => ({
    id: r.id,
    timestamp: r.timestamp,
    uploadedAt: r.uploadedAt,
    repository: r.repository,
    branch: r.branch,
    commit: r.commit?.substring(0, 7),
    summary: r.summary,
    eslint: {
      totalFiles: r.eslint?.totalFiles || 0,
      totalIssues: r.eslint?.totalIssues || 0
    },
    codemod: {
      totalIssues: r.codemod?.totalIssues || 0
    }
  }));
  
  res.json(summaries);
});

// Get specific report
app.get('/api/reports/:id', (req, res) => {
  const report = reports.find(r => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  res.json(report);
});

// Get dashboard stats
app.get('/api/stats', (req, res) => {
  if (reports.length === 0) {
    return res.json({
      totalReports: 0,
      totalIssues: 0,
      averageIssues: 0,
      riskDistribution: { low: 0, medium: 0, high: 0 }
    });
  }
  
  const totalIssues = reports.reduce((sum, r) => sum + (r.summary?.totalIssues || 0), 0);
  const riskDistribution = reports.reduce((acc, r) => {
    const risk = r.summary?.riskLevel || 'low';
    acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, { low: 0, medium: 0, high: 0 });
  
  res.json({
    totalReports: reports.length,
    totalIssues,
    averageIssues: Math.round(totalIssues / reports.length * 10) / 10,
    riskDistribution
  });
});

// Delete report
app.delete('/api/reports/:id', (req, res) => {
  const index = reports.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  // Remove from file system
  try {
    fs.unlinkSync(path.join(reportsDir, `${req.params.id}.json`));
  } catch (e) {
    console.log('Error deleting file:', e.message);
  }
  
  // Remove from memory
  reports.splice(index, 1);
  res.json({ message: 'Report deleted successfully' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', reports: reports.length });
});

// Start server
app.listen(PORT, () => {
  console.log(`📊 Baseline Dashboard running on port ${PORT}`);
  console.log(`🔗 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
});

module.exports = app;