import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import axios from 'axios';
import { parse as parseHtml } from 'node-html-parser';
import { diffLines } from 'diff';
import { RAGKnowledgeBase } from './ragKnowledgeBase';

export interface ReviewConfig {
  githubToken: string;
  openaiApiKey: string;
  baselineApiUrl: string;
  knowledgeBase: RAGKnowledgeBase;
}

export interface ReviewResult {
  success: boolean;
  reviewsPosted: number;
  issuesFound: number;
  suggestions: number;
  errors?: string[];
}

export interface BaselineIssue {
  file: string;
  line: number;
  feature: string;
  safety: 'unsafe' | 'caution';
  message: string;
  suggestion?: string;
  context: string;
}

export class BaselineReviewBot {
  private github: Octokit;
  private openai: OpenAI;
  private baselineApiUrl: string;
  private knowledgeBase: RAGKnowledgeBase;
  private stats = {
    prsReviewed: 0,
    issuesFound: 0,
    suggestionsProvided: 0,
    startTime: Date.now()
  };

  constructor(config: ReviewConfig) {
    this.github = new Octokit({
      auth: config.githubToken
    });
    
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    
    this.baselineApiUrl = config.baselineApiUrl;
    this.knowledgeBase = config.knowledgeBase;
  }

  async reviewPullRequest(owner: string, repo: string, prNumber: number): Promise<ReviewResult> {
    console.log(`🔍 Reviewing PR ${owner}/${repo}#${prNumber}`);
    
    try {
      // Get PR details and files
      const { data: pr } = await this.github.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      const { data: files } = await this.github.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });

      console.log(`📁 Found ${files.length} files in PR`);

      // Analyze each file for Baseline issues
      const allIssues: BaselineIssue[] = [];
      
      for (const file of files) {
        if (file.status === 'removed') continue;
        
        const issues = await this.analyzeFile(file, owner, repo, pr.head.sha);
        allIssues.push(...issues);
      }

      console.log(`⚠️ Found ${allIssues.length} Baseline issues`);

      // Generate AI-powered review comments
      const reviewComments = await this.generateReviewComments(allIssues, pr);

      // Post review comments
      let reviewsPosted = 0;
      const errors: string[] = [];

      if (reviewComments.length > 0) {
        try {
          await this.github.pulls.createReview({
            owner,
            repo,
            pull_number: prNumber,
            event: allIssues.some(i => i.safety === 'unsafe') ? 'REQUEST_CHANGES' : 'COMMENT',
            body: this.generateMainReviewComment(allIssues),
            comments: reviewComments.map(comment => ({
              path: comment.file,
              line: comment.line,
              body: comment.body
            }))
          });
          
          reviewsPosted = 1;
          console.log(`✅ Posted review with ${reviewComments.length} comments`);
          
        } catch (error) {
          console.error('Error posting review:', error);
          errors.push(`Failed to post review: ${error}`);
        }
      } else if (allIssues.length === 0) {
        // Post approval comment for clean PR
        await this.github.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          event: 'APPROVE',
          body: '✅ **Baseline Safety Check Passed!**\\n\\nAll web features used in this PR are Baseline-safe. Great job following modern web standards! 🎉'
        });
        reviewsPosted = 1;
      }

      // Update statistics
      this.stats.prsReviewed++;
      this.stats.issuesFound += allIssues.length;
      this.stats.suggestionsProvided += reviewComments.filter(c => c.body.includes('Suggestion:')).length;

      return {
        success: true,
        reviewsPosted,
        issuesFound: allIssues.length,
        suggestions: reviewComments.filter(c => c.body.includes('Suggestion:')).length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error(`Error reviewing PR ${owner}/${repo}#${prNumber}:`, error);
      return {
        success: false,
        reviewsPosted: 0,
        issuesFound: 0,
        suggestions: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async analyzeFile(file: any, owner: string, repo: string, sha: string): Promise<BaselineIssue[]> {
    const issues: BaselineIssue[] = [];
    
    // Skip binary files and certain file types
    if (file.binary || this.shouldSkipFile(file.filename)) {
      return issues;
    }

    try {
      // Get file content
      const { data: fileData } = await this.github.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: sha
      });

      if ('content' in fileData) {
        const content = Buffer.from(fileData.content, 'base64').toString();
        const lines = content.split('\\n');

        // Analyze content for web features
        const patterns = this.getWebFeaturePatterns();
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          const lineNumber = lineIndex + 1;

          for (const pattern of patterns) {
            const matches = line.match(pattern.regex);
            if (matches) {
              try {
                const result = await this.checkBaselineFeature(pattern.feature);
                
                if (result.found && result.safety !== 'safe') {
                  issues.push({
                    file: file.filename,
                    line: lineNumber,
                    feature: pattern.feature,
                    safety: result.safety,
                    message: result.recommendation || `${pattern.feature} has ${result.safety} Baseline support`,
                    context: line.trim(),
                    suggestion: await this.generateSuggestion(pattern.feature, line, result)
                  });
                }
              } catch (error) {
                console.warn(`Could not check feature ${pattern.feature}:`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Could not analyze file ${file.filename}:`, error);
    }

    return issues;
  }

  private async generateReviewComments(issues: BaselineIssue[], pr: any): Promise<Array<{file: string, line: number, body: string}>> {
    const comments: Array<{file: string, line: number, body: string}> = [];

    for (const issue of issues) {
      // Get relevant knowledge from RAG
      const knowledge = await this.knowledgeBase.queryKnowledge(
        `${issue.feature} browser support compatibility baseline`
      );

      // Generate AI-powered comment
      const prompt = `You are a code review bot specializing in web platform Baseline compatibility.

CONTEXT:
- File: ${issue.file}
- Line ${issue.line}: \`${issue.context}\`
- Feature: ${issue.feature}
- Safety Level: ${issue.safety}
- Issue: ${issue.message}

KNOWLEDGE BASE:
${knowledge.slice(0, 2).map(k => `- ${k.content}`).join('\\n')}

Generate a helpful, constructive code review comment that:
1. Explains the Baseline compatibility concern
2. Provides a specific, actionable solution
3. Includes browser support information
4. Uses a friendly, educational tone
5. Keeps it concise (under 200 words)

Format as markdown with appropriate emoji.`;

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful code review bot focused on web platform Baseline compatibility. Be constructive, specific, and educational.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        });

        const aiComment = response.choices[0]?.message?.content || '';
        
        let finalComment = aiComment;
        
        if (issue.suggestion) {
          finalComment += `\\n\\n**Suggestion:**\\n\`\`\`${this.getFileLanguage(issue.file)}\\n${issue.suggestion}\\n\`\`\``;
        }
        
        finalComment += `\\n\\n*🤖 Generated by Baseline PR Review Bot*`;

        comments.push({
          file: issue.file,
          line: issue.line,
          body: finalComment
        });

      } catch (error) {
        console.error('Error generating AI comment:', error);
        
        // Fallback to basic comment
        const fallbackComment = `${issue.safety === 'unsafe' ? '❌' : '⚠️'} **${issue.feature}** has ${issue.safety} Baseline support.

${issue.message}

${issue.suggestion ? `**Suggestion:**\\n\`\`\`${this.getFileLanguage(issue.file)}\\n${issue.suggestion}\\n\`\`\`` : ''}

*🤖 Generated by Baseline PR Review Bot*`;

        comments.push({
          file: issue.file,
          line: issue.line,
          body: fallbackComment
        });
      }
    }

    return comments;
  }

  private generateMainReviewComment(issues: BaselineIssue[]): string {
    if (issues.length === 0) {
      return '✅ **Baseline Safety Check Passed!**\\n\\nAll web features used in this PR are Baseline-safe. Great job following modern web standards! 🎉';
    }

    const unsafeCount = issues.filter(i => i.safety === 'unsafe').length;
    const cautionCount = issues.filter(i => i.safety === 'caution').length;
    
    let comment = `## 🛡️ Baseline Compatibility Review\\n\\n`;
    
    if (unsafeCount > 0) {
      comment += `❌ **${unsafeCount} unsafe feature${unsafeCount > 1 ? 's' : ''}** found - these may cause issues in older browsers\\n`;
    }
    
    if (cautionCount > 0) {
      comment += `⚠️ **${cautionCount} feature${cautionCount > 1 ? 's' : ''} needing caution** - consider adding fallbacks\\n`;
    }

    comment += `\\n### Summary by Feature:\\n`;
    
    const featureCounts = issues.reduce((acc, issue) => {
      acc[issue.feature] = (acc[issue.feature] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    for (const [feature, count] of Object.entries(featureCounts)) {
      const featureIssues = issues.filter(i => i.feature === feature);
      const unsafeInFeature = featureIssues.filter(i => i.safety === 'unsafe').length;
      const icon = unsafeInFeature > 0 ? '❌' : '⚠️';
      comment += `- ${icon} **${feature}**: ${count} occurrence${count > 1 ? 's' : ''}\\n`;
    }

    comment += `\\n💡 **Tips:**\\n`;
    comment += `- Features marked as "unsafe" lack Baseline support and may break in older browsers\\n`;
    comment += `- Features marked as "caution" have limited Baseline support - consider progressive enhancement\\n`;
    comment += `- Check [web.dev/baseline](https://web.dev/baseline) for the latest compatibility information\\n`;
    comment += `\\n*🤖 Review generated by Baseline PR Review Bot powered by AI and real Baseline data*`;

    return comment;
  }

  private async generateSuggestion(feature: string, originalLine: string, baselineResult: any): Promise<string | undefined> {
    // Simple suggestion mapping - could be enhanced with AI
    const suggestions: Record<string, string> = {
      'fetch': originalLine.replace(/fetch\\(/, 'typeof fetch !== "undefined" ? fetch(') + ' : Promise.reject(new Error("fetch not supported"))',
      'grid': originalLine.replace(/display:\\s*grid/, 'display: flex; /* fallback */\\n  display: grid;'),
      'string-replaceall': originalLine.replace(/\\.replaceAll\\(/, '.replace(new RegExp(').replace(/,\\s*([^)]+)\\)/, ', "g"), $1)'),
      'container-queries': '@supports (container-type: inline-size) {\\n  ' + originalLine + '\\n}',
      'has-selector': originalLine.replace(/:has\\([^)]+\\)/, '/* Use JavaScript for :has() functionality */'),
      'dialog': originalLine.replace(/<dialog/, '<div role="dialog" aria-modal="true"')
    };

    return suggestions[feature];
  }

  private async checkBaselineFeature(feature: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baselineApiUrl}/isSafe`,
        { feature },
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.warn(`Could not check feature ${feature}:`, error);
      return { found: false, safety: 'unknown' };
    }
  }

  private getWebFeaturePatterns() {
    return [
      // JavaScript patterns
      { regex: /fetch\\(/g, feature: 'fetch' },
      { regex: /\\.replaceAll\\(/g, feature: 'string-replaceall' },
      { regex: /Promise\\.allSettled/g, feature: 'promise-allsettled' },
      { regex: /ResizeObserver/g, feature: 'resizeobserver' },
      { regex: /IntersectionObserver/g, feature: 'intersectionobserver' },
      { regex: /navigator\\.clipboard/g, feature: 'async-clipboard' },
      
      // CSS patterns
      { regex: /display:\\s*grid/gi, feature: 'grid' },
      { regex: /display:\\s*subgrid/gi, feature: 'subgrid' },
      { regex: /container-type:/gi, feature: 'container-queries' },
      { regex: /@container/gi, feature: 'container-queries' },
      { regex: /:has\\(/gi, feature: 'has-selector' },
      { regex: /aspect-ratio:/gi, feature: 'aspect-ratio' },
      { regex: /gap:/gi, feature: 'gap' },
      
      // HTML patterns
      { regex: /<dialog/gi, feature: 'dialog' },
      { regex: /loading="lazy"/gi, feature: 'lazy-loading' },
      { regex: /decoding="async"/gi, feature: 'img-decoding' }
    ];
  }

  private shouldSkipFile(filename: string): boolean {
    const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
    const skipPatterns = [
      'node_modules/',
      '.git/',
      'dist/',
      'build/',
      '.min.js',
      '.min.css',
      'package-lock.json',
      'yarn.lock'
    ];

    return skipExtensions.some(ext => filename.endsWith(ext)) ||
           skipPatterns.some(pattern => filename.includes(pattern));
  }

  private getFileLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript', 
      'tsx': 'typescript',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'html': 'html',
      'htm': 'html',
      'vue': 'vue',
      'svelte': 'svelte'
    };
    return langMap[ext] || 'text';
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime
    };
  }
}