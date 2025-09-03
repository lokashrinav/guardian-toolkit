#!/usr/bin/env node

import { Command } from 'commander';
import { BaselineCodemod } from './baselineCodemod';
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('baseline-codemod')
  .description('Automatically rewrite unsafe web features with Baseline-safe alternatives')
  .version('1.0.0');

program
  .command('transform')
  .description('Transform files to use Baseline-safe web features')
  .argument('<files>', 'File patterns to transform (e.g., "src/**/*.js")')
  .option('-d, --dry-run', 'Show what would be changed without modifying files')
  .option('-v, --verbose', 'Show detailed transformation information')
  .option('--api <url>', 'Baseline API endpoint', 'http://localhost:3000')
  .action(async (filePattern: string, options) => {
    try {
      const files = await glob(filePattern);
      
      if (files.length === 0) {
        console.log(chalk.yellow('No files found matching pattern:', filePattern));
        return;
      }

      console.log(chalk.blue(`🔍 Found ${files.length} files to analyze`));
      
      const codemod = new BaselineCodemod(options.api);
      let totalTransformations = 0;
      let totalFiles = 0;

      for (const file of files) {
        if (options.verbose) {
          console.log(chalk.gray(`\nAnalyzing: ${file}`));
        }

        const result = await codemod.transformFile(file, {
          dryRun: options.dryRun,
          verbose: options.verbose
        });

        if (result.hasChanges) {
          totalFiles++;
          totalTransformations += result.transformations.length;
          
          console.log(chalk.green(`✅ ${file}: ${result.transformations.length} transformations`));
          
          if (options.verbose) {
            result.transformations.forEach(t => {
              console.log(chalk.gray(`   → ${t.feature}: ${t.description}`));
            });
          }
        } else if (options.verbose) {
          console.log(chalk.gray(`   ℹ No unsafe features found`));
        }
      }

      // Summary
      console.log(chalk.blue(`\n📊 Summary:`));
      console.log(`   Files processed: ${files.length}`);
      console.log(`   Files modified: ${totalFiles}`);
      console.log(`   Total transformations: ${totalTransformations}`);
      
      if (options.dryRun) {
        console.log(chalk.yellow('   (Dry run - no files were actually modified)'));
      }

    } catch (error) {
      console.error(chalk.red('Error during transformation:'), error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze files for unsafe web features without modifying them')
  .argument('<files>', 'File patterns to analyze')
  .option('--api <url>', 'Baseline API endpoint', 'http://localhost:3000')
  .option('--report', 'Generate detailed report')
  .action(async (filePattern: string, options) => {
    try {
      const files = await glob(filePattern);
      const codemod = new BaselineCodemod(options.api);
      
      let report: any = {
        totalFiles: files.length,
        filesWithIssues: 0,
        totalIssues: 0,
        issuesByFeature: {},
        issuesBySafety: { unsafe: 0, caution: 0 }
      };

      for (const file of files) {
        const analysis = await codemod.analyzeFile(file);
        
        if (analysis.unsafeFeatures.length > 0) {
          report.filesWithIssues++;
          report.totalIssues += analysis.unsafeFeatures.length;
          
          console.log(chalk.yellow(`⚠️  ${file}:`));
          
          analysis.unsafeFeatures.forEach(feature => {
            const icon = feature.safety === 'unsafe' ? '❌' : '⚠️';
            console.log(`   ${icon} Line ${feature.line}: ${feature.name} (${feature.safety})`);
            console.log(`      ${chalk.gray(feature.reason)}`);
            
            // Update report
            if (!report.issuesByFeature[feature.name]) {
              report.issuesByFeature[feature.name] = 0;
            }
            report.issuesByFeature[feature.name]++;
            
            if (feature.safety === 'unsafe') {
              report.issuesBySafety.unsafe++;
            } else if (feature.safety === 'caution') {
              report.issuesBySafety.caution++;
            }
          });
        }
      }

      // Print summary
      console.log(chalk.blue(`\n📊 Analysis Summary:`));
      console.log(`   Files analyzed: ${report.totalFiles}`);
      console.log(`   Files with issues: ${report.filesWithIssues}`);
      console.log(`   Total issues: ${report.totalIssues}`);
      console.log(`   Unsafe features: ${report.issuesBySafety.unsafe}`);
      console.log(`   Features needing caution: ${report.issuesBySafety.caution}`);

      if (options.report) {
        const reportPath = 'baseline-analysis-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(chalk.green(`📄 Detailed report saved to: ${reportPath}`));
      }

    } catch (error) {
      console.error(chalk.red('Error during analysis:'), error);
      process.exit(1);
    }
  });

program
  .command('generate-rules')
  .description('Generate custom transformation rules from examples')
  .option('-o, --output <file>', 'Output file for rules', 'baseline-rules.js')
  .action((options) => {
    const codemod = new BaselineCodemod();
    const rules = codemod.generateDefaultRules();
    
    fs.writeFileSync(options.output, rules);
    console.log(chalk.green(`✅ Generated transformation rules: ${options.output}`));
  });

program.parse();

export default program;