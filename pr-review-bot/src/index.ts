import express from 'express';
import { Webhooks } from '@octokit/webhooks';
import { BaselineReviewBot } from './baselineReviewBot';
import { RAGKnowledgeBase } from './ragKnowledgeBase';

const app = express();
const PORT = process.env.PORT || 3001;

// Environment variables
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'your-webhook-secret';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const BASELINE_API_URL = process.env.BASELINE_API_URL || 'http://localhost:3000';

// Initialize components
const ragKB = new RAGKnowledgeBase();
const reviewBot = new BaselineReviewBot({
  githubToken: GITHUB_TOKEN,
  openaiApiKey: OPENAI_API_KEY,
  baselineApiUrl: BASELINE_API_URL,
  knowledgeBase: ragKB
});

const webhooks = new Webhooks({
  secret: GITHUB_WEBHOOK_SECRET
});

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Baseline PR Review Bot',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'POST /webhooks - GitHub webhook handler',
      'GET /stats - Bot statistics',
      'POST /review/:owner/:repo/:pr - Manual PR review trigger'
    ]
  });
});

// GitHub webhook handler
app.post('/webhooks', webhooks.middleware);

// Manual review trigger
app.post('/review/:owner/:repo/:pr', async (req, res) => {
  try {
    const { owner, repo, pr } = req.params;
    const prNumber = parseInt(pr);
    
    console.log(`📝 Manual review triggered for ${owner}/${repo}#${prNumber}`);
    
    const result = await reviewBot.reviewPullRequest(owner, repo, prNumber);
    
    res.json({
      success: true,
      message: 'Review completed',
      result
    });
  } catch (error) {
    console.error('Manual review error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bot statistics
app.get('/stats', (req, res) => {
  const stats = reviewBot.getStats();
  res.json(stats);
});

// Knowledge base endpoints
app.get('/knowledge', (req, res) => {
  const knowledge = ragKB.getKnowledgeSummary();
  res.json(knowledge);
});

app.post('/knowledge/update', async (req, res) => {
  try {
    await ragKB.updateKnowledgeBase();
    res.json({ success: true, message: 'Knowledge base updated' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Update failed' 
    });
  }
});

// Webhook event handlers
webhooks.on('pull_request.opened', async ({ payload }) => {
  try {
    console.log(`🔍 New PR opened: ${payload.repository.full_name}#${payload.pull_request.number}`);
    
    await reviewBot.reviewPullRequest(
      payload.repository.owner.login,
      payload.repository.name,
      payload.pull_request.number
    );
  } catch (error) {
    console.error('Error reviewing opened PR:', error);
  }
});

webhooks.on('pull_request.synchronize', async ({ payload }) => {
  try {
    console.log(`🔄 PR updated: ${payload.repository.full_name}#${payload.pull_request.number}`);
    
    await reviewBot.reviewPullRequest(
      payload.repository.owner.login,
      payload.repository.name,
      payload.pull_request.number
    );
  } catch (error) {
    console.error('Error reviewing updated PR:', error);
  }
});

// Error handling
webhooks.on('error', (error) => {
  console.error('Webhook error:', error);
});

webhooks.onAny(({ name, payload }) => {
  console.log(`📡 Received webhook: ${name}`);
});

// Start server
app.listen(PORT, async () => {
  console.log(`🤖 Baseline PR Review Bot listening on port ${PORT}`);
  console.log(`📚 Initializing knowledge base...`);
  
  try {
    await ragKB.initialize();
    console.log(`✅ Knowledge base initialized`);
    console.log(`🚀 Bot ready to review PRs!`);
  } catch (error) {
    console.error(`❌ Failed to initialize knowledge base:`, error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Gracefully shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 Gracefully shutting down...');
  process.exit(0);
});

export default app;