import jscodeshift, { Transform, FileInfo, API, Options } from 'jscodeshift';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export interface UnsafeFeature {
  name: string;
  line: number;
  column: number;
  currentCode: string;
  reason: string;
  safety: 'unsafe' | 'caution';
}

export interface Transformation {
  feature: string;
  description: string;
  from: string;
  to: string;
  line: number;
}

export interface TransformResult {
  hasChanges: boolean;
  transformations: Transformation[];
  source: string;
}

export interface AnalysisResult {
  unsafeFeatures: UnsafeFeature[];
  suggestions: string[];
}

export interface TransformOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export class BaselineCodemod {
  private apiEndpoint: string;
  private cache: Map<string, any> = new Map();

  constructor(apiEndpoint = 'http://localhost:3000') {
    this.apiEndpoint = apiEndpoint;
  }

  async transformFile(filePath: string, options: TransformOptions = {}): Promise<TransformResult> {
    const source = fs.readFileSync(filePath, 'utf8');
    const fileInfo: FileInfo = { path: filePath, source };
    
    const transformResult = await this.transformSource(fileInfo, options);
    
    if (transformResult.hasChanges && !options.dryRun) {
      fs.writeFileSync(filePath, transformResult.source);
    }
    
    return transformResult;
  }

  async transformSource(fileInfo: FileInfo, options: TransformOptions = {}): Promise<TransformResult> {
    const transformations: Transformation[] = [];
    let hasChanges = false;
    
    // Create jscodeshift instance
    const j = jscodeshift.withParser('tsx');
    const root = j(fileInfo.source);

    // JavaScript/TypeScript transformations
    if (this.isJSFile(fileInfo.path)) {
      hasChanges = await this.transformJavaScript(root, j, transformations) || hasChanges;
    }
    
    // CSS transformations (for CSS-in-JS or style attributes)
    hasChanges = await this.transformCSS(root, j, transformations) || hasChanges;

    const newSource = hasChanges ? root.toSource() : fileInfo.source;

    return {
      hasChanges,
      transformations,
      source: newSource
    };
  }

  async analyzeFile(filePath: string): Promise<AnalysisResult> {
    const source = fs.readFileSync(filePath, 'utf8');
    const unsafeFeatures: UnsafeFeature[] = [];
    const suggestions: string[] = [];

    // Analyze for unsafe patterns
    const patterns = [
      // JavaScript patterns
      { regex: /fetch\(/g, feature: 'fetch' },
      { regex: /\.replaceAll\(/g, feature: 'string-replaceall' },
      { regex: /Promise\.allSettled/g, feature: 'promise-allsettled' },
      { regex: /ResizeObserver/g, feature: 'resizeobserver' },
      { regex: /IntersectionObserver/g, feature: 'intersectionobserver' },
      
      // CSS patterns
      { regex: /display:\s*grid/g, feature: 'grid' },
      { regex: /container-type:/g, feature: 'container-queries' },
      { regex: /:has\(/g, feature: 'has-selector' },
      { regex: /aspect-ratio:/g, feature: 'aspect-ratio' },
      
      // HTML patterns
      { regex: /<dialog/g, feature: 'dialog' },
      { regex: /loading="lazy"/g, feature: 'lazy-loading' }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(source)) !== null) {
        try {
          const result = await this.checkFeature(pattern.feature);
          
          if (result.found && result.safety !== 'safe') {
            const lines = source.substring(0, match.index).split('\n');
            const line = lines.length;
            const column = lines[lines.length - 1].length + 1;

            unsafeFeatures.push({
              name: result.name || pattern.feature,
              line,
              column,
              currentCode: match[0],
              reason: result.recommendation || 'Not baseline safe',
              safety: result.safety
            });
          }
        } catch (error) {
          console.warn(`Could not check feature ${pattern.feature}:`, (error as Error).message);
        }
      }
    }

    return { unsafeFeatures, suggestions };
  }

  private async transformJavaScript(root: any, j: any, transformations: Transformation[]): Promise<boolean> {
    let hasChanges = false;

    // Transform fetch() to include polyfill check
    const fetchCalls = root.find(j.CallExpression, {
      callee: { name: 'fetch' }
    });

    if (fetchCalls.length > 0) {
      const fetchResult = await this.checkFeature('fetch');
      if (fetchResult.found && fetchResult.safety !== 'safe') {
        fetchCalls.forEach((path: any) => {
          const line = path.value.loc?.start.line || 0;
          
          // Wrap fetch in availability check
          const fetchCheck = j.conditionalExpression(
            j.binaryExpression('!==', 
              j.unaryExpression('typeof', j.identifier('fetch')), 
              j.literal('undefined')
            ),
            path.value,
            j.callExpression(j.identifier('Promise.reject'), [
              j.newExpression(j.identifier('Error'), [j.literal('fetch not supported')])
            ])
          );
          
          path.replace(fetchCheck);
          hasChanges = true;
          
          transformations.push({
            feature: 'fetch',
            description: 'Added fetch availability check',
            from: 'fetch(...)',
            to: 'typeof fetch !== "undefined" ? fetch(...) : Promise.reject(...)',
            line
          });
        });
      }
    }

    // Transform String.replaceAll to global replace
    const replaceAllCalls = root.find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: { name: 'replaceAll' }
      }
    });

    if (replaceAllCalls.length > 0) {
      const replaceAllResult = await this.checkFeature('string-replaceall');
      if (replaceAllResult.found && replaceAllResult.safety !== 'safe') {
        replaceAllCalls.forEach((path: any) => {
          const line = path.value.loc?.start.line || 0;
          const [searchValue, replaceValue] = path.value.arguments;
          
          // Replace with .replace(new RegExp(search, 'g'), replace)
          const globalReplace = j.callExpression(
            j.memberExpression(path.value.callee.object, j.identifier('replace')),
            [
              j.newExpression(j.identifier('RegExp'), [
                searchValue,
                j.literal('g')
              ]),
              replaceValue
            ]
          );
          
          path.replace(globalReplace);
          hasChanges = true;
          
          transformations.push({
            feature: 'string-replaceall',
            description: 'Replaced replaceAll with global regex replace',
            from: '.replaceAll(...)',
            to: '.replace(new RegExp(..., "g"), ...)',
            line
          });
        });
      }
    }

    // Transform Promise.allSettled
    const allSettledCalls = root.find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { name: 'Promise' },
        property: { name: 'allSettled' }
      }
    });

    if (allSettledCalls.length > 0) {
      const allSettledResult = await this.checkFeature('promise-allsettled');
      if (allSettledResult.found && allSettledResult.safety !== 'safe') {
        allSettledCalls.forEach((path: any) => {
          const line = path.value.loc?.start.line || 0;
          
          // Create polyfill
          const polyfill = j.logicalExpression('||',
            j.memberExpression(j.identifier('Promise'), j.identifier('allSettled')),
            j.arrowFunctionExpression(
              [j.identifier('promises')],
              j.callExpression(
                j.memberExpression(j.identifier('Promise'), j.identifier('all')),
                [
                  j.callExpression(
                    j.memberExpression(j.identifier('promises'), j.identifier('map')),
                    [
                      j.arrowFunctionExpression(
                        [j.identifier('p')],
                        j.callExpression(
                          j.memberExpression(j.identifier('p'), j.identifier('then')),
                          [
                            j.arrowFunctionExpression([j.identifier('value')], 
                              j.objectExpression([
                                j.property('init', j.identifier('status'), j.literal('fulfilled')),
                                j.property('init', j.identifier('value'), j.identifier('value'))
                              ])
                            ),
                            j.arrowFunctionExpression([j.identifier('reason')], 
                              j.objectExpression([
                                j.property('init', j.identifier('status'), j.literal('rejected')),
                                j.property('init', j.identifier('reason'), j.identifier('reason'))
                              ])
                            )
                          ]
                        )
                      )
                    ]
                  )
                ]
              )
            )
          );
          
          const polyfillCall = j.callExpression(
            j.parenthesizedExpression(polyfill),
            path.value.arguments
          );
          
          path.replace(polyfillCall);
          hasChanges = true;
          
          transformations.push({
            feature: 'promise-allsettled',
            description: 'Added Promise.allSettled polyfill',
            from: 'Promise.allSettled(...)',
            to: '(Promise.allSettled || polyfill)(...)',
            line
          });
        });
      }
    }

    return hasChanges;
  }

  private async transformCSS(root: any, j: any, transformations: Transformation[]): Promise<boolean> {
    let hasChanges = false;

    // Find template literals and string literals that might contain CSS
    const cssStrings = root.find(j.TemplateLiteral)
      .filter((path: any) => {
        const source = path.value.quasis.map((q: any) => q.value.raw).join('');
        return source.includes('display:') || source.includes('@container') || source.includes(':has(');
      });

    for (let i = 0; i < cssStrings.length; i++) {
      const path = cssStrings.at(i);
      let cssText = path.value.quasis.map((q: any) => q.value.raw).join('${...}');
      let modified = false;

      // Check for CSS Grid
      if (/display:\s*grid/i.test(cssText)) {
        const gridResult = await this.checkFeature('grid');
        if (gridResult.found && gridResult.safety !== 'safe') {
          cssText = cssText.replace(/display:\s*grid/gi, 'display: flex; /* fallback */\n  display: grid;');
          modified = true;
          transformations.push({
            feature: 'grid',
            description: 'Added flexbox fallback for CSS Grid',
            from: 'display: grid',
            to: 'display: flex; /* fallback */\\n  display: grid;',
            line: path.value.loc?.start.line || 0
          });
        }
      }

      // Check for container queries
      if (/@container/.test(cssText)) {
        const containerResult = await this.checkFeature('container-queries');
        if (containerResult.found && containerResult.safety !== 'safe') {
          cssText = cssText.replace(/@container\s*\([^}]+\)\s*{/gi, '@supports (container-type: inline-size) { @container $& }');
          modified = true;
          transformations.push({
            feature: 'container-queries',
            description: 'Added feature query wrapper for container queries',
            from: '@container (...) { }',
            to: '@supports (container-type: inline-size) { @container (...) { } }',
            line: path.value.loc?.start.line || 0
          });
        }
      }

      if (modified) {
        // Update the template literal (simplified - in practice would need to handle expressions)
        const newQuasis = [j.templateElement({ cooked: cssText, raw: cssText }, true)];
        path.value.quasis = newQuasis;
        path.value.expressions = [];
        hasChanges = true;
      }
    }

    return hasChanges;
  }

  private async checkFeature(feature: string): Promise<any> {
    if (this.cache.has(feature)) {
      return this.cache.get(feature);
    }

    try {
      const response = await axios.post(
        `${this.apiEndpoint}/isSafe`,
        { feature },
        { timeout: 5000 }
      );
      
      const result = response.data;
      this.cache.set(feature, result);
      
      // Cache for 5 minutes
      setTimeout(() => this.cache.delete(feature), 5 * 60 * 1000);
      
      return result;
    } catch (error) {
      console.warn(`Could not check feature ${feature}:`, (error as Error).message);
      return { found: false, safety: 'unknown' };
    }
  }

  private isJSFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  generateDefaultRules(): string {
    return `// Baseline Codemod Rules
// Auto-generated transformation rules for making code Baseline-safe

module.exports = {
  // JavaScript transformations
  fetch: {
    pattern: /fetch\\(/g,
    replacement: 'typeof fetch !== "undefined" ? fetch(' : 'xhr(',
    description: 'Add fetch availability check with XHR fallback'
  },
  
  replaceAll: {
    pattern: /\\.replaceAll\\(/g,
    replacement: '.replace(new RegExp(',
    description: 'Use global regex instead of replaceAll'
  },
  
  // CSS transformations
  grid: {
    pattern: /display:\\s*grid/g,
    replacement: 'display: flex; /* fallback */\\n  display: grid',
    description: 'Add flexbox fallback for CSS Grid'
  },
  
  containerQueries: {
    pattern: /@container\\s*\\([^}]+\\)\\s*{/g,
    replacement: '@supports (container-type: inline-size) { @container $& }',
    description: 'Add feature query wrapper'
  }
};`;
  }
}