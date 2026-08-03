/**
 * Schema Validator
 *
 * Validates schema.json files to ensure they are correctly formatted
 * and contain valid configurations.
 */

import {
  SchemaDefinition,
  SchemaValidationResult,
  SchemaValidationError,
  SchemaValidationWarning,
  AttributeDefinition,
  CollectionDefinition,
  IndexDefinition,
  BucketDefinition,
  AttributeType
} from './types.js';

/**
 * Validate a complete schema definition
 */
export function validateSchema(schema: any): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationWarning[] = [];

  // Validate root structure
  if (!schema || typeof schema !== 'object') {
    errors.push({
      path: '$',
      message: 'Schema must be an object',
      code: 'INVALID_ROOT'
    });
    return { valid: false, errors, warnings };
  }

  // Validate required root fields
  validateRequiredField(schema, '$schema', 'string', errors);
  validateRequiredField(schema, 'version', 'string', errors);
  validateRequiredField(schema, 'database', 'object', errors);
  validateRequiredField(schema, 'collections', 'array', errors);

  // Validate database configuration
  if (schema.database) {
    validateDatabase(schema.database, errors, warnings);
  }

  // Validate collections
  if (Array.isArray(schema.collections)) {
    validateCollections(schema.collections, errors, warnings);
  }

  // Validate buckets (optional)
  if (schema.buckets && Array.isArray(schema.buckets)) {
    validateBuckets(schema.buckets, errors, warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate database configuration
 */
function validateDatabase(
  database: any,
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  const path = 'database';

  validateRequiredField(database, 'id', 'string', errors, path);
  validateRequiredField(database, 'name', 'string', errors, path);

  if (database.id) {
    validateId(database.id, `${path}.id`, errors);
  }

  if (database.name) {
    validateName(database.name, `${path}.name`, errors);
  }

  if (database.enabled !== undefined && typeof database.enabled !== 'boolean') {
    errors.push({
      path: `${path}.enabled`,
      message: 'enabled must be a boolean',
      code: 'INVALID_TYPE'
    });
  }
}

/**
 * Validate collections array
 */
function validateCollections(
  collections: any[],
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  const collectionIds = new Set<string>();

  collections.forEach((collection, index) => {
    const path = `collections[${index}]`;

    if (typeof collection !== 'object' || collection === null) {
      errors.push({
        path,
        message: 'Collection must be an object',
        code: 'INVALID_TYPE'
      });
      return;
    }

    validateCollection(collection, path, errors, warnings);

    // Check for duplicate IDs
    if (collection.id) {
      if (collectionIds.has(collection.id)) {
        errors.push({
          path: `${path}.id`,
          message: `Duplicate collection ID: ${collection.id}`,
          code: 'DUPLICATE_ID'
        });
      }
      collectionIds.add(collection.id);
    }
  });
}

/**
 * Validate a single collection
 */
function validateCollection(
  collection: CollectionDefinition,
  path: string,
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  validateRequiredField(collection, 'id', 'string', errors, path);
  validateRequiredField(collection, 'name', 'string', errors, path);
  validateRequiredField(collection, 'attributes', 'array', errors, path);

  if (collection.id) {
    validateId(collection.id, `${path}.id`, errors);
  }

  if (collection.name) {
    validateName(collection.name, `${path}.name`, errors);
  }

  // Validate permissions
  if (collection.permissions && Array.isArray(collection.permissions)) {
    collection.permissions.forEach((perm, i) => {
      if (typeof perm !== 'string') {
        errors.push({
          path: `${path}.permissions[${i}]`,
          message: 'Permission must be a string',
          code: 'INVALID_TYPE'
        });
      }
    });
  }

  // Validate attributes
  if (Array.isArray(collection.attributes)) {
    validateAttributes(collection.attributes, `${path}.attributes`, errors, warnings);
  }

  // Validate indexes
  if (collection.indexes && Array.isArray(collection.indexes)) {
    validateIndexes(collection.indexes, collection.attributes || [], `${path}.indexes`, errors, warnings);
  }
}

/**
 * Validate attributes array
 */
function validateAttributes(
  attributes: any[],
  path: string,
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  const attributeKeys = new Set<string>();

  attributes.forEach((attr, index) => {
    const attrPath = `${path}[${index}]`;

    if (typeof attr !== 'object' || attr === null) {
      errors.push({
        path: attrPath,
        message: 'Attribute must be an object',
        code: 'INVALID_TYPE'
      });
      return;
    }

    validateAttribute(attr, attrPath, errors, warnings);

    // Check for duplicate keys
    if (attr.key) {
      if (attributeKeys.has(attr.key)) {
        errors.push({
          path: `${attrPath}.key`,
          message: `Duplicate attribute key: ${attr.key}`,
          code: 'DUPLICATE_KEY'
        });
      }
      attributeKeys.add(attr.key);
    }
  });
}

/**
 * Validate a single attribute
 */
function validateAttribute(
  attr: AttributeDefinition,
  path: string,
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  validateRequiredField(attr, 'key', 'string', errors, path);
  validateRequiredField(attr, 'type', 'string', errors, path);
  validateRequiredField(attr, 'required', 'boolean', errors, path);

  if (attr.key) {
    validateKey(attr.key, `${path}.key`, errors);
  }

  // Validate type
  if (attr.type) {
    const validTypes: AttributeType[] = [
      'string', 'email', 'url', 'ip',
      'integer', 'float', 'boolean', 'datetime',
      'enum', 'relationship'
    ];

    if (!validTypes.includes(attr.type)) {
      errors.push({
        path: `${path}.type`,
        message: `Invalid attribute type: ${attr.type}. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_ATTRIBUTE_TYPE'
      });
    }

    // Type-specific validation
    if (attr.type === 'string' || attr.type === 'email' || attr.type === 'url' || attr.type === 'ip') {
      if (attr.size !== undefined) {
        if (typeof attr.size !== 'number' || attr.size <= 0) {
          errors.push({
            path: `${path}.size`,
            message: 'size must be a positive number',
            code: 'INVALID_SIZE'
          });
        }
      } else {
        warnings.push({
          path: `${path}.size`,
          message: 'size is recommended for string types',
          code: 'MISSING_SIZE'
        });
      }
    }

    if (attr.type === 'integer' || attr.type === 'float') {
      // Validate min value
      if (attr.min !== undefined) {
        if (typeof attr.min !== 'number') {
          errors.push({
            path: `${path}.min`,
            message: 'min must be a number',
            code: 'INVALID_MIN'
          });
        } else if (attr.type === 'integer' && !Number.isSafeInteger(attr.min)) {
          errors.push({
            path: `${path}.min`,
            message: `min value ${attr.min} exceeds JavaScript safe integer range (-9007199254740991 to 9007199254740991). Remove min/max or use safe values.`,
            code: 'UNSAFE_INTEGER_MIN'
          });
        }
      }

      // Validate max value
      if (attr.max !== undefined) {
        if (typeof attr.max !== 'number') {
          errors.push({
            path: `${path}.max`,
            message: 'max must be a number',
            code: 'INVALID_MAX'
          });
        } else if (attr.type === 'integer' && !Number.isSafeInteger(attr.max)) {
          errors.push({
            path: `${path}.max`,
            message: `max value ${attr.max} exceeds JavaScript safe integer range (-9007199254740991 to 9007199254740991). Remove min/max or use safe values.`,
            code: 'UNSAFE_INTEGER_MAX'
          });
        }
      }
    }

    if (attr.type === 'enum') {
      if (!attr.elements || !Array.isArray(attr.elements) || attr.elements.length === 0) {
        errors.push({
          path: `${path}.elements`,
          message: 'enum type requires elements array',
          code: 'MISSING_ELEMENTS'
        });
      }
    }

    if (attr.type === 'relationship') {
      if (!attr.relatedCollection) {
        errors.push({
          path: `${path}.relatedCollection`,
          message: 'relationship type requires relatedCollection',
          code: 'MISSING_RELATED_COLLECTION'
        });
      }
      if (!attr.relationType) {
        errors.push({
          path: `${path}.relationType`,
          message: 'relationship type requires relationType',
          code: 'MISSING_RELATION_TYPE'
        });
      }
    }
  }
}

/**
 * Validate indexes array
 */
function validateIndexes(
  indexes: any[],
  attributes: AttributeDefinition[],
  path: string,
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  const indexKeys = new Set<string>();
  const attributeKeys = new Set(attributes.map(a => a.key));

  indexes.forEach((index, i) => {
    const indexPath = `${path}[${i}]`;

    if (typeof index !== 'object' || index === null) {
      errors.push({
        path: indexPath,
        message: 'Index must be an object',
        code: 'INVALID_TYPE'
      });
      return;
    }

    validateIndex(index, attributeKeys, indexPath, errors, warnings);

    // Check for duplicate keys
    if (index.key) {
      if (indexKeys.has(index.key)) {
        errors.push({
          path: `${indexPath}.key`,
          message: `Duplicate index key: ${index.key}`,
          code: 'DUPLICATE_KEY'
        });
      }
      indexKeys.add(index.key);
    }
  });
}

/**
 * Validate a single index
 */
function validateIndex(
  index: IndexDefinition,
  attributeKeys: Set<string>,
  path: string,
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  validateRequiredField(index, 'key', 'string', errors, path);
  validateRequiredField(index, 'type', 'string', errors, path);
  validateRequiredField(index, 'attributes', 'array', errors, path);

  if (index.key) {
    validateKey(index.key, `${path}.key`, errors);
  }

  // Validate index type
  if (index.type && !['key', 'unique', 'fulltext'].includes(index.type)) {
    errors.push({
      path: `${path}.type`,
      message: `Invalid index type: ${index.type}. Must be one of: key, unique, fulltext`,
      code: 'INVALID_INDEX_TYPE'
    });
  }

  // Validate attributes exist
  if (Array.isArray(index.attributes)) {
    index.attributes.forEach((attr, i) => {
      if (typeof attr !== 'string') {
        errors.push({
          path: `${path}.attributes[${i}]`,
          message: 'Index attribute must be a string',
          code: 'INVALID_TYPE'
        });
      } else if (!attributeKeys.has(attr)) {
        errors.push({
          path: `${path}.attributes[${i}]`,
          message: `Index references non-existent attribute: ${attr}`,
          code: 'INVALID_REFERENCE'
        });
      }
    });
  }

  // Validate orders
  if (index.orders && Array.isArray(index.orders)) {
    if (index.orders.length !== index.attributes.length) {
      warnings.push({
        path: `${path}.orders`,
        message: 'orders array length should match attributes array length',
        code: 'LENGTH_MISMATCH'
      });
    }

    index.orders.forEach((order, i) => {
      if (order !== 'ASC' && order !== 'DESC') {
        errors.push({
          path: `${path}.orders[${i}]`,
          message: `Invalid order: ${order}. Must be ASC or DESC`,
          code: 'INVALID_ORDER'
        });
      }
    });
  }
}

/**
 * Validate buckets array
 */
function validateBuckets(
  buckets: any[],
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  const bucketIds = new Set<string>();

  buckets.forEach((bucket, index) => {
    const path = `buckets[${index}]`;

    if (typeof bucket !== 'object' || bucket === null) {
      errors.push({
        path,
        message: 'Bucket must be an object',
        code: 'INVALID_TYPE'
      });
      return;
    }

    validateBucket(bucket, path, errors, warnings);

    // Check for duplicate IDs
    if (bucket.id) {
      if (bucketIds.has(bucket.id)) {
        errors.push({
          path: `${path}.id`,
          message: `Duplicate bucket ID: ${bucket.id}`,
          code: 'DUPLICATE_ID'
        });
      }
      bucketIds.add(bucket.id);
    }
  });
}

/**
 * Validate a single bucket
 */
function validateBucket(
  bucket: BucketDefinition,
  path: string,
  errors: SchemaValidationError[],
  warnings: SchemaValidationWarning[]
): void {
  validateRequiredField(bucket, 'id', 'string', errors, path);
  validateRequiredField(bucket, 'name', 'string', errors, path);

  if (bucket.id) {
    validateId(bucket.id, `${path}.id`, errors);
  }

  if (bucket.name) {
    validateName(bucket.name, `${path}.name`, errors);
  }

  if (bucket.maximumFileSize !== undefined && typeof bucket.maximumFileSize !== 'number') {
    errors.push({
      path: `${path}.maximumFileSize`,
      message: 'maximumFileSize must be a number',
      code: 'INVALID_TYPE'
    });
  }

  if (bucket.compression && !['none', 'gzip', 'zstd'].includes(bucket.compression)) {
    errors.push({
      path: `${path}.compression`,
      message: `Invalid compression: ${bucket.compression}. Must be one of: none, gzip, zstd`,
      code: 'INVALID_COMPRESSION'
    });
  }
}

/**
 * Helper: Validate required field exists and has correct type
 */
function validateRequiredField(
  obj: any,
  field: string,
  expectedType: string,
  errors: SchemaValidationError[],
  parentPath?: string
): void {
  const path = parentPath ? `${parentPath}.${field}` : field;

  if (!(field in obj)) {
    errors.push({
      path,
      message: `Missing required field: ${field}`,
      code: 'MISSING_FIELD'
    });
    return;
  }

  const value = obj[field];
  const actualType = Array.isArray(value) ? 'array' : typeof value;

  if (actualType !== expectedType) {
    errors.push({
      path,
      message: `${field} must be ${expectedType}, got ${actualType}`,
      code: 'INVALID_TYPE'
    });
  }
}

/**
 * Helper: Validate ID format (lowercase alphanumeric with underscores)
 */
function validateId(id: string, path: string, errors: SchemaValidationError[]): void {
  if (!/^[a-z0-9_]+$/.test(id)) {
    errors.push({
      path,
      message: 'ID must contain only lowercase letters, numbers, and underscores',
      code: 'INVALID_ID_FORMAT'
    });
  }

  if (id.length < 1 || id.length > 36) {
    errors.push({
      path,
      message: 'ID must be between 1 and 36 characters',
      code: 'INVALID_ID_LENGTH'
    });
  }
}

/**
 * Helper: Validate name format
 */
function validateName(name: string, path: string, errors: SchemaValidationError[]): void {
  if (name.length < 1 || name.length > 128) {
    errors.push({
      path,
      message: 'Name must be between 1 and 128 characters',
      code: 'INVALID_NAME_LENGTH'
    });
  }
}

/**
 * Helper: Validate key format (alphanumeric with underscores)
 */
function validateKey(key: string, path: string, errors: SchemaValidationError[]): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
    errors.push({
      path,
      message: 'Key must start with a letter and contain only letters, numbers, and underscores',
      code: 'INVALID_KEY_FORMAT'
    });
  }

  if (key.length < 1 || key.length > 128) {
    errors.push({
      path,
      message: 'Key must be between 1 and 128 characters',
      code: 'INVALID_KEY_LENGTH'
    });
  }
}
