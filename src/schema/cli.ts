#!/usr/bin/env node

/**
 * Schema CLI Commands
 *
 * Provides commands for managing database schema:
 * - init: Create a new schema.json
 * - push: Push schema to remote server
 * - pull: Pull schema from remote server
 * - diff: Show differences between local and remote
 * - validate: Validate schema.json
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';

import {
  createInitialSchema,
  readSchema,
  writeSchema,
  schemaExists,
  getSchemaPath,
  updateMetadata,
  readMetadata
} from './parser.js';
import { validateSchema } from './validator.js';
import { SchemaManager } from './manager.js';

const program = new Command();

program
  .name('everyday-cli schema')
  .description('Manage database schema')
  .version('1.0.0');

/**
 * Init command - create new schema.json
 */
program
  .command('init')
  .description('Initialize a new schema.json file')
  .option('-d, --database-id <id>', 'Database ID')
  .option('-n, --database-name <name>', 'Database name')
  .option('-f, --force', 'Overwrite existing schema.json')
  .action(async (options) => {
    try {
      // Check if schema already exists
      if (schemaExists() && !options.force) {
        console.error(chalk.red('✗ schema.json already exists in this directory'));
        console.log(chalk.gray('  Use --force to overwrite'));
        process.exit(1);
      }

      let databaseId = options.databaseId;
      let databaseName = options.databaseName;

      // Prompt for missing values
      if (!databaseId || !databaseName) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'databaseId',
            message: 'Database ID (lowercase, alphanumeric with underscores):',
            default: 'main_db',
            when: !databaseId,
            validate: (input) => {
              if (!/^[a-z0-9_]+$/.test(input)) {
                return 'ID must contain only lowercase letters, numbers, and underscores';
              }
              if (input.length < 1 || input.length > 36) {
                return 'ID must be between 1 and 36 characters';
              }
              return true;
            }
          },
          {
            type: 'input',
            name: 'databaseName',
            message: 'Database name:',
            default: 'Main Database',
            when: !databaseName,
            validate: (input) => {
              if (input.length < 1 || input.length > 128) {
                return 'Name must be between 1 and 128 characters';
              }
              return true;
            }
          }
        ]);

        databaseId = databaseId || answers.databaseId;
        databaseName = databaseName || answers.databaseName;
      }

      // Create schema file
      const schemaPath = createInitialSchema(databaseId, databaseName);

      console.log(chalk.green('✓ Created schema.json'));
      console.log(chalk.gray(`  Location: ${schemaPath}`));
      console.log('');
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray('  1. Edit schema.json to define your collections'));
      console.log(chalk.gray('  2. Run "everyday-cli schema validate" to check for errors'));
      console.log(chalk.gray('  3. Run "everyday-cli schema push" to create the database'));

    } catch (error) {
      console.error(chalk.red('✗ Failed to initialize schema'));
      console.error(chalk.gray(`  ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

/**
 * Validate command - check schema.json for errors
 */
program
  .command('validate')
  .description('Validate schema.json file')
  .option('-p, --path <path>', 'Path to schema.json')
  .action(async (options) => {
    try {
      const schemaPath = options.path || getSchemaPath();
      console.log(chalk.gray(`Validating: ${schemaPath}`));
      console.log('');

      const schema = readSchema(schemaPath);
      const result = validateSchema(schema);

      if (result.valid) {
        console.log(chalk.green('✓ Schema is valid'));

        // Show warnings if any
        if (result.warnings.length > 0) {
          console.log('');
          console.log(chalk.yellow(`⚠ ${result.warnings.length} warning(s):`));
          result.warnings.forEach(warning => {
            console.log(chalk.yellow(`  • ${warning.path}: ${warning.message}`));
          });
        }

        // Show statistics
        console.log('');
        console.log(chalk.cyan('Schema statistics:'));
        console.log(chalk.gray(`  Database: ${schema.database.id}`));
        console.log(chalk.gray(`  Collections: ${schema.collections.length}`));

        const totalAttributes = schema.collections.reduce((sum, c) => sum + c.attributes.length, 0);
        console.log(chalk.gray(`  Total attributes: ${totalAttributes}`));

        const totalIndexes = schema.collections.reduce((sum, c) => sum + (c.indexes?.length || 0), 0);
        console.log(chalk.gray(`  Total indexes: ${totalIndexes}`));

        if (schema.buckets) {
          console.log(chalk.gray(`  Buckets: ${schema.buckets.length}`));
        }

      } else {
        console.log(chalk.red(`✗ Schema has ${result.errors.length} error(s):`));
        console.log('');

        result.errors.forEach(error => {
          console.log(chalk.red(`  ✗ ${error.path}`));
          console.log(chalk.gray(`    ${error.message}`));
        });

        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('✗ Validation failed'));
      console.error(chalk.gray(`  ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

/**
 * Push command - push schema to remote server
 */
program
  .command('push')
  .description('Push schema to remote server')
  .option('-p, --path <path>', 'Path to schema.json')
  .option('--dry-run', 'Show what would be done without actually doing it')
  .option('--api-key <key>', 'API key for authentication')
  .option('--project-id <id>', 'Project ID')
  .option('--endpoint <url>', 'API endpoint URL')
  .action(async (options) => {
    try {
      const schemaPath = options.path || getSchemaPath();
      const schema = readSchema(schemaPath);

      // Validate first
      console.log(chalk.gray('Validating schema...'));
      const validationResult = validateSchema(schema);

      if (!validationResult.valid) {
        console.error(chalk.red('✗ Schema validation failed'));
        console.error(chalk.gray('  Run "everyday-cli schema validate" for details'));
        process.exit(1);
      }

      // Get credentials
      const apiKey = options.apiKey || process.env.EVERYDAY_API_KEY;
      const projectId = options.projectId || process.env.EVERYDAY_PROJECT_ID;
      const endpoint = options.endpoint || process.env.EVERYDAY_ENDPOINT || 'https://provider.everydayseries.ai/v1';

      if (!apiKey || !projectId) {
        console.error(chalk.red('✗ Missing credentials'));
        console.error(chalk.gray('  Provide --api-key and --project-id or set environment variables:'));
        console.error(chalk.gray('    EVERYDAY_API_KEY'));
        console.error(chalk.gray('    EVERYDAY_PROJECT_ID'));
        process.exit(1);
      }

      // Confirm before pushing (unless dry run)
      if (!options.dryRun) {
        console.log('');
        console.log(chalk.cyan('Schema summary:'));
        console.log(chalk.gray(`  Database: ${schema.database.id} (${schema.database.name})`));
        console.log(chalk.gray(`  Collections: ${schema.collections.length}`));
        if (schema.buckets) {
          console.log(chalk.gray(`  Buckets: ${schema.buckets.length}`));
        }
        console.log('');

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Push schema to remote server?',
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.gray('Cancelled'));
          process.exit(0);
        }
      }

      // Push schema
      const spinner = ora({
        text: options.dryRun ? 'Performing dry run...' : 'Pushing schema...',
        color: 'cyan'
      }).start();

      const manager = new SchemaManager({ endpoint, projectId, apiKey });
      const result = await manager.push(schema, options.dryRun || false);

      spinner.stop();

      // Show results
      console.log('');

      if (result.success) {
        console.log(chalk.green('✓ Schema push completed successfully'));
      } else {
        console.log(chalk.red('✗ Schema push completed with errors'));
      }

      console.log('');
      console.log(chalk.cyan('Operations:'));

      // Group operations by type
      const grouped = result.operations.reduce((acc, op) => {
        const key = `${op.resource}_${op.status}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(op);
        return acc;
      }, {} as Record<string, typeof result.operations>);

      Object.entries(grouped).forEach(([key, ops]) => {
        const [resource, status] = key.split('_');
        const icon = status === 'success' ? '✓' : status === 'failed' ? '✗' : '○';
        const color = status === 'success' ? chalk.green : status === 'failed' ? chalk.red : chalk.gray;

        console.log(color(`  ${icon} ${resource}: ${ops.length} ${status}`));
      });

      // Show errors if any
      if (result.errors.length > 0) {
        console.log('');
        console.log(chalk.red('Errors:'));
        result.errors.forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
      }

      // Update metadata
      if (!options.dryRun && result.success) {
        updateMetadata({
          lastPushed: new Date().toISOString()
        }, schemaPath);
      }

      process.exit(result.success ? 0 : 1);

    } catch (error) {
      console.error(chalk.red('✗ Push failed'));
      console.error(chalk.gray(`  ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

/**
 * Pull command - pull schema from remote server
 */
program
  .command('pull')
  .description('Pull schema from remote server')
  .option('-p, --path <path>', 'Path to save schema.json')
  .option('--api-key <key>', 'API key for authentication')
  .option('--project-id <id>', 'Project ID')
  .option('--endpoint <url>', 'API endpoint URL')
  .option('--database-id <id>', 'Database ID to pull')
  .action(async (options) => {
    try {
      // Get credentials
      const apiKey = options.apiKey || process.env.EVERYDAY_API_KEY;
      const projectId = options.projectId || process.env.EVERYDAY_PROJECT_ID;
      const endpoint = options.endpoint || process.env.EVERYDAY_ENDPOINT || 'https://provider.everydayseries.ai/v1';

      if (!apiKey || !projectId) {
        console.error(chalk.red('✗ Missing credentials'));
        console.error(chalk.gray('  Provide --api-key and --project-id or set environment variables'));
        process.exit(1);
      }

      let databaseId = options.databaseId;

      // If no database ID provided, try to get from existing schema
      if (!databaseId) {
        try {
          const existingSchema = readSchema(options.path);
          databaseId = existingSchema.database.id;
        } catch (error) {
          // No existing schema, prompt for database ID
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'databaseId',
              message: 'Database ID to pull:',
              validate: (input) => input.length > 0 || 'Database ID is required'
            }
          ]);
          databaseId = answers.databaseId;
        }
      }

      // Pull schema
      const spinner = ora('Pulling schema from server...').start();

      const manager = new SchemaManager({ endpoint, projectId, apiKey });
      const result = await manager.pull(databaseId);

      spinner.stop();

      if (result.success) {
        // Save to file
        const schemaPath = options.path || path.join(process.cwd(), 'schema.json');
        writeSchema(result.schema, schemaPath);

        updateMetadata({
          lastPulled: new Date().toISOString()
        }, schemaPath);

        console.log(chalk.green('✓ Schema pulled successfully'));
        console.log(chalk.gray(`  Saved to: ${schemaPath}`));
        console.log('');
        console.log(chalk.cyan('Schema summary:'));
        console.log(chalk.gray(`  Database: ${result.schema.database.id}`));
        console.log(chalk.gray(`  Collections: ${result.schema.collections.length}`));
        if (result.schema.buckets) {
          console.log(chalk.gray(`  Buckets: ${result.schema.buckets.length}`));
        }
      }

    } catch (error) {
      console.error(chalk.red('✗ Pull failed'));
      console.error(chalk.gray(`  ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

/**
 * Info command - show schema information
 */
program
  .command('info')
  .description('Show schema information')
  .option('-p, --path <path>', 'Path to schema.json')
  .action(async (options) => {
    try {
      const schemaPath = options.path || getSchemaPath();
      const schema = readSchema(schemaPath);
      const metadata = readMetadata(schemaPath);

      console.log(chalk.cyan('Schema Information'));
      console.log('');
      console.log(chalk.bold('Database:'));
      console.log(chalk.gray(`  ID: ${schema.database.id}`));
      console.log(chalk.gray(`  Name: ${schema.database.name}`));
      console.log('');

      console.log(chalk.bold('Collections: ') + schema.collections.length);
      schema.collections.forEach(collection => {
        console.log('');
        console.log(chalk.cyan(`  ${collection.name} (${collection.id})`));
        console.log(chalk.gray(`    Attributes: ${collection.attributes.length}`));
        console.log(chalk.gray(`    Indexes: ${collection.indexes?.length || 0}`));

        // Show attribute types
        const typeGroups = collection.attributes.reduce((acc, attr) => {
          acc[attr.type] = (acc[attr.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const typeSummary = Object.entries(typeGroups)
          .map(([type, count]) => `${type}(${count})`)
          .join(', ');

        console.log(chalk.gray(`    Types: ${typeSummary}`));
      });

      if (schema.buckets && schema.buckets.length > 0) {
        console.log('');
        console.log(chalk.bold('Buckets: ') + schema.buckets.length);
        schema.buckets.forEach(bucket => {
          console.log(chalk.cyan(`  ${bucket.name} (${bucket.id})`));
        });
      }

      if (metadata) {
        console.log('');
        console.log(chalk.bold('Metadata:'));
        console.log(chalk.gray(`  Version: ${metadata.version}`));
        console.log(chalk.gray(`  Last modified: ${metadata.lastModified}`));
        if (metadata.lastPushed) {
          console.log(chalk.gray(`  Last pushed: ${metadata.lastPushed}`));
        }
        if (metadata.lastPulled) {
          console.log(chalk.gray(`  Last pulled: ${metadata.lastPulled}`));
        }
      }

    } catch (error) {
      console.error(chalk.red('✗ Failed to read schema'));
      console.error(chalk.gray(`  ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

// Export the program for use in main CLI
export { program };

// If run directly, parse and execute
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse(process.argv);
}
