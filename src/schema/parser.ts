/**
 * Schema Parser
 *
 * Handles reading and writing schema.json files, with metadata management
 */

import * as fs from 'fs';
import * as path from 'path';
import { SchemaDefinition, SchemaMetadata } from './types.js';

const SCHEMA_FILENAME = 'schema.json';
const METADATA_FILENAME = '.schema-metadata.json';

/**
 * Find schema.json file in current directory or parent directories
 */
export function findSchemaFile(startDir?: string): string | null {
  let currentDir = startDir || process.cwd();

  // Check up to 5 levels up
  for (let i = 0; i < 5; i++) {
    const schemaPath = path.join(currentDir, SCHEMA_FILENAME);
    if (fs.existsSync(schemaPath)) {
      return schemaPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root directory
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Read schema.json file
 */
export function readSchema(schemaPath?: string): SchemaDefinition {
  const resolvedPath = schemaPath || findSchemaFile();

  if (!resolvedPath) {
    throw new Error(
      'Could not find schema.json file. Run "everyday-cli schema init" to create one.'
    );
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Schema file not found at: ${resolvedPath}`);
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const schema = JSON.parse(content);
    return schema;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in schema file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Write schema.json file
 */
export function writeSchema(schema: SchemaDefinition, schemaPath?: string): void {
  const resolvedPath = schemaPath || path.join(process.cwd(), SCHEMA_FILENAME);

  try {
    // Custom JSON serializer that handles BigInt
    const content = JSON.stringify(schema, (key, value) => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      return value;
    }, 2);
    fs.writeFileSync(resolvedPath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write schema file: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Read metadata file
 */
export function readMetadata(schemaPath?: string): SchemaMetadata | null {
  const schemaDir = schemaPath
    ? path.dirname(schemaPath)
    : path.dirname(findSchemaFile() || process.cwd());

  const metadataPath = path.join(schemaDir, METADATA_FILENAME);

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Warning: Could not read metadata file');
    return null;
  }
}

/**
 * Write metadata file
 */
export function writeMetadata(metadata: SchemaMetadata, schemaPath?: string): void {
  const schemaDir = schemaPath
    ? path.dirname(schemaPath)
    : path.dirname(findSchemaFile() || process.cwd());

  const metadataPath = path.join(schemaDir, METADATA_FILENAME);

  try {
    const content = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(metadataPath, content, 'utf-8');
  } catch (error) {
    console.warn('Warning: Could not write metadata file');
  }
}

/**
 * Update metadata with current timestamp
 */
export function updateMetadata(
  updates: Partial<SchemaMetadata>,
  schemaPath?: string
): void {
  const existing = readMetadata(schemaPath);
  const metadata: SchemaMetadata = {
    version: existing?.version || '1.0.0',
    lastModified: new Date().toISOString(),
    ...existing,
    ...updates
  };

  writeMetadata(metadata, schemaPath);
}

/**
 * Create initial schema.json template
 */
export function createInitialSchema(
  databaseId: string,
  databaseName: string,
  projectDir?: string
): string {
  const targetDir = projectDir || process.cwd();
  const schemaPath = path.join(targetDir, SCHEMA_FILENAME);

  if (fs.existsSync(schemaPath)) {
    throw new Error(`Schema file already exists at: ${schemaPath}`);
  }

  const schema: SchemaDefinition = {
    $schema: '@antelligent-app/everyday-cli/schema',
    version: '1.0.0',
    database: {
      id: databaseId,
      name: databaseName,
      enabled: true
    },
    collections: []
  };

  writeSchema(schema, schemaPath);

  // Create initial metadata
  const metadata: SchemaMetadata = {
    version: '1.0.0',
    lastModified: new Date().toISOString()
  };
  writeMetadata(metadata, schemaPath);

  return schemaPath;
}

/**
 * Check if schema file exists in current directory
 */
export function schemaExists(projectDir?: string): boolean {
  const targetDir = projectDir || process.cwd();
  const schemaPath = path.join(targetDir, SCHEMA_FILENAME);
  return fs.existsSync(schemaPath);
}

/**
 * Get schema file path (throws if not found)
 */
export function getSchemaPath(startDir?: string): string {
  const schemaPath = findSchemaFile(startDir);
  if (!schemaPath) {
    throw new Error(
      'Could not find schema.json file. Run "everyday-cli schema init" to create one.'
    );
  }
  return schemaPath;
}

/**
 * Parse schema and return with metadata
 */
export function parseSchemaWithMetadata(schemaPath?: string): {
  schema: SchemaDefinition;
  metadata: SchemaMetadata | null;
  path: string;
} {
  const resolvedPath = schemaPath || getSchemaPath();
  const schema = readSchema(resolvedPath);
  const metadata = readMetadata(resolvedPath);

  return {
    schema,
    metadata,
    path: resolvedPath
  };
}

/**
 * Calculate hash of schema for change detection
 */
export function calculateSchemaHash(schema: SchemaDefinition): string {
  // Create a stable string representation of the schema
  const stableString = JSON.stringify(schema, Object.keys(schema).sort());

  // Simple hash function (in production, use crypto)
  let hash = 0;
  for (let i = 0; i < stableString.length; i++) {
    const char = stableString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(36);
}

/**
 * Compare two schemas and determine if they are equal
 */
export function schemasEqual(schema1: SchemaDefinition, schema2: SchemaDefinition): boolean {
  return calculateSchemaHash(schema1) === calculateSchemaHash(schema2);
}
