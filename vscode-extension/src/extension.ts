import * as vscode from 'vscode';
import axios from 'axios';
import { BaselineChecker } from './baselineChecker';
import { CompletionGuard } from './completionGuard';
import { CodeRewriter } from './codeRewriter';

let baselineChecker: BaselineChecker;
let completionGuard: CompletionGuard;
let codeRewriter: CodeRewriter;

export function activate(context: vscode.ExtensionContext) {
    console.log('Baseline Completion Guard is now active!');

    // Initialize core components
    const config = vscode.workspace.getConfiguration('baselineGuard');
    const apiEndpoint = config.get<string>('apiEndpoint', 'http://localhost:3000');
    
    baselineChecker = new BaselineChecker(apiEndpoint);
    completionGuard = new CompletionGuard(baselineChecker);
    codeRewriter = new CodeRewriter(baselineChecker);

    // Register commands
    const checkFeatureCommand = vscode.commands.registerCommand('baseline-guard.checkFeature', () => {
        checkSelectedFeature();
    });

    const rewriteUnsafeCommand = vscode.commands.registerCommand('baseline-guard.rewriteUnsafe', () => {
        rewriteUnsafeFeatures();
    });

    // Register completion item provider for JavaScript/TypeScript
    const jsCompletionProvider = vscode.languages.registerCompletionItemProvider(
        ['javascript', 'typescript'],
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                return completionGuard.filterCompletions(document, position);
            }
        },
        '.'
    );

    // Register CSS completion provider
    const cssCompletionProvider = vscode.languages.registerCompletionItemProvider(
        ['css', 'scss', 'less'],
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                return completionGuard.filterCSSCompletions(document, position);
            }
        },
        ':'
    );

    // Register diagnostic provider for inline warnings
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('baseline-guard');
    
    const documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (config.get<boolean>('showInlineWarnings', true)) {
            updateDiagnostics(event.document, diagnosticCollection);
        }
    });

    // Register hover provider for feature information
    const hoverProvider = vscode.languages.registerHoverProvider(
        ['javascript', 'typescript', 'css', 'html'],
        {
            provideHover(document: vscode.TextDocument, position: vscode.Position) {
                return completionGuard.provideFeatureHover(document, position);
            }
        }
    );

    // Add to context subscriptions
    context.subscriptions.push(
        checkFeatureCommand,
        rewriteUnsafeCommand,
        jsCompletionProvider,
        cssCompletionProvider,
        documentChangeListener,
        hoverProvider,
        diagnosticCollection
    );

    // Show welcome message
    vscode.window.showInformationMessage('Baseline Completion Guard activated! 🛡️');
}

async function checkSelectedFeature() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    if (!selectedText) {
        vscode.window.showErrorMessage('No text selected');
        return;
    }

    try {
        const result = await baselineChecker.checkFeature(selectedText.trim());
        
        if (result.found) {
            const message = `${result.name}: ${result.safety.toUpperCase()} - ${result.recommendation}`;
            const icon = result.safety === 'safe' ? '✅' : result.safety === 'caution' ? '⚠️' : '❌';
            
            vscode.window.showInformationMessage(`${icon} ${message}`, 'View Details').then(selection => {
                if (selection === 'View Details') {
                    showFeatureDetails(result);
                }
            });
        } else {
            vscode.window.showWarningMessage(`Feature "${selectedText}" not found in Baseline database`);
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error checking feature: ${error}`);
    }
}

async function rewriteUnsafeFeatures() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const document = editor.document;
    const rewriteResult = await codeRewriter.analyzeAndRewrite(document);
    
    if (rewriteResult.hasUnsafeFeatures) {
        const message = `Found ${rewriteResult.unsafeFeatures.length} unsafe features. Apply suggested rewrites?`;
        const choice = await vscode.window.showWarningMessage(message, 'Apply Rewrites', 'Show Details', 'Cancel');
        
        if (choice === 'Apply Rewrites') {
            await codeRewriter.applyRewrites(editor, rewriteResult.rewrites);
            vscode.window.showInformationMessage('✅ Unsafe features rewritten with Baseline-safe alternatives');
        } else if (choice === 'Show Details') {
            showRewriteDetails(rewriteResult);
        }
    } else {
        vscode.window.showInformationMessage('✅ No unsafe features found in current document');
    }
}

function showFeatureDetails(result: any) {
    const panel = vscode.window.createWebviewPanel(
        'baselineFeature',
        `Baseline: ${result.name}`,
        vscode.ViewColumn.Beside,
        {}
    );

    panel.webview.html = generateFeatureHTML(result);
}

function showRewriteDetails(rewriteResult: any) {
    const panel = vscode.window.createWebviewPanel(
        'baselineRewrites',
        'Baseline Rewrite Suggestions',
        vscode.ViewColumn.Beside,
        {}
    );

    panel.webview.html = generateRewriteHTML(rewriteResult);
}

function generateFeatureHTML(result: any): string {
    const safetyColor = result.safety === 'safe' ? '#4CAF50' : result.safety === 'caution' ? '#FF9800' : '#F44336';
    const safetyIcon = result.safety === 'safe' ? '✅' : result.safety === 'caution' ? '⚠️' : '❌';
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
                .safety { color: ${safetyColor}; font-weight: bold; font-size: 1.2em; }
                .baseline { background: #E3F2FD; padding: 10px; border-radius: 4px; margin: 10px 0; }
                .support { background: #F5F5F5; padding: 10px; border-radius: 4px; }
                .browser { display: inline-block; margin: 5px; padding: 5px 10px; background: #2196F3; color: white; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>${safetyIcon} ${result.name}</h1>
            <p class="safety">Safety: ${result.safety.toUpperCase()}</p>
            
            <div class="baseline">
                <h3>Baseline Status</h3>
                <p><strong>Status:</strong> ${result.baseline}</p>
                ${result.baselineLowDate ? `<p><strong>Baseline Low:</strong> ${result.baselineLowDate}</p>` : ''}
                ${result.baselineHighDate ? `<p><strong>Baseline High:</strong> ${result.baselineHighDate}</p>` : ''}
            </div>

            <div class="support">
                <h3>Browser Support</h3>
                ${Object.entries(result.support || {}).map(([browser, version]) => 
                    `<span class="browser">${browser}: ${version}+</span>`
                ).join('')}
            </div>

            <h3>Description</h3>
            <p>${result.description}</p>

            <h3>Recommendation</h3>
            <p>${result.recommendation}</p>

            ${result.spec ? `<p><a href="${result.spec}" target="_blank">View Specification</a></p>` : ''}
        </body>
        </html>
    `;
}

function generateRewriteHTML(rewriteResult: any): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
                .unsafe { background: #FFEBEE; padding: 10px; border-left: 4px solid #F44336; margin: 10px 0; }
                .rewrite { background: #E8F5E8; padding: 10px; border-left: 4px solid #4CAF50; margin: 10px 0; }
                code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
                pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
            </style>
        </head>
        <body>
            <h1>⚠️ Unsafe Features Found</h1>
            ${rewriteResult.unsafeFeatures.map((feature: any, index: number) => `
                <div class="unsafe">
                    <h3>❌ ${feature.name} (Line ${feature.line})</h3>
                    <p><strong>Issue:</strong> ${feature.reason}</p>
                    <p><strong>Current:</strong> <code>${feature.currentCode}</code></p>
                </div>
                <div class="rewrite">
                    <h3>✅ Suggested Fix</h3>
                    <p><strong>Replace with:</strong> <code>${rewriteResult.rewrites[index]?.newCode}</code></p>
                    <p><strong>Why:</strong> ${rewriteResult.rewrites[index]?.explanation}</p>
                </div>
            `).join('')}
        </body>
        </html>
    `;
}

async function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
    const diagnostics: vscode.Diagnostic[] = [];
    
    // Simple pattern matching for common web features
    const featurePatterns = [
        { pattern: /display:\s*grid/gi, feature: 'grid' },
        { pattern: /display:\s*flex/gi, feature: 'flexbox' },
        { pattern: /container-type:/gi, feature: 'container-queries' },
        { pattern: /fetch\(/gi, feature: 'fetch' },
        { pattern: /@supports/gi, feature: 'feature-queries' }
    ];

    const text = document.getText();
    
    for (const { pattern, feature } of featurePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            try {
                const result = await baselineChecker.checkFeature(feature);
                
                if (result.found && result.safety !== 'safe') {
                    const startPos = document.positionAt(match.index);
                    const endPos = document.positionAt(match.index + match[0].length);
                    const range = new vscode.Range(startPos, endPos);
                    
                    const severity = result.safety === 'caution' ? 
                        vscode.DiagnosticSeverity.Warning : 
                        vscode.DiagnosticSeverity.Error;
                    
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `${result.name}: ${result.recommendation}`,
                        severity
                    );
                    
                    diagnostic.source = 'Baseline Guard';
                    diagnostics.push(diagnostic);
                }
            } catch (error) {
                // Silently ignore API errors for diagnostics
            }
        }
    }
    
    collection.set(document.uri, diagnostics);
}

export function deactivate() {
    console.log('Baseline Completion Guard deactivated');
}