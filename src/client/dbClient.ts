/**
 * EsDbClient - Client Implementation
 *
 * Uses appwrite web SDK for browser-side database operations with session authentication
 */

import { Client, Databases, Account, Query, Storage, Teams } from 'appwrite';
import { EsDbClientBase, DEFAULT_PROVIDER_URL, esError } from '../shared/base';
import { EsID, type EsPermissionString, type EsQueryString } from '../helpers';
import type {
  EsRecord,
  EsRecordSet,
  EsAccount,
  EsAsset,
  EsAssetSet,
  EsQueryConfig,
  EsTeam,
  EsTeamSet,
  EsTeamMember,
  EsTeamMemberSet,
  EsTeamMembership,
  EsAccountPreferences,
  EsTeamPreferences,
  RealtimeCallback,
  UnsubscribeFunction
} from '../types';

/**
 * Client-side configuration (NO API key - uses session auth)
 */
export interface EsDbClientConfigBrowser {
  endpoint?: string;
  projectId: string;
  // No apiKey - uses session authentication
}

/**
 * OAuth provider types
 */
export type OAuthProvider = 'google' | 'github' | 'apple' | 'microsoft' | 'facebook' | 'twitter';

/**
 * Client-side EsDbClient implementation
 * Provides user-scoped access using session authentication
 */
export class EsDbClient extends EsDbClientBase {
  private client: Client;
  private databases: Databases;
  private account: Account;
  private storage: Storage;
  private teams: Teams;

  constructor(config: EsDbClientConfigBrowser) {
    super(config);

    const endpoint = config.endpoint || DEFAULT_PROVIDER_URL;

    this.client = new Client()
      .setEndpoint(endpoint)
      .setProject(config.projectId);
    // No API key - uses session cookies

    this.databases = new Databases(this.client);
    this.account = new Account(this.client);
    this.storage = new Storage(this.client);
    this.teams = new Teams(this.client);
  }

  // ==================== AUTHENTICATION METHODS (Client Only) ====================

  /**
   * Login with email and password
   * Creates a session for the user
   */
  async login(email: string, password: string): Promise<EsAccount> {
    try {
      await this.account.createEmailPasswordSession(email, password);
      const user = await this.account.get();
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to login', error);
    }
  }

  /**
   * Login with OAuth provider
   * Redirects to provider's OAuth page
   */
  async loginWithProvider(
    provider: OAuthProvider,
    successUrl?: string,
    failureUrl?: string
  ): Promise<void> {
    try {
      const success = successUrl || (typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : '');
      const failure = failureUrl || (typeof window !== 'undefined' ? window.location.origin + '/auth/error' : '');

      await this.account.createOAuth2Session(
        provider as any,
        success,
        failure
      );
    } catch (error) {
      throw esError(`Failed to login with ${provider}`, error);
    }
  }

  /**
   * Logout current user
   * Deletes the current session
   */
  async logout(): Promise<boolean> {
    try {
      await this.account.deleteSession('current');
      return true;
    } catch (error) {
      throw esError('Failed to logout', error);
    }
  }

  /**
   * Get current logged-in user
   * Returns null if not logged in
   */
  async getCurrentUser(): Promise<EsAccount | null> {
    try {
      const user = await this.account.get();
      return this.mapAccount(user);
    } catch {
      return null;
    }
  }

  /**
   * Sign up a new user
   * Creates account and automatically logs in
   */
  async signup(email: string, password: string, name?: string): Promise<EsAccount> {
    try {
      await this.account.create(EsID.unique(), email, password, name);
      return await this.login(email, password);
    } catch (error) {
      throw esError('Failed to signup', error);
    }
  }

  /**
   * Update user name
   */
  async updateName(name: string): Promise<EsAccount> {
    try {
      await this.account.updateName(name);
      const user = await this.account.get();
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to update name', error);
    }
  }

  /**
   * Update user email
   */
  async updateEmail(email: string, password: string): Promise<EsAccount> {
    try {
      await this.account.updateEmail(email, password);
      const user = await this.account.get();
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to update email', error);
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string, oldPassword: string): Promise<EsAccount> {
    try {
      await this.account.updatePassword(newPassword, oldPassword);
      const user = await this.account.get();
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to update password', error);
    }
  }

  /**
   * Send password recovery email
   */
  async sendPasswordRecovery(email: string, resetUrl?: string): Promise<boolean> {
    try {
      const url = resetUrl || (typeof window !== 'undefined' ? window.location.origin + '/auth/reset-password' : '');
      await this.account.createRecovery(email, url);
      return true;
    } catch (error) {
      throw esError('Failed to send recovery email', error);
    }
  }

  /**
   * Complete password recovery with secret
   */
  async completePasswordRecovery(userId: string, secret: string, password: string): Promise<boolean> {
    try {
      await this.account.updateRecovery(userId, secret, password);
      return true;
    } catch (error) {
      throw esError('Failed to complete password recovery', error);
    }
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(verifyUrl?: string): Promise<boolean> {
    try {
      const url = verifyUrl || (typeof window !== 'undefined' ? window.location.origin + '/auth/verify-email' : '');
      await this.account.createVerification(url);
      return true;
    } catch (error) {
      throw esError('Failed to send verification email', error);
    }
  }

  /**
   * Complete email verification with secret
   */
  async completeEmailVerification(userId: string, secret: string): Promise<boolean> {
    try {
      await this.account.updateVerification(userId, secret);
      return true;
    } catch (error) {
      throw esError('Failed to complete email verification', error);
    }
  }

  /**
   * Send magic URL token for passwordless authentication
   * The user will receive an email with a link to login
   */
  async sendMagicURL(email: string, loginUrl?: string): Promise<boolean> {
    try {
      const url = loginUrl || (typeof window !== 'undefined' ? window.location.origin + '/auth/magic-url' : '');
      await this.account.createMagicURLToken(EsID.unique(), email, url);
      return true;
    } catch (error) {
      throw esError('Failed to send magic URL', error);
    }
  }

  /**
   * Complete magic URL session with userId and secret from the email link
   * This logs the user in without a password
   */
  async completeMagicURLSession(userId: string, secret: string): Promise<EsAccount> {
    try {
      await this.account.updateMagicURLSession(userId, secret);
      const user = await this.account.get();
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to complete magic URL session', error);
    }
  }

  // ==================== ACCOUNT PREFERENCES ====================

  /**
   * Get account preferences
   * Returns user's custom preferences object
   */
  async getAccountPreferences(): Promise<EsAccountPreferences> {
    try {
      const prefs = await this.account.getPrefs();
      return prefs as EsAccountPreferences;
    } catch (error) {
      throw esError('Failed to get account preferences', error);
    }
  }

  /**
   * Update account preferences
   * Merges with existing preferences
   */
  async updateAccountPreferences(prefs: EsAccountPreferences): Promise<EsAccountPreferences> {
    try {
      const updatedPrefs = await this.account.updatePrefs(prefs);
      return updatedPrefs as EsAccountPreferences;
    } catch (error) {
      throw esError('Failed to update account preferences', error);
    }
  }

  // ==================== REALTIME SUBSCRIPTIONS ====================

  /**
   * Subscribe to realtime events
   * @param channels - Array of channels to subscribe to (e.g., ['documents', 'databases.dbId.collections.collId.documents'])
   * @param callback - Callback function to handle realtime events
   * @returns Unsubscribe function to stop listening
   *
   * Channel patterns:
   * - 'documents' - All document events
   * - 'databases.[DATABASE_ID].collections.[COLLECTION_ID].documents' - All documents in a collection
   * - 'databases.[DATABASE_ID].collections.[COLLECTION_ID].documents.[DOCUMENT_ID]' - Specific document
   * - 'files' - All file events
   * - 'buckets.[BUCKET_ID].files' - All files in a bucket
   * - 'buckets.[BUCKET_ID].files.[FILE_ID]' - Specific file
   */
  subscribe(channels: string[], callback: RealtimeCallback): UnsubscribeFunction {
    try {
      const unsubscribe = this.client.subscribe(channels, (response: any) => {
        callback({
          events: response.events || [],
          channels: response.channels || [],
          timestamp: response.timestamp || Date.now(),
          payload: response.payload || {}
        });
      });
      return unsubscribe;
    } catch (error) {
      throw esError('Failed to subscribe to realtime', error);
    }
  }

  /**
   * Subscribe to document changes in a collection
   * @param storeId - Database ID
   * @param tableId - Collection ID
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  subscribeToCollection(storeId: string, tableId: string, callback: RealtimeCallback<EsRecord>): UnsubscribeFunction {
    const channel = `databases.${storeId}.collections.${tableId}.documents`;
    return this.subscribe([channel], (response) => {
      if (response.payload) {
        callback({
          ...response,
          payload: this.mapRecord(response.payload)
        });
      }
    });
  }

  /**
   * Subscribe to a specific document changes
   * @param storeId - Database ID
   * @param tableId - Collection ID
   * @param recordId - Document ID
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  subscribeToDocument(storeId: string, tableId: string, recordId: string, callback: RealtimeCallback<EsRecord>): UnsubscribeFunction {
    const channel = `databases.${storeId}.collections.${tableId}.documents.${recordId}`;
    return this.subscribe([channel], (response) => {
      if (response.payload) {
        callback({
          ...response,
          payload: this.mapRecord(response.payload)
        });
      }
    });
  }

  /**
   * Subscribe to file changes in a storage bucket
   * @param containerId - Bucket ID
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  subscribeToBucket(containerId: string, callback: RealtimeCallback<EsAsset>): UnsubscribeFunction {
    const channel = `buckets.${containerId}.files`;
    return this.subscribe([channel], (response) => {
      if (response.payload) {
        callback({
          ...response,
          payload: this.mapAsset(response.payload)
        });
      }
    });
  }

  /**
   * Subscribe to a specific file changes
   * @param containerId - Bucket ID
   * @param assetId - File ID
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  subscribeToFile(containerId: string, assetId: string, callback: RealtimeCallback<EsAsset>): UnsubscribeFunction {
    const channel = `buckets.${containerId}.files.${assetId}`;
    return this.subscribe([channel], (response) => {
      if (response.payload) {
        callback({
          ...response,
          payload: this.mapAsset(response.payload)
        });
      }
    });
  }

  // ==================== RECORD OPERATIONS ====================

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
      throw esError('Failed to add record', error);
    }
  }

  async fetchRecord(
    storeId: string,
    tableId: string,
    recordId: string
  ): Promise<EsRecord> {
    try {
      const doc = await this.databases.getDocument(storeId, tableId, recordId);
      return this.mapRecord(doc);
    } catch (error) {
      throw esError('Failed to fetch record', error);
    }
  }

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
      throw esError('Failed to modify record', error);
    }
  }

  async removeRecord(
    storeId: string,
    tableId: string,
    recordId: string
  ): Promise<boolean> {
    try {
      await this.databases.deleteDocument(storeId, tableId, recordId);
      return true;
    } catch (error) {
      throw esError('Failed to remove record', error);
    }
  }

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
      throw esError('Failed to fetch records', error);
    }
  }

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
      throw esError('Failed to fetch records with queries', error);
    }
  }

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
      throw esError('Failed to search records', error);
    }
  }

  // ==================== ASSET STORAGE OPERATIONS ====================

  async storeAsset(
    containerId: string,
    resource: File | Blob,
    assetId?: string,
    permissions?: EsPermissionString[]
  ): Promise<EsAsset> {
    try {
      const uploadedFile = await this.storage.createFile(
        containerId,
        assetId || EsID.unique(),
        resource as any,
        permissions
      );
      return this.mapAsset(uploadedFile);
    } catch (error) {
      throw esError('Failed to store asset', error);
    }
  }

  async fetchAsset(containerId: string, assetId: string): Promise<EsAsset> {
    try {
      const file = await this.storage.getFile(containerId, assetId);
      return this.mapAsset(file);
    } catch (error) {
      throw esError('Failed to fetch asset', error);
    }
  }

  getAssetRetrievalUrl(containerId: string, assetId: string): string {
    return `${this.endpoint}/storage/buckets/${containerId}/files/${assetId}/download?project=${this.projectId}`;
  }

  getAssetPreviewUrl(containerId: string, assetId: string): string {
    return `${this.endpoint}/storage/buckets/${containerId}/files/${assetId}/view?project=${this.projectId}`;
  }

  async removeAsset(containerId: string, assetId: string): Promise<boolean> {
    try {
      await this.storage.deleteFile(containerId, assetId);
      return true;
    } catch (error) {
      throw esError('Failed to remove asset', error);
    }
  }

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
      throw esError('Failed to fetch assets', error);
    }
  }

  // ==================== TEAM OPERATIONS (Client Only) ====================

  /**
   * Create a new team
   * @param name - Team name
   * @param teamId - Optional custom team ID
   * @param roles - Optional roles for the team creator
   */
  async createTeam(name: string, teamId?: string, roles?: string[]): Promise<EsTeam> {
    try {
      const team = await this.teams.create(teamId || EsID.unique(), name, roles);
      return this.mapTeam(team);
    } catch (error) {
      throw esError('Failed to create team', error);
    }
  }

  /**
   * Get a team by ID
   * @param teamId - Team identifier
   */
  async getTeam(teamId: string): Promise<EsTeam> {
    try {
      const team = await this.teams.get(teamId);
      return this.mapTeam(team);
    } catch (error) {
      throw esError('Failed to get team', error);
    }
  }

  /**
   * List all teams for the current user
   * @param maxResults - Maximum number of results
   * @param skipCount - Number of results to skip
   */
  async listTeams(maxResults?: number, skipCount?: number): Promise<EsTeamSet> {
    try {
      const queries = [];
      if (maxResults) queries.push(Query.limit(maxResults));
      if (skipCount) queries.push(Query.offset(skipCount));

      const response = await this.teams.list(queries);
      return {
        count: response.total,
        items: response.teams.map(team => this.mapTeam(team))
      };
    } catch (error) {
      throw esError('Failed to list teams', error);
    }
  }

  /**
   * Update team name
   * @param teamId - Team identifier
   * @param name - New team name
   */
  async updateTeamName(teamId: string, name: string): Promise<EsTeam> {
    try {
      const team = await this.teams.updateName(teamId, name);
      return this.mapTeam(team);
    } catch (error) {
      throw esError('Failed to update team name', error);
    }
  }

  /**
   * Delete a team
   * @param teamId - Team identifier
   */
  async deleteTeam(teamId: string): Promise<boolean> {
    try {
      await this.teams.delete(teamId);
      return true;
    } catch (error) {
      throw esError('Failed to delete team', error);
    }
  }

  /**
   * List team members
   * @param teamId - Team identifier
   * @param maxResults - Maximum number of results
   * @param skipCount - Number of results to skip
   */
  async listTeamMembers(teamId: string, maxResults?: number, skipCount?: number): Promise<EsTeamMemberSet> {
    try {
      const queries = [];
      if (maxResults) queries.push(Query.limit(maxResults));
      if (skipCount) queries.push(Query.offset(skipCount));

      const response = await this.teams.listMemberships(teamId, queries);
      return {
        count: response.total,
        items: response.memberships.map(membership => this.mapTeamMember(membership))
      };
    } catch (error) {
      throw esError('Failed to list team members', error);
    }
  }

  /**
   * Create team membership (invite user)
   * @param teamId - Team identifier
   * @param email - User email to invite
   * @param roles - Roles to assign to the user
   * @param redirectUrl - URL to redirect after accepting invite
   */
  async createTeamMembership(
    teamId: string,
    email: string,
    roles: string[],
    redirectUrl?: string
  ): Promise<EsTeamMember> {
    try {
      const url = redirectUrl || (typeof window !== 'undefined' ? window.location.origin + '/teams' : '');
      const membership = await this.teams.createMembership(teamId, roles, email, undefined, undefined, url);
      return this.mapTeamMember(membership);
    } catch (error) {
      throw esError('Failed to create team membership', error);
    }
  }

  /**
   * Update team member roles
   * @param teamId - Team identifier
   * @param membershipId - Membership identifier
   * @param roles - New roles for the member
   */
  async updateTeamMemberRoles(teamId: string, membershipId: string, roles: string[]): Promise<EsTeamMember> {
    try {
      const membership = await this.teams.updateMembership(teamId, membershipId, roles);
      return this.mapTeamMember(membership);
    } catch (error) {
      throw esError('Failed to update member roles', error);
    }
  }

  /**
   * Delete team membership (remove member)
   * @param teamId - Team identifier
   * @param membershipId - Membership identifier
   */
  async deleteTeamMembership(teamId: string, membershipId: string): Promise<boolean> {
    try {
      await this.teams.deleteMembership(teamId, membershipId);
      return true;
    } catch (error) {
      throw esError('Failed to delete team membership', error);
    }
  }

  /**
   * Get team membership status
   * @param teamId - Team identifier
   * @param membershipId - Membership identifier
   */
  async getTeamMembership(teamId: string, membershipId: string): Promise<EsTeamMember> {
    try {
      const membership = await this.teams.getMembership(teamId, membershipId);
      return this.mapTeamMember(membership);
    } catch (error) {
      throw esError('Failed to get team membership', error);
    }
  }

  /**
   * Update team membership status
   * Used to accept or reject team invitations
   * @param teamId - Team identifier
   * @param membershipId - Membership identifier
   * @param userId - User identifier
   * @param secret - Secret from the invitation
   */
  async updateMembershipStatus(teamId: string, membershipId: string, userId: string, secret: string): Promise<EsTeamMember> {
    try {
      const membership = await this.teams.updateMembershipStatus(teamId, membershipId, userId, secret);
      return this.mapTeamMember(membership);
    } catch (error) {
      throw esError('Failed to update membership status', error);
    }
  }

  // ==================== TEAM PREFERENCES ====================

  /**
   * Get team preferences
   * @param teamId - Team identifier
   * @returns Team preferences object
   */
  async getTeamPreferences(teamId: string): Promise<EsTeamPreferences> {
    try {
      const prefs = await this.teams.getPrefs(teamId);
      return prefs as EsTeamPreferences;
    } catch (error) {
      throw esError('Failed to get team preferences', error);
    }
  }

  /**
   * Update team preferences
   * Merges with existing preferences
   * @param teamId - Team identifier
   * @param prefs - Preferences object to update
   */
  async updateTeamPreferences(teamId: string, prefs: EsTeamPreferences): Promise<EsTeamPreferences> {
    try {
      const updatedPrefs = await this.teams.updatePrefs(teamId, prefs);
      return updatedPrefs as EsTeamPreferences;
    } catch (error) {
      throw esError('Failed to update team preferences', error);
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Map Appwrite team to EsTeam
   */
  private mapTeam(team: any): EsTeam {
    return {
      uid: team.$id,
      name: team.name,
      totalMembers: team.total || 0,
      createdAt: team.$createdAt
    };
  }

  /**
   * Map Appwrite membership to EsTeamMember
   */
  private mapTeamMember(membership: any): EsTeamMember {
    return {
      uid: membership.$id,
      teamId: membership.teamId,
      teamName: membership.teamName || '',
      userId: membership.userId,
      userName: membership.userName,
      userEmail: membership.userEmail,
      roles: membership.roles || [],
      joined: membership.joined
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
