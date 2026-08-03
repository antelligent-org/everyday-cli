import { Client, Databases, Users, Teams, ID, Query, Storage } from 'node-appwrite';
import type {
  EsDbClientConfig,
  EsRecord,
  EsRecordSet,
  EsAccount,
  EsAccountSet,
  EsQueryConfig,
  EsAsset,
  EsAssetSet,
  EsMembership,
  EsMembershipSet
} from './types.js';

const DEFAULT_PROVIDER_URL = 'https://provider.everydayseries.ai/v1';

export class EsDbClient {
  private endpoint: string;
  private projectId: string;
  private client: Client;
  private databases: Databases;
  private users: Users;
  private teams: Teams;
  private storage: Storage;

  constructor(config: EsDbClientConfig) {
    this.endpoint = config.endpoint || DEFAULT_PROVIDER_URL;
    this.projectId = config.projectId;

    // Use endpoint as-is - Appwrite needs /v1 in the endpoint
    const endpoint = config.endpoint || DEFAULT_PROVIDER_URL;

    this.client = new Client()
      .setEndpoint(endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey);

    this.databases = new Databases(this.client);
    this.users = new Users(this.client);
    this.teams = new Teams(this.client);
    this.storage = new Storage(this.client);
  }

  // ==================== RECORD OPERATIONS ====================

  /**
   * Add a new record to a data store
   * @param storeId - Data store identifier
   * @param tableId - Table identifier
   * @param payload - Record data
   * @param recordId - Optional custom record identifier
   * @param permissions - Optional permissions array (e.g., [Permission.read(Role.any())])
   */
  async addRecord(
    storeId: string,
    tableId: string,
    payload: Record<string, any>,
    recordId?: string,
    permissions?: EsPermissionString[]
  ): Promise<EsRecord> {
    try {
      const doc = await this.databases.createDocument(
        storeId,
        tableId,
        recordId || EsID.unique(),
        payload,
        permissions
      );
      return this.mapRecord(doc);
    } catch (error) {
      throw new Error(`Failed to add record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch a record by identifier
   * @param storeId - Data store identifier
   * @param tableId - Table identifier
   * @param recordId - Record identifier
   */
  async fetchRecord(
    storeId: string,
    tableId: string,
    recordId: string
  ): Promise<EsRecord> {
    try {
      const doc = await this.databases.getDocument(storeId, tableId, recordId);
      return this.mapRecord(doc);
    } catch (error) {
      throw new Error(`Failed to fetch record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Modify an existing record
   * @param storeId - Data store identifier
   * @param tableId - Table identifier
   * @param recordId - Record identifier
   * @param payload - Updated data
   * @param permissions - Optional permissions array to update (e.g., [Permission.read(Role.any())])
   */
  async modifyRecord(
    storeId: string,
    tableId: string,
    recordId: string,
    payload: Record<string, any>,
    permissions?: EsPermissionString[]
  ): Promise<EsRecord> {
    try {
      const doc = await this.databases.updateDocument(
        storeId,
        tableId,
        recordId,
        payload,
        permissions
      );
      return this.mapRecord(doc);
    } catch (error) {
      throw new Error(`Failed to modify record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove a record permanently
   * @param storeId - Data store identifier
   * @param tableId - Table identifier
   * @param recordId - Record identifier
   */
  async removeRecord(
    storeId: string,
    tableId: string,
    recordId: string
  ): Promise<boolean> {
    try {
      await this.databases.deleteDocument(storeId, tableId, recordId);
      return true;
    } catch (error) {
      throw new Error(`Failed to remove record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve records from a table with optional filtering
   * @param storeId - Data store identifier
   * @param tableId - Table identifier
   * @param config - Query configuration (filters, limit, offset, sorting)
   */
  async fetchRecords(
    storeId: string,
    tableId: string,
    config?: EsQueryConfig
  ): Promise<EsRecordSet> {
    try {
      const queries = this.buildQuerySet(config);
      const response = await this.databases.listDocuments(
        storeId,
        tableId,
        queries
      );

      return {
        count: response.total,
        items: response.documents.map(doc => this.mapRecord(doc))
      };
    } catch (error) {
      throw new Error(`Failed to fetch records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve records using raw Appwrite Query strings (advanced)
   * @param storeId - Data store identifier
   * @param tableId - Table identifier
   * @param queries - Array of Appwrite Query strings (e.g., [Query.equal('status', 'active')])
   */
  async fetchRecordsWithQueries(
    storeId: string,
    tableId: string,
    queries: EsQueryString[]
  ): Promise<EsRecordSet> {
    try {
      const response = await this.databases.listDocuments(
        storeId,
        tableId,
        queries
      );

      return {
        count: response.total,
        items: response.documents.map(doc => this.mapRecord(doc))
      };
    } catch (error) {
      throw new Error(`Failed to fetch records with queries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search records with custom filter rules
   * @param storeId - Data store identifier
   * @param tableId - Table identifier
   * @param rules - Array of filter conditions
   * @param maxResults - Maximum number of results
   * @param skipCount - Number of results to skip
   */
  async searchRecords(
    storeId: string,
    tableId: string,
    rules: { key: string; condition: string; match: any }[],
    maxResults?: number,
    skipCount?: number
  ): Promise<EsRecordSet> {
    try {
      const queries = rules.map(r => this.buildFilterRule(r));

      if (maxResults) queries.push(Query.limit(maxResults));
      if (skipCount) queries.push(Query.offset(skipCount));

      const response = await this.databases.listDocuments(
        storeId,
        tableId,
        queries
      );

      return {
        count: response.total,
        items: response.documents.map(doc => this.mapRecord(doc))
      };
    } catch (error) {
      throw new Error(`Failed to search records: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== ACCOUNT OPERATIONS ====================

  /**
   * Register a new account
   * @param emailAddress - Account email
   * @param credential - Account credential
   * @param displayName - Account display name
   */
  async registerAccount(emailAddress: string, credential: string, displayName?: string): Promise<EsAccount> {
    try {
      const user = await this.users.create(EsID.unique(), emailAddress, undefined, credential, displayName);
      return this.mapAccount(user);
    } catch (error) {
      throw new Error(`Failed to register account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve an account by identifier
   * @param accountId - Account identifier
   */
  async fetchAccount(accountId: string): Promise<EsAccount> {
    try {
      const user = await this.users.get(accountId);
      return this.mapAccount(user);
    } catch (error) {
      throw new Error(`Failed to fetch account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Modify an account
   * @param accountId - Account identifier
   * @param changes - Account changes (emailAddress, displayName, credential)
   */
  async modifyAccount(
    accountId: string,
    changes: { emailAddress?: string; displayName?: string; credential?: string; status?: boolean; phone?: string }
  ): Promise<EsAccount> {
    try {
      let user;
      if (changes.emailAddress) {
        user = await this.users.updateEmail(accountId, changes.emailAddress);
      }
      if (changes.displayName) {
        user = await this.users.updateName(accountId, changes.displayName);
      }
      if (changes.credential) {
        user = await this.users.updatePassword(accountId, changes.credential);
      }
      if (typeof changes.status === 'boolean') {
        user = await this.users.updateStatus({ userId: accountId, status: changes.status });
      }
      if (changes.phone) {
        user = await this.users.updatePhone({ userId: accountId, number: changes.phone });
      }

      // Get fresh account data
      user = await this.users.get(accountId);
      return this.mapAccount(user);
    } catch (error) {
      throw new Error(`Failed to modify account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove an account
   * @param accountId - Account identifier
   */
  async removeAccount(accountId: string): Promise<boolean> {
    try {
      await this.users.delete(accountId);
      return true;
    } catch (error) {
      throw new Error(`Failed to remove account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve all accounts
   * @param maxResults - Maximum number of results
   * @param skipCount - Number of results to skip
   */
  async fetchAccounts(maxResults?: number, skipCount?: number, cursorAfter?: string): Promise<EsAccountSet> {
    try {
      const queries = [];
      if (maxResults) queries.push(Query.limit(maxResults));
      if (skipCount) queries.push(Query.offset(skipCount));
      if (cursorAfter) queries.push(Query.cursorAfter(cursorAfter));

      const response = await this.users.list(queries);
      return {
        count: response.total,
        items: response.users.map(user => this.mapAccount(user))
      };
    } catch (error) {
      throw new Error(`Failed to fetch accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== TEAM OPERATIONS ====================

  /**
   * Fetch all memberships for a team
   * @param teamId - Team identifier
   * @param maxResults - Maximum number of results
   */
  async fetchTeamMemberships(teamId: string, maxResults?: number): Promise<EsMembershipSet> {
    try {
      const queries: string[] = [];
      if (maxResults) queries.push(Query.limit(maxResults));

      const response = await this.teams.listMemberships({ teamId, queries });
      return {
        count: response.total,
        items: response.memberships.map((m): EsMembership => ({
          uid: m.$id,
          userId: m.userId,
          userName: m.userName,
          userEmail: m.userEmail,
          teamId: m.teamId,
          teamName: m.teamName,
          roles: m.roles,
          createdAt: m.$createdAt,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to fetch team memberships: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== ASSET STORAGE OPERATIONS ====================

  /**
   * Store an asset
   * @param containerId - Storage container identifier
   * @param resource - Asset to store (File or Blob)
   * @param assetId - Optional custom asset identifier
   */
  async storeAsset(
    containerId: string,
    resource: File | Blob,
    assetId?: string
  ): Promise<EsAsset> {
    try {
      const uploadedFile = await this.storage.createFile(
        containerId,
        assetId || EsID.unique(),
        resource as any
      );
      return this.mapAsset(uploadedFile);
    } catch (error) {
      throw new Error(`Failed to store asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve asset metadata
   * @param containerId - Storage container identifier
   * @param assetId - Asset identifier
   */
  async fetchAsset(containerId: string, assetId: string): Promise<EsAsset> {
    try {
      const file = await this.storage.getFile(containerId, assetId);
      return this.mapAsset(file);
    } catch (error) {
      throw new Error(`Failed to fetch asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate asset retrieval URL
   * @param containerId - Storage container identifier
   * @param assetId - Asset identifier
   */
  getAssetRetrievalUrl(containerId: string, assetId: string): string {
    return `${this.endpoint}/storage/buckets/${containerId}/files/${assetId}/download?project=${this.projectId}`;
  }

  /**
   * Generate asset preview URL
   * @param containerId - Storage container identifier
   * @param assetId - Asset identifier
   */
  getAssetPreviewUrl(containerId: string, assetId: string): string {
    return `${this.endpoint}/storage/buckets/${containerId}/files/${assetId}/view?project=${this.projectId}`;
  }

  /**
   * Remove an asset
   * @param containerId - Storage container identifier
   * @param assetId - Asset identifier
   */
  async removeAsset(containerId: string, assetId: string): Promise<boolean> {
    try {
      await this.storage.deleteFile(containerId, assetId);
      return true;
    } catch (error) {
      throw new Error(`Failed to remove asset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve assets in a container
   * @param containerId - Storage container identifier
   * @param maxResults - Maximum number of results
   * @param skipCount - Number of results to skip
   */
  async fetchAssets(containerId: string, maxResults?: number, skipCount?: number): Promise<EsAssetSet> {
    try {
      const queries = [];
      if (maxResults) queries.push(Query.limit(maxResults));
      if (skipCount) queries.push(Query.offset(skipCount));

      const response = await this.storage.listFiles(containerId, queries);
      return {
        count: response.total,
        items: response.files.map(file => this.mapAsset(file))
      };
    } catch (error) {
      throw new Error(`Failed to fetch assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==================== HELPER METHODS (PRIVATE) ====================

  private mapRecord(doc: any): EsRecord {
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

  private mapAccount(user: any): EsAccount {
    return {
      uid: user.$id,
      emailAddress: user.email,
      displayName: user.name,
      phone: user.phone,
      isActive: user.status,
      emailConfirmed: user.emailVerification,
      phoneConfirmed: user.phoneVerification,
      createdAt: user.$createdAt,
      modifiedAt: user.$updatedAt
    };
  }

  private mapAsset(file: any): EsAsset {
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

  private buildQuerySet(config?: EsQueryConfig): string[] {
    const queries: string[] = [];

    if (!config) return queries;

    if (config.maxResults) queries.push(Query.limit(config.maxResults));
    if (config.skipCount) queries.push(Query.offset(config.skipCount));

    if (config.sortBy) {
      config.sortBy.forEach(sort => {
        if (sort.order === 'descending') {
          queries.push(Query.orderDesc(sort.key));
        } else {
          queries.push(Query.orderAsc(sort.key));
        }
      });
    }

    if (config.rules) {
      config.rules.forEach(rule => {
        queries.push(this.buildFilterRule(rule));
      });
    }

    return queries;
  }

  private buildFilterRule(rule: { key: string; condition: string; match: any }): string {
    const { key, condition, match } = rule;

    switch (condition) {
      case 'equals':
        return Query.equal(key, match);
      case 'notEquals':
        return Query.notEqual(key, match);
      case 'below':
        return Query.lessThan(key, match);
      case 'belowOrEquals':
        return Query.lessThanEqual(key, match);
      case 'above':
        return Query.greaterThan(key, match);
      case 'aboveOrEquals':
        return Query.greaterThanEqual(key, match);
      case 'contains':
        return Query.search(key, match);
      case 'isEmpty':
        return Query.isNull(key);
      case 'isNotEmpty':
        return Query.isNotNull(key);
      case 'inRange':
        return Query.between(key, match[0], match[1]);
      case 'beginsWith':
        return Query.startsWith(key, match);
      case 'endsWith':
        return Query.endsWith(key, match);
      default:
        return Query.equal(key, match);
    }
  }
}
