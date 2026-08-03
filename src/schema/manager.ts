/**
 * Schema Manager
 *
 * Handles synchronization between schema.json and the remote Appwrite server
 */

import { Client, Databases, Storage, Query, Permission, Role } from 'node-appwrite';
import {
  SchemaDefinition,
  CollectionDefinition,
  AttributeDefinition,
  IndexDefinition,
  BucketDefinition,
  SchemaPushResult,
  SchemaOperation,
  SchemaPullResult,
  SchemaDiff
} from './types.js';

export interface SchemaManagerConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
}

/**
 * Schema Manager - synchronizes schema with Appwrite
 */
export class SchemaManager {
  private client: Client;
  private databases: Databases;
  private storage: Storage;
  private config: SchemaManagerConfig;

  constructor(config: SchemaManagerConfig) {
    this.config = config;

    // Use endpoint as-is - Appwrite needs /v1 in the endpoint
    const endpoint = config.endpoint;

    this.client = new Client()
      .setEndpoint(endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey);

    this.databases = new Databases(this.client);
    this.storage = new Storage(this.client);
  }

  /**
   * Push schema to remote server (create/update database structure)
   */
  async push(schema: SchemaDefinition, dryRun: boolean = false): Promise<SchemaPushResult> {
    const operations: SchemaOperation[] = [];
    const errors: string[] = [];

    try {
      // Step 1: Create/verify database
      const dbOperation = await this.ensureDatabase(schema.database.id, schema.database.name, dryRun);
      operations.push(dbOperation);

      if (dbOperation.status === 'failed') {
        errors.push(dbOperation.error || 'Failed to create database');
        return { success: false, operations, errors };
      }

      // Step 2: Process collections
      for (const collection of schema.collections) {
        const collectionOps = await this.processCollection(
          schema.database.id,
          collection,
          dryRun
        );
        operations.push(...collectionOps);

        // Check for errors
        const failed = collectionOps.find(op => op.status === 'failed');
        if (failed) {
          errors.push(failed.error || `Failed to process collection: ${collection.id}`);
        }
      }

      // Step 3: Process buckets (if any)
      if (schema.buckets) {
        for (const bucket of schema.buckets) {
          const bucketOp = await this.processBucket(bucket, dryRun);
          operations.push(bucketOp);

          if (bucketOp.status === 'failed') {
            errors.push(bucketOp.error || `Failed to process bucket: ${bucket.id}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        operations,
        errors
      };

    } catch (error) {
      errors.push(`Unexpected error: ${error instanceof Error ? error.message : error}`);
      return { success: false, operations, errors };
    }
  }

  /**
   * Pull schema from remote server (read existing database structure)
   */
  async pull(databaseId: string): Promise<SchemaPullResult> {
    try {
      // Fetch database info
      const database = await this.databases.get(databaseId);

      // Fetch all collections
      const collectionsResponse = await this.databases.listCollections(databaseId);

      const collections: CollectionDefinition[] = [];

      for (const collection of collectionsResponse.collections) {
        // Fetch attributes
        const attributesResponse = await this.databases.listAttributes(databaseId, collection.$id);

        // Fetch indexes
        const indexesResponse = await this.databases.listIndexes(databaseId, collection.$id);

        // Map to our schema format
        const collectionDef: CollectionDefinition = {
          id: collection.$id,
          name: collection.name,
          enabled: collection.enabled,
          documentSecurity: collection.documentSecurity,
          permissions: collection.$permissions || [],
          attributes: attributesResponse.attributes.map(this.mapAttributeFromAppwrite),
          indexes: indexesResponse.indexes.map(this.mapIndexFromAppwrite)
        };

        collections.push(collectionDef);
      }

      // Fetch buckets
      const bucketsResponse = await this.storage.listBuckets();
      const buckets: BucketDefinition[] = bucketsResponse.buckets.map(this.mapBucketFromAppwrite);

      const schema: SchemaDefinition = {
        $schema: '@antelligent-app/everyday-cli/schema',
        version: '1.0.0',
        database: {
          id: database.$id,
          name: database.name,
          enabled: database.enabled
        },
        collections,
        buckets: buckets.length > 0 ? buckets : undefined
      };

      return {
        success: true,
        schema
      };

    } catch (error) {
      throw new Error(`Failed to pull schema: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Ensure database exists
   */
  private async ensureDatabase(
    databaseId: string,
    databaseName: string,
    dryRun: boolean
  ): Promise<SchemaOperation> {
    try {
      // Try to get existing database
      await this.databases.get(databaseId);

      return {
        type: 'update',
        resource: 'database',
        resourceId: databaseId,
        status: dryRun ? 'skipped' : 'success',
        message: 'Database already exists'
      };

    } catch (error: any) {
      // Database doesn't exist, create it
      if (error.code === 404) {
        if (dryRun) {
          return {
            type: 'create',
            resource: 'database',
            resourceId: databaseId,
            status: 'skipped',
            message: '[Dry run] Would create database'
          };
        }

        try {
          await this.databases.create(databaseId, databaseName);
          return {
            type: 'create',
            resource: 'database',
            resourceId: databaseId,
            status: 'success',
            message: 'Database created'
          };
        } catch (createError) {
          return {
            type: 'create',
            resource: 'database',
            resourceId: databaseId,
            status: 'failed',
            error: createError instanceof Error ? createError.message : String(createError)
          };
        }
      }

      return {
        type: 'create',
        resource: 'database',
        resourceId: databaseId,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Process a collection (create/update)
   */
  private async processCollection(
    databaseId: string,
    collection: CollectionDefinition,
    dryRun: boolean
  ): Promise<SchemaOperation[]> {
    const operations: SchemaOperation[] = [];

    try {
      // Try to get existing collection
      await this.databases.getCollection(databaseId, collection.id);

      operations.push({
        type: 'update',
        resource: 'collection',
        resourceId: collection.id,
        status: dryRun ? 'skipped' : 'success',
        message: 'Collection already exists'
      });

      // Process attributes and indexes for existing collection
      if (!dryRun) {
        const attrOps = await this.processAttributes(databaseId, collection);
        operations.push(...attrOps);

        const indexOps = await this.processIndexes(databaseId, collection);
        operations.push(...indexOps);
      }

    } catch (error: any) {
      // Collection doesn't exist, create it
      if (error.code === 404) {
        if (dryRun) {
          operations.push({
            type: 'create',
            resource: 'collection',
            resourceId: collection.id,
            status: 'skipped',
            message: '[Dry run] Would create collection'
          });
        } else {
          try {
            // Create collection
            await this.databases.createCollection(
              databaseId,
              collection.id,
              collection.name,
              collection.permissions || [],
              collection.documentSecurity !== undefined ? collection.documentSecurity : false,
              collection.enabled !== undefined ? collection.enabled : true
            );

            operations.push({
              type: 'create',
              resource: 'collection',
              resourceId: collection.id,
              status: 'success',
              message: 'Collection created'
            });

            // Create attributes
            const attrOps = await this.processAttributes(databaseId, collection);
            operations.push(...attrOps);

            // Create indexes (after attributes are created)
            const indexOps = await this.processIndexes(databaseId, collection);
            operations.push(...indexOps);

          } catch (createError) {
            operations.push({
              type: 'create',
              resource: 'collection',
              resourceId: collection.id,
              status: 'failed',
              error: createError instanceof Error ? createError.message : String(createError)
            });
          }
        }
      } else {
        operations.push({
          type: 'create',
          resource: 'collection',
          resourceId: collection.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return operations;
  }

  /**
   * Process attributes for a collection
   */
  private async processAttributes(
    databaseId: string,
    collection: CollectionDefinition
  ): Promise<SchemaOperation[]> {
    const operations: SchemaOperation[] = [];

    // Get existing attributes
    let existingAttributes: any[] = [];
    try {
      const response = await this.databases.listAttributes(databaseId, collection.id);
      existingAttributes = response.attributes;
    } catch (error) {
      // Collection might be new, no attributes yet
    }

    const existingKeys = new Set(existingAttributes.map((a: any) => a.key));

    for (const attr of collection.attributes) {
      if (existingKeys.has(attr.key)) {
        operations.push({
          type: 'update',
          resource: 'attribute',
          resourceId: `${collection.id}.${attr.key}`,
          status: 'success',
          message: 'Attribute already exists'
        });
        continue;
      }

      try {
        await this.createAttribute(databaseId, collection.id, attr);
        operations.push({
          type: 'create',
          resource: 'attribute',
          resourceId: `${collection.id}.${attr.key}`,
          status: 'success',
          message: 'Attribute created'
        });
      } catch (error) {
        operations.push({
          type: 'create',
          resource: 'attribute',
          resourceId: `${collection.id}.${attr.key}`,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return operations;
  }

  /**
   * Create a single attribute
   */
  private async createAttribute(
    databaseId: string,
    collectionId: string,
    attr: AttributeDefinition
  ): Promise<void> {
    const required = attr.required;
    const xdefault = attr.default;
    const array = attr.array || false;

    switch (attr.type) {
      case 'string':
      case 'email':
      case 'url':
      case 'ip':
        await this.databases.createStringAttribute(
          databaseId,
          collectionId,
          attr.key,
          attr.size || 255,
          required,
          xdefault,
          array
        );
        break;

      case 'integer':
        await this.databases.createIntegerAttribute(
          databaseId,
          collectionId,
          attr.key,
          required,
          attr.min,
          attr.max,
          xdefault,
          array
        );
        break;

      case 'float':
        await this.databases.createFloatAttribute(
          databaseId,
          collectionId,
          attr.key,
          required,
          attr.min,
          attr.max,
          xdefault,
          array
        );
        break;

      case 'boolean':
        await this.databases.createBooleanAttribute(
          databaseId,
          collectionId,
          attr.key,
          required,
          xdefault,
          array
        );
        break;

      case 'datetime':
        await this.databases.createDatetimeAttribute(
          databaseId,
          collectionId,
          attr.key,
          required,
          xdefault,
          array
        );
        break;

      case 'enum':
        await this.databases.createEnumAttribute(
          databaseId,
          collectionId,
          attr.key,
          attr.elements || [],
          required,
          xdefault,
          array
        );
        break;

      case 'relationship':
        if (attr.relatedCollection && attr.relationType) {
          await this.databases.createRelationshipAttribute(
            databaseId,
            collectionId,
            attr.relatedCollection,
            attr.relationType as any,
            attr.twoWay,
            attr.key,
            attr.twoWayKey,
            attr.onDelete as any
          );
        }
        break;
    }
  }

  /**
   * Process indexes for a collection
   */
  private async processIndexes(
    databaseId: string,
    collection: CollectionDefinition
  ): Promise<SchemaOperation[]> {
    const operations: SchemaOperation[] = [];

    if (!collection.indexes || collection.indexes.length === 0) {
      return operations;
    }

    // Get existing indexes
    let existingIndexes: any[] = [];
    try {
      const response = await this.databases.listIndexes(databaseId, collection.id);
      existingIndexes = response.indexes;
    } catch (error) {
      // Collection might be new, no indexes yet
    }

    const existingKeys = new Set(existingIndexes.map((i: any) => i.key));

    for (const index of collection.indexes) {
      if (existingKeys.has(index.key)) {
        operations.push({
          type: 'update',
          resource: 'index',
          resourceId: `${collection.id}.${index.key}`,
          status: 'success',
          message: 'Index already exists'
        });
        continue;
      }

      try {
        await this.databases.createIndex(
          databaseId,
          collection.id,
          index.key,
          index.type as any,
          index.attributes,
          index.orders as any[]
        );

        operations.push({
          type: 'create',
          resource: 'index',
          resourceId: `${collection.id}.${index.key}`,
          status: 'success',
          message: 'Index created'
        });
      } catch (error) {
        operations.push({
          type: 'create',
          resource: 'index',
          resourceId: `${collection.id}.${index.key}`,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return operations;
  }

  /**
   * Process a bucket (create/update)
   */
  private async processBucket(
    bucket: BucketDefinition,
    dryRun: boolean
  ): Promise<SchemaOperation> {
    try {
      // Try to get existing bucket
      await this.storage.getBucket(bucket.id);

      return {
        type: 'update',
        resource: 'bucket',
        resourceId: bucket.id,
        status: dryRun ? 'skipped' : 'success',
        message: 'Bucket already exists'
      };

    } catch (error: any) {
      // Bucket doesn't exist, create it
      if (error.code === 404) {
        if (dryRun) {
          return {
            type: 'create',
            resource: 'bucket',
            resourceId: bucket.id,
            status: 'skipped',
            message: '[Dry run] Would create bucket'
          };
        }

        try {
          // Note: createBucket signature in node-appwrite:
          // createBucket(bucketId, name, permissions?, fileSecurity?, enabled?, maximumFileSize?, allowedFileExtensions?, compression?, encryption?, antivirus?)
          const compression = bucket.compression && bucket.compression !== 'none'
            ? bucket.compression as any
            : undefined;

          await this.storage.createBucket(
            bucket.id,
            bucket.name,
            bucket.permissions || [],
            false, // fileSecurity (documentSecurity for buckets)
            bucket.enabled !== undefined ? bucket.enabled : true,
            bucket.maximumFileSize,
            bucket.allowedFileExtensions,
            compression,
            bucket.encryption !== undefined ? bucket.encryption : true,
            bucket.antivirus !== undefined ? bucket.antivirus : true
          );

          return {
            type: 'create',
            resource: 'bucket',
            resourceId: bucket.id,
            status: 'success',
            message: 'Bucket created'
          };
        } catch (createError) {
          return {
            type: 'create',
            resource: 'bucket',
            resourceId: bucket.id,
            status: 'failed',
            error: createError instanceof Error ? createError.message : String(createError)
          };
        }
      }

      return {
        type: 'create',
        resource: 'bucket',
        resourceId: bucket.id,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Map Appwrite attribute to our format
   */
  private mapAttributeFromAppwrite(attr: any): AttributeDefinition {
    // For integer attributes, only include min/max if they are safe integers
    // Appwrite may return values outside JavaScript's safe integer range
    let min = attr.min;
    let max = attr.max;

    if (attr.type === 'integer') {
      // Check if min is a safe integer, otherwise omit it
      if (min !== undefined && !Number.isSafeInteger(min)) {
        console.warn(`Warning: Attribute "${attr.key}" has min value ${min} outside safe integer range. Omitting min from schema.`);
        min = undefined;
      }

      // Check if max is a safe integer, otherwise omit it
      if (max !== undefined && !Number.isSafeInteger(max)) {
        console.warn(`Warning: Attribute "${attr.key}" has max value ${max} outside safe integer range. Omitting max from schema.`);
        max = undefined;
      }
    }

    return {
      key: attr.key,
      type: attr.type,
      required: attr.required,
      array: attr.array,
      size: attr.size,
      min: min,
      max: max,
      default: attr.default,
      elements: attr.elements,
      relatedCollection: attr.relatedCollection,
      relationType: attr.relationType,
      twoWay: attr.twoWay,
      twoWayKey: attr.twoWayKey,
      onDelete: attr.onDelete
    };
  }

  /**
   * Map Appwrite index to our format
   */
  private mapIndexFromAppwrite(index: any): IndexDefinition {
    return {
      key: index.key,
      type: index.type,
      attributes: index.attributes,
      orders: index.orders
    };
  }

  /**
   * Map Appwrite bucket to our format
   */
  private mapBucketFromAppwrite(bucket: any): BucketDefinition {
    return {
      id: bucket.$id,
      name: bucket.name,
      enabled: bucket.enabled,
      maximumFileSize: bucket.maximumFileSize,
      allowedFileExtensions: bucket.allowedFileExtensions,
      compression: bucket.compression ? 'gzip' : 'none',
      encryption: bucket.encryption,
      antivirus: bucket.antivirus,
      permissions: bucket.$permissions || []
    };
  }
}
