/**
 * Abstract base class for EsDbClient
 * Provides common interface for both server and client implementations
 */

import type {
  EsRecord,
  EsRecordSet,
  EsAccount,
  EsAccountSet,
  EsAsset,
  EsAssetSet,
  EsQueryConfig
} from '../types.js';
import type { EsPermissionString, EsQueryString } from '../helpers/index.js';

export const DEFAULT_PROVIDER_URL = 'https://provider.everydayseries.ai/v1';

/**
 * Base configuration for EsDbClient
 */
export interface EsDbClientConfigBase {
  endpoint?: string;
  projectId: string;
}

/**
 * Abstract base class defining the EsDbClient interface
 */
export abstract class EsDbClientBase {
  protected endpoint: string;
  protected projectId: string;

  constructor(config: EsDbClientConfigBase) {
    this.endpoint = config.endpoint || DEFAULT_PROVIDER_URL;
    this.projectId = config.projectId;
  }

  // ==================== RECORD OPERATIONS (Abstract) ====================

  /**
   * Add a new record to a data store
   */
  abstract addRecord(
    storeId: string,
    tableId: string,
    payload: Record<string, any>,
    recordId?: string,
    permissions?: EsPermissionString[]
  ): Promise<EsRecord>;

  /**
   * Fetch a record by identifier
   */
  abstract fetchRecord(
    storeId: string,
    tableId: string,
    recordId: string
  ): Promise<EsRecord>;

  /**
   * Modify an existing record
   */
  abstract modifyRecord(
    storeId: string,
    tableId: string,
    recordId: string,
    payload: Record<string, any>,
    permissions?: EsPermissionString[]
  ): Promise<EsRecord>;

  /**
   * Remove a record permanently
   */
  abstract removeRecord(
    storeId: string,
    tableId: string,
    recordId: string
  ): Promise<boolean>;

  /**
   * Retrieve records from a table with optional filtering
   */
  abstract fetchRecords(
    storeId: string,
    tableId: string,
    config?: EsQueryConfig
  ): Promise<EsRecordSet>;

  /**
   * Retrieve records using query strings
   */
  abstract fetchRecordsWithQueries(
    storeId: string,
    tableId: string,
    queries: EsQueryString[]
  ): Promise<EsRecordSet>;

  /**
   * Search records with custom filter rules
   */
  abstract searchRecords(
    storeId: string,
    tableId: string,
    rules: { key: string; condition: string; match: any }[],
    maxResults?: number,
    skipCount?: number
  ): Promise<EsRecordSet>;

  // ==================== ASSET STORAGE OPERATIONS (Abstract) ====================

  /**
   * Store an asset
   */
  abstract storeAsset(
    containerId: string,
    resource: File | Blob,
    assetId?: string
  ): Promise<EsAsset>;

  /**
   * Retrieve asset metadata
   */
  abstract fetchAsset(containerId: string, assetId: string): Promise<EsAsset>;

  /**
   * Generate asset retrieval URL
   */
  abstract getAssetRetrievalUrl(containerId: string, assetId: string): string;

  /**
   * Generate asset preview URL
   */
  abstract getAssetPreviewUrl(containerId: string, assetId: string): string;

  /**
   * Remove an asset
   */
  abstract removeAsset(containerId: string, assetId: string): Promise<boolean>;

  /**
   * Retrieve assets in a container
   */
  abstract fetchAssets(
    containerId: string,
    maxResults?: number,
    skipCount?: number
  ): Promise<EsAssetSet>;

  // ==================== HELPER METHODS (Shared) ====================

  /**
   * Map Appwrite document to EsRecord
   */
  protected mapRecord(doc: any): EsRecord {
    return {
      uid: doc.$id,
      tableId: doc.$collectionId,
      storeId: doc.$databaseId,
      createdAt: doc.$createdAt,
      modifiedAt: doc.$updatedAt,
      accessRules: doc.$permissions,
      payload: { ...doc }
    };
  }

  /**
   * Map Appwrite user to EsAccount
   */
  protected mapAccount(user: any): EsAccount {
    return {
      uid: user.$id,
      emailAddress: user.email,
      displayName: user.name,
      isActive: user.status,
      emailConfirmed: user.emailVerification,
      phoneConfirmed: user.phoneVerification,
      createdAt: user.$createdAt,
      modifiedAt: user.$updatedAt
    };
  }

  /**
   * Map Appwrite file to EsAsset
   */
  protected mapAsset(file: any): EsAsset {
    return {
      uid: file.$id,
      containerId: file.bucketId,
      filename: file.name,
      byteSize: file.sizeOriginal,
      contentType: file.mimeType,
      createdAt: file.$createdAt,
      modifiedAt: file.$updatedAt
    };
  }
}
