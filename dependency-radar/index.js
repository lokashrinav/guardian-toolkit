#!/usr/bin/env node

const { Command } = require('commander');
const DependencyRadar = require('./lib/DependencyRadar');
const chalk = require('chalk');

const program = new Command();

program
  .name('dep-radar')
  .description('Scan dependencies for non-baseline web features')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan project dependencies for baseline compatibility')
  .argument('[path]', 'Path to project directory', '.')
  .option('-o, --output <file>', 'Output file for results', 'dependency-radar-report.json')
  .option('--api <url>', 'Baseline API endpoint', 'http://localhost:3000')
  .option('--include-dev', 'Include devDependencies in scan', false)
  .option('--depth <number>', 'Maximum dependency depth to scan', '2')
  .option('--format <type>', 'Output format (json|table|summary)', 'summary')
  .option('-v, --verbose', 'Show verbose output', false)
  .action(async (projectPath, options) => {
    const radar = new DependencyRadar({
      apiEndpoint: options.api,
      includeDev: options.includeDev,
      maxDepth: parseInt(options.depth),
      verbose: options.verbose
    });
    
    console.log(chalk.blue(`🔍 Scanning dependencies in: ${projectPath}`));
    
    try {
      const results = await radar.scanProject(projectPath);
      
      if (options.format === 'json') {
        radar.outputJson(results, options.output);
      } else if (options.format === 'table') {
        radar.outputTable(results);
      } else {
        radar.outputSummary(results);
      }
      
      // Always save JSON report
      if (options.format !== 'json') {
        radar.outputJson(results, options.output);
        console.log(chalk.gray(`📄 Detailed report saved to: ${options.output}`));
      }
      
      // Exit with error code if high-risk dependencies found
      const highRiskCount = results.dependencies.filter(d => d.riskLevel === 'high').length;
      if (highRiskCount > 0) {
        console.log(chalk.red(`\n❌ Found ${highRiskCount} high-risk dependencies`));
        process.exit(1);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error during scan:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check a specific package for baseline compatibility')
  .argument('<package>', 'Package name to check')
  .option('--version <version>', 'Specific version to check')
  .option('--api <url>', 'Baseline API endpoint', 'http://localhost:3000')
  .option('-v, --verbose', 'Show verbose output', false)
  .action(async (packageName, options) => {
    const radar = new DependencyRadar({
      apiEndpoint: options.api,
      verbose: options.verbose
    });
    
    try {
      const result = await radar.checkPackage(packageName, options.version);
      radar.displayPackageInfo(result);
    } catch (error) {
      console.error(chalk.red('❌ Error checking package:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list-risky')
  .description('List commonly risky packages and their alternatives')
  .action(() => {
    const radar = new DependencyRadar();
    radar.displayRiskyPackages();
  });

program.parse();

module.exports = program;