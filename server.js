const express = require('express');
const cors = require('cors');
const { checkFeature } = require('./checkFeature');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Baseline Hackathon API - AI Layer Foundation',
        version: '1.0.0',
        endpoints: [
            'POST /isSafe - Check if a web feature is safe to use',
            'GET /features/:name - Get detailed feature information'
        ]
    });
});

// Main endpoint: Check if a feature is safe to use
app.post('/isSafe', async (req, res) => {
    try {
        const { feature } = req.body;

        // Validate input
        if (!feature || typeof feature !== 'string') {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Please provide a feature name as a string in the request body',
                example: { feature: 'flexbox' }
            });
        }

        // Check the feature
        const result = await checkFeature(feature);

        // Format response based on safety
        const response = {
            query: feature,
            timestamp: new Date().toISOString(),
            ...result
        };

        // Set appropriate HTTP status based on result
        if (!result.found) {
            return res.status(404).json(response);
        }

        // Add safety-specific information
        response.isSafe = result.safety === 'safe';
        response.canUse = result.safety !== 'unsafe';

        return res.status(200).json(response);

    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process feature check request'
        });
    }
});

// Additional endpoint: Get detailed feature information
app.get('/features/:name', async (req, res) => {
    try {
        const featureName = req.params.name;
        const result = await checkFeature(featureName);

        if (!result.found) {
            return res.status(404).json(result);
        }

        return res.status(200).json({
            query: featureName,
            timestamp: new Date().toISOString(),
            ...result
        });

    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to get feature information'
        });
    }
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
        message: `The endpoint ${req.method} ${req.path} does not exist`,
        availableEndpoints: [
            'POST /isSafe',
            'GET /features/:name'
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Baseline Hackathon API server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/`);
    console.log(`🔍 Test endpoint: POST http://localhost:${PORT}/isSafe`);
    console.log(`📊 Feature details: GET http://localhost:${PORT}/features/:name`);
});

module.exports = app;