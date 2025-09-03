import * as vscode from 'vscode';
import { BaselineChecker, BaselineResult } from './baselineChecker';

interface FeaturePattern {
    pattern: RegExp;
    feature: string;
    context: 'css' | 'js' | 'html';
}

export class CompletionGuard {
    private baselineChecker: BaselineChecker;
    private featurePatterns: FeaturePattern[] = [
        // CSS Features
        { pattern: /display:\s*(grid|flex|subgrid)/i, feature: '$1', context: 'css' },
        { pattern: /container-(type|name|query):/i, feature: 'container-queries', context: 'css' },
        { pattern: /@supports/i, feature: 'feature-queries', context: 'css' },
        { pattern: /:has\(/i, feature: 'has-selector', context: 'css' },
        { pattern: /aspect-ratio:/i, feature: 'aspect-ratio', context: 'css' },
        { pattern: /gap:/i, feature: 'gap', context: 'css' },
        { pattern: /place-items:/i, feature: 'place-items', context: 'css' },
        
        // JavaScript Features  
        { pattern: /fetch\(/i, feature: 'fetch', context: 'js' },
        { pattern: /\.replaceAll\(/i, feature: 'string-replaceall', context: 'js' },
        { pattern: /Promise\.allSettled/i, feature: 'promise-allsettled', context: 'js' },
        { pattern: /matchAll\(/i, feature: 'string-matchall', context: 'js' },
        { pattern: /ResizeObserver/i, feature: 'resizeobserver', context: 'js' },
        { pattern: /IntersectionObserver/i, feature: 'intersectionobserver', context: 'js' },
        { pattern: /navigator\.clipboard/i, feature: 'async-clipboard', context: 'js' },
        
        // HTML Features
        { pattern: /<dialog/i, feature: 'dialog', context: 'html' },
        { pattern: /loading="lazy"/i, feature: 'lazy-loading', context: 'html' },
        { pattern: /decoding="async"/i, feature: 'img-decoding', context: 'html' }
    ];

    constructor(baselineChecker: BaselineChecker) {
        this.baselineChecker = baselineChecker;
    }

    async filterCompletions(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
        const line = document.lineAt(position).text;
        const detectedFeatures = this.detectFeatures(line, 'js');
        
        if (detectedFeatures.length === 0) {
            return [];
        }

        const results = await this.baselineChecker.batchCheckFeatures(detectedFeatures);
        const completions: vscode.CompletionItem[] = [];

        for (let i = 0; i < detectedFeatures.length; i++) {
            const feature = detectedFeatures[i];
            const result = results[i];

            if (result.found) {
                const completion = new vscode.CompletionItem(
                    feature,
                    vscode.CompletionItemKind.Method
                );

                completion.detail = `Baseline: ${result.baseline || 'unknown'}`;
                completion.documentation = new vscode.MarkdownString(
                    this.createFeatureMarkdown(result)
                );

                // Add warning for unsafe features
                if (result.safety !== 'safe') {
                    completion.tags = [vscode.CompletionItemTag.Deprecated];
                    completion.detail += ` ⚠️ ${result.safety.toUpperCase()}`;
                }

                completions.push(completion);
            }
        }

        return completions;
    }

    async filterCSSCompletions(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
        const line = document.lineAt(position).text;
        const detectedFeatures = this.detectFeatures(line, 'css');
        
        if (detectedFeatures.length === 0) {
            return [];
        }

        const results = await this.baselineChecker.batchCheckFeatures(detectedFeatures);
        const completions: vscode.CompletionItem[] = [];

        for (let i = 0; i < detectedFeatures.length; i++) {
            const feature = detectedFeatures[i];
            const result = results[i];

            if (result.found) {
                const completion = new vscode.CompletionItem(
                    feature,
                    vscode.CompletionItemKind.Property
                );

                completion.detail = `Baseline: ${result.baseline || 'unknown'}`;
                completion.documentation = new vscode.MarkdownString(
                    this.createFeatureMarkdown(result)
                );

                // Color-code by safety
                const safetyIcon = result.safety === 'safe' ? '✅' : 
                                 result.safety === 'caution' ? '⚠️' : '❌';
                completion.label = `${safetyIcon} ${feature}`;

                if (result.safety !== 'safe') {
                    completion.tags = [vscode.CompletionItemTag.Deprecated];
                }

                completions.push(completion);
            }
        }

        return completions;
    }

    async provideFeatureHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }

        const word = document.getText(range);
        const languageId = document.languageId;
        const context = this.getContextFromLanguage(languageId);
        
        // Check if this word matches any known feature patterns
        const detectedFeature = this.detectFeatureFromWord(word, context);
        if (!detectedFeature) {
            return undefined;
        }

        try {
            const result = await this.baselineChecker.checkFeature(detectedFeature);
            
            if (result.found) {
                const markdown = new vscode.MarkdownString(this.createFeatureMarkdown(result));
                markdown.isTrusted = true;
                
                return new vscode.Hover(markdown, range);
            }
        } catch (error) {
            console.error('Error providing hover information:', error);
        }

        return undefined;
    }

    private detectFeatures(text: string, context: 'css' | 'js' | 'html'): string[] {
        const features: string[] = [];
        
        for (const pattern of this.featurePatterns) {
            if (pattern.context === context || pattern.context === 'html') {
                const matches = text.match(pattern.pattern);
                if (matches) {
                    let feature = pattern.feature;
                    if (feature.includes('$1') && matches[1]) {
                        feature = feature.replace('$1', matches[1].toLowerCase());
                    }
                    features.push(feature);
                }
            }
        }
        
        return [...new Set(features)]; // Remove duplicates
    }

    private detectFeatureFromWord(word: string, context: 'css' | 'js' | 'html'): string | undefined {
        // Simple mapping of common words to features
        const featureMap: { [key: string]: string } = {
            'grid': 'grid',
            'flexbox': 'flexbox', 
            'flex': 'flexbox',
            'fetch': 'fetch',
            'dialog': 'dialog',
            'gap': 'gap',
            'subgrid': 'subgrid'
        };

        return featureMap[word.toLowerCase()];
    }

    private getContextFromLanguage(languageId: string): 'css' | 'js' | 'html' {
        if (['css', 'scss', 'less'].includes(languageId)) {
            return 'css';
        } else if (['javascript', 'typescript'].includes(languageId)) {
            return 'js';
        } else {
            return 'html';
        }
    }

    private createFeatureMarkdown(result: BaselineResult): string {
        const safetyIcon = result.safety === 'safe' ? '✅' : 
                          result.safety === 'caution' ? '⚠️' : '❌';
        
        let markdown = `## ${safetyIcon} ${result.name}\n\n`;
        
        if (result.description) {
            markdown += `${result.description}\n\n`;
        }

        markdown += `**Safety:** ${result.safety.toUpperCase()}\n`;
        markdown += `**Baseline:** ${result.baseline || 'unknown'}\n\n`;

        if (result.support) {
            markdown += `**Browser Support:**\n`;
            for (const [browser, version] of Object.entries(result.support)) {
                markdown += `- ${browser}: ${version}+\n`;
            }
            markdown += '\n';
        }

        if (result.recommendation) {
            markdown += `**Recommendation:** ${result.recommendation}\n\n`;
        }

        if (result.spec) {
            markdown += `[View Specification](${result.spec})`;
        }

        return markdown;
    }
}