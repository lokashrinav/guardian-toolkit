import * as vscode from 'vscode';
import { BaselineChecker, BaselineResult } from './baselineChecker';

interface UnsafeFeature {
    name: string;
    line: number;
    column: number;
    length: number;
    currentCode: string;
    reason: string;
    safety: string;
}

interface RewriteRule {
    from: RegExp;
    to: string;
    explanation: string;
    feature: string;
}

interface RewriteSuggestion {
    range: vscode.Range;
    newCode: string;
    explanation: string;
    feature: string;
}

export interface RewriteResult {
    hasUnsafeFeatures: boolean;
    unsafeFeatures: UnsafeFeature[];
    rewrites: RewriteSuggestion[];
}

export class CodeRewriter {
    private baselineChecker: BaselineChecker;
    
    // Rewrite rules for common unsafe features
    private rewriteRules: RewriteRule[] = [
        // CSS Grid fallbacks
        {
            from: /display:\s*grid/gi,
            to: 'display: flex; /* Fallback */\n  display: grid;',
            explanation: 'Added flexbox fallback for older browsers',
            feature: 'grid'
        },
        
        // Container queries fallbacks
        {
            from: /@container\s*\([^}]+\)\s*{/gi,
            to: '@supports (container-type: inline-size) {\n    @container $& }',
            explanation: 'Added feature query wrapper for container queries',
            feature: 'container-queries'
        },
        
        // :has() selector fallbacks
        {
            from: /:has\([^)]+\)/gi,
            to: '/* :has() not supported - consider JavaScript alternative */',
            explanation: 'Commented out :has() - use JavaScript for broader support',
            feature: 'has-selector'
        },
        
        // JavaScript fetch to XMLHttpRequest fallback
        {
            from: /fetch\(\s*['"`]([^'"`]+)['"`]\s*\)/gi,
            to: `// Consider using a fetch polyfill or XMLHttpRequest
  if (typeof fetch !== 'undefined') {
    fetch('$1')
  } else {
    // XMLHttpRequest fallback
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '$1');
    xhr.send();
  }`,
            explanation: 'Added fetch availability check with XMLHttpRequest fallback',
            feature: 'fetch'
        },

        // String.replaceAll to replace with global regex
        {
            from: /\.replaceAll\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/gi,
            to: '.replace(new RegExp(\'$1\', \'g\'), \'$2\')',
            explanation: 'Replaced replaceAll() with global regex replace for broader support',
            feature: 'string-replaceall'
        },

        // Promise.allSettled fallback
        {
            from: /Promise\.allSettled\(/gi,
            to: `// Promise.allSettled polyfill needed
  (Promise.allSettled || ((promises) => Promise.all(
    promises.map(p => p.then(value => ({status: 'fulfilled', value}), reason => ({status: 'rejected', reason})))
  )))(`,
            explanation: 'Added Promise.allSettled polyfill for older browsers',
            feature: 'promise-allsettled'
        },

        // Dialog element fallback
        {
            from: /<dialog/gi,
            to: '<!-- Consider using a dialog polyfill -->\n<div role="dialog" aria-modal="true"',
            explanation: 'Replaced <dialog> with ARIA dialog pattern for broader support',
            feature: 'dialog'
        },

        // Lazy loading fallback
        {
            from: /loading="lazy"/gi,
            to: 'data-lazy="true" loading="lazy"',
            explanation: 'Added data attribute for lazy loading polyfill',
            feature: 'lazy-loading'
        }
    ];

    constructor(baselineChecker: BaselineChecker) {
        this.baselineChecker = baselineChecker;
    }

    async analyzeAndRewrite(document: vscode.TextDocument): Promise<RewriteResult> {
        const text = document.getText();
        const unsafeFeatures: UnsafeFeature[] = [];
        const rewrites: RewriteSuggestion[] = [];

        // Analyze document for unsafe features
        for (const rule of this.rewriteRules) {
            let match;
            const regex = new RegExp(rule.from.source, rule.from.flags);
            
            while ((match = regex.exec(text)) !== null) {
                try {
                    // Check if this feature is actually unsafe
                    const result = await this.baselineChecker.checkFeature(rule.feature);
                    
                    if (result.found && result.safety !== 'safe') {
                        const startPos = document.positionAt(match.index);
                        const endPos = document.positionAt(match.index + match[0].length);
                        
                        const unsafeFeature: UnsafeFeature = {
                            name: result.name || rule.feature,
                            line: startPos.line + 1,
                            column: startPos.character + 1,
                            length: match[0].length,
                            currentCode: match[0],
                            reason: result.recommendation || 'Not baseline safe',
                            safety: result.safety
                        };
                        
                        unsafeFeatures.push(unsafeFeature);

                        // Generate rewrite suggestion
                        const rewriteSuggestion: RewriteSuggestion = {
                            range: new vscode.Range(startPos, endPos),
                            newCode: this.processRewriteRule(rule.to, match),
                            explanation: rule.explanation,
                            feature: rule.feature
                        };
                        
                        rewrites.push(rewriteSuggestion);
                    }
                } catch (error) {
                    console.error(`Error analyzing feature ${rule.feature}:`, error);
                }
            }
        }

        return {
            hasUnsafeFeatures: unsafeFeatures.length > 0,
            unsafeFeatures,
            rewrites
        };
    }

    async applyRewrites(editor: vscode.TextEditor, rewrites: RewriteSuggestion[]): Promise<void> {
        if (rewrites.length === 0) {
            return;
        }

        // Sort rewrites by position (reverse order to avoid range invalidation)
        const sortedRewrites = rewrites.sort((a, b) => b.range.start.compareTo(a.range.start));
        
        await editor.edit(editBuilder => {
            for (const rewrite of sortedRewrites) {
                editBuilder.replace(rewrite.range, rewrite.newCode);
            }
        });

        // Show success message with details
        const message = `Applied ${rewrites.length} rewrites. Features updated: ${[...new Set(rewrites.map(r => r.feature))].join(', ')}`;
        vscode.window.showInformationMessage(message);
    }

    async generateCodemod(document: vscode.TextDocument): Promise<string> {
        const rewriteResult = await this.analyzeAndRewrite(document);
        
        if (!rewriteResult.hasUnsafeFeatures) {
            return '// No unsafe features found - no codemod needed';
        }

        let codemod = `// Baseline Safety Codemod
// Generated on ${new Date().toISOString()}
// 
// This codemod updates ${rewriteResult.unsafeFeatures.length} unsafe web features
// to use Baseline-safe alternatives with appropriate fallbacks.

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  
  let hasChanges = false;

`;

        // Generate transformation rules for each unsafe feature
        for (const [index, rewrite] of rewriteResult.rewrites.entries()) {
            const feature = rewriteResult.unsafeFeatures[index];
            
            codemod += `  // Fix: ${feature.name} (${feature.safety})
  // ${rewrite.explanation}
  root.find('${this.escapeForCodemod(feature.currentCode)}')
    .forEach(path => {
      // Replace with baseline-safe alternative
      path.replace('${this.escapeForCodemod(rewrite.newCode)}');
      hasChanges = true;
    });

`;
        }

        codemod += `  return hasChanges ? root.toSource() : undefined;
};`;

        return codemod;
    }

    private processRewriteRule(template: string, match: RegExpMatchArray): string {
        let result = template;
        
        // Replace $1, $2, etc. with capture groups
        for (let i = 1; i < match.length; i++) {
            result = result.replace(new RegExp(`\\$${i}`, 'g'), match[i] || '');
        }
        
        // Replace $& with full match
        result = result.replace(/\$&/g, match[0]);
        
        return result;
    }

    private escapeForCodemod(code: string): string {
        return code
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
    }

    addCustomRewriteRule(rule: RewriteRule): void {
        this.rewriteRules.push(rule);
    }

    getRewriteRules(): RewriteRule[] {
        return [...this.rewriteRules];
    }
}