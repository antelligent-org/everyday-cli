/**
 * EsDbClient - Server Implementation
 *
 * Uses node-appwrite SDK for server-side database operations with API key authentication
 */

import { Client, Databases, Users, Query, Storage, Account, Teams } from 'node-appwrite';
import { EsDbClientBase, DEFAULT_PROVIDER_URL, esError } from '../shared/base';
import { EsID, type EsPermissionString, type EsQueryString } from '../helpers';
import type {
  EsRecord,
  EsRecordSet,
  EsAccount,
  EsAccountSet,
  EsAsset,
  EsAssetSet,
  EsQueryConfig,
  EsAccountPreferences,
  EsMembership,
  EsMembershipSet
} from '../types';

/**
 * Server-side configuration (requires API key)
 */
export interface EsDbClientConfigServer {
  endpoint?: string;
  projectId: string;
  apiKey: string;  // Required for admin operations
}

/**
 * Server-side EsDbClient implementation
 * Provides full admin access using API key authentication
 *
 * Note: Account service methods require an active user session (JWT token).
 * Use Users service for admin operations that don't require sessions.
 */
export class EsDbClient extends EsDbClientBase {
  private client: Client;
  private databases: Databases;
  private users: Users;
  private storage: Storage;
  private account: Account;
  private teams: Teams;
  private config: EsDbClientConfigServer;

  constructor(config: EsDbClientConfigServer) {
    super(config);

    const endpoint = config.endpoint || DEFAULT_PROVIDER_URL;

    this.client = new Client()
      .setEndpoint(endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey);

    this.databases = new Databases(this.client);
    this.users = new Users(this.client);
    this.storage = new Storage(this.client);
    this.account = new Account(this.client);
    this.teams = new Teams(this.client);
    this.config = config;
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

  // ==================== ACCOUNT OPERATIONS (Admin Only) ====================

  /**
   * Register a new account (Admin operation)
   * @param emailAddress - Account email
   * @param credential - Account credential
   * @param displayName - Account display name
   */
  async registerAccount(emailAddress: string, credential: string, displayName?: string): Promise<EsAccount> {
    try {
      const user = await this.users.create(EsID.unique(), emailAddress, undefined, credential, displayName);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to register account', error);
    }
  }

  /**
   * Retrieve an account by identifier (Admin operation)
   * @param accountId - Account identifier
   */
  async fetchAccount(accountId: string): Promise<EsAccount> {
    try {
      const user = await this.users.get(accountId);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to fetch account', error);
    }
  }

  /**
   * Modify an account (Admin operation)
   * @param accountId - Account identifier
   * @param changes - Account changes (emailAddress, displayName, credential)
   */
  async modifyAccount(
    accountId: string,
    changes: { emailAddress?: string; displayName?: string; credential?: string }
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

      // Get fresh account data
      user = await this.users.get(accountId);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to modify account', error);
    }
  }

  /**
   * Remove an account (Admin operation)
   * @param accountId - Account identifier
   */
  async removeAccount(accountId: string): Promise<boolean> {
    try {
      await this.users.delete(accountId);
      return true;
    } catch (error) {
      throw esError('Failed to remove account', error);
    }
  }

  /**
   * Retrieve all accounts (Admin operation)
   * @param maxResults - Maximum number of results
   * @param skipCount - Number of results to skip
   */
  async fetchAccounts(maxResults?: number, skipCount?: number): Promise<EsAccountSet> {
    try {
      const queries = [];
      if (maxResults) queries.push(Query.limit(maxResults));
      if (skipCount) queries.push(Query.offset(skipCount));

      const response = await this.users.list(queries);
      return {
        count: response.total,
        items: response.users.map(user => this.mapAccount(user))
      };
    } catch (error) {
      throw esError('Failed to fetch accounts', error);
    }
  }

  // ==================== TOKEN AUTHENTICATION (Admin operations) ====================

  /**
   * Create an authentication token for a user (Server-side admin operation)
   *
   * **IMPORTANT**: This method only creates a token - it does NOT send any email.
   * You must manually send the userId and secret to the user (via email, SMS, etc.)
   *
   * Use case: Custom authentication flows, magic URL systems, passwordless login
   *
   * The client can then use `account.createSession(userId, secret)` to complete login.
   *
   * @param userId - User ID to create token for
   * @param length - Token length in characters (default: 6)
   * @param expire - Token expiration in seconds (default: 900 = 15 minutes)
   * @returns Token object with userId and secret (you must send these to the user yourself)
   *
   * @example
   * ```typescript
   * // Server-side: Create token
   * const { userId, secret } = await db.createAuthToken('user_123');
   *
   * // You must send these values to the user yourself:
   * await sendEmail(userEmail, `Your login link: ${appUrl}/auth?userId=${userId}&secret=${secret}`);
   *
   * // Client-side: User clicks link and completes session
   * await account.createSession(userId, secret);
   * ```
   */
  async createAuthToken(userId: string, length?: number, expire?: number): Promise<{ userId: string; secret: string }> {
    try {
      const token = await this.users.createToken(userId, length, expire);
      return {
        userId: token.userId,
        secret: token.secret
      };
    } catch (error) {
      throw esError('Failed to create auth token', error);
    }
  }

  // ==================== ACCOUNT PREFERENCES (Admin operations) ====================

  /**
   * Get account preferences for a specific user (Admin operation)
   * @param accountId - Account identifier
   * @returns User's custom preferences object
   */
  async getAccountPreferences(accountId: string): Promise<EsAccountPreferences> {
    try {
      const prefs = await this.users.getPrefs(accountId);
      return prefs as EsAccountPreferences;
    } catch (error) {
      throw esError('Failed to get account preferences', error);
    }
  }

  /**
   * Update account preferences for a specific user (Admin operation)
   * Merges with existing preferences
   * @param accountId - Account identifier
   * @param prefs - Preferences object to update
   */
  async updateAccountPreferences(accountId: string, prefs: EsAccountPreferences): Promise<EsAccountPreferences> {
    try {
      const updatedPrefs = await this.users.updatePrefs(accountId, prefs);
      return updatedPrefs as EsAccountPreferences;
    } catch (error) {
      throw esError('Failed to update account preferences', error);
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

  /**
   * Download a stored asset's content (Admin operation)
   * @param containerId - Container (bucket) ID
   * @param assetId - Asset (file) ID
   * @returns The file's bytes
   */
  async fetchAssetContent(containerId: string, assetId: string): Promise<ArrayBuffer> {
    try {
      return await this.storage.getFileDownload(containerId, assetId);
    } catch (error) {
      throw esError('Failed to fetch asset content', error);
    }
  }

  /**
   * Replace the access rules of a stored asset (Admin operation)
   * @param containerId - Container (bucket) ID
   * @param assetId - Asset (file) ID
   * @param permissions - New permission strings, e.g. EsPermission.read(EsRole.user(id))
   */
  async modifyAssetAccess(containerId: string, assetId: string, permissions: EsPermissionString[]): Promise<EsAsset> {
    try {
      const file = await this.storage.updateFile(containerId, assetId, undefined, permissions);
      return this.mapAsset(file);
    } catch (error) {
      throw esError('Failed to modify asset access', error);
    }
  }

  // ==================== SIGNED-IN USER FROM A JWT ====================

  /**
   * Resolve the account behind a short-lived JWT created in the browser
   * (e.g. with the client's createJWT). Throws if the JWT is invalid or expired.
   * The returned account includes its labels.
   * @param jwt - JWT sent by the browser
   */
  async getAccountFromJWT(jwt: string): Promise<EsAccount> {
    try {
      const asUser = new Client()
        .setEndpoint(this.config.endpoint || DEFAULT_PROVIDER_URL)
        .setProject(this.config.projectId)
        .setJWT(jwt);
      const user = await new Account(asUser).get();
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to get account from JWT', error);
    }
  }

  // ==================== TEAM MEMBERSHIPS (Admin operations) ====================

  /**
   * List every team membership of an account
   * @param accountId - Account ID
   * @param queries - Optional query strings (EsQuery)
   */
  async fetchAccountMemberships(accountId: string, queries?: EsQueryString[]): Promise<EsMembershipSet> {
    try {
      const response = await this.users.listMemberships(accountId, queries);
      return { count: response.total, items: response.memberships.map(m => this.mapMembership(m)) };
    } catch (error) {
      throw esError('Failed to fetch account memberships', error);
    }
  }

  /**
   * List the memberships of a team, including pending invitations
   * @param teamId - Team ID
   * @param queries - Optional query strings (EsQuery)
   */
  async fetchTeamMemberships(teamId: string, queries?: EsQueryString[]): Promise<EsMembershipSet> {
    try {
      const response = await this.teams.listMemberships(teamId, queries);
      return { count: response.total, items: response.memberships.map(m => this.mapMembership(m)) };
    } catch (error) {
      throw esError('Failed to fetch team memberships', error);
    }
  }

  /**
   * Fetch one team membership
   */
  async fetchTeamMembership(teamId: string, membershipId: string): Promise<EsMembership> {
    try {
      return this.mapMembership(await this.teams.getMembership(teamId, membershipId));
    } catch (error) {
      throw esError('Failed to fetch team membership', error);
    }
  }

  /**
   * Replace the roles of a team membership
   */
  async modifyTeamMembership(teamId: string, membershipId: string, roles: string[]): Promise<EsMembership> {
    try {
      return this.mapMembership(await this.teams.updateMembership(teamId, membershipId, roles));
    } catch (error) {
      throw esError('Failed to modify team membership', error);
    }
  }

  /**
   * Remove a team membership (or cancel a pending invitation)
   */
  async removeTeamMembership(teamId: string, membershipId: string): Promise<boolean> {
    try {
      await this.teams.deleteMembership(teamId, membershipId);
      return true;
    } catch (error) {
      throw esError('Failed to remove team membership', error);
    }
  }

  /**
   * Invite someone to a team by email, sent as an existing member (usually
   * the team owner). Unlike an API-key invite, which adds the person
   * straight away, this sends the normal invitation email with a join link.
   * A short-lived session for `inviterAccountId` is created and removed again.
   * @param inviterAccountId - Account the invitation is sent as (must be allowed to invite)
   * @param teamId - Team ID
   * @param email - Invitee email
   * @param roles - Roles for the new membership
   * @param url - Join page the invitation email links to
   */
  async inviteToTeamAs(
    inviterAccountId: string,
    teamId: string,
    email: string,
    roles: string[],
    url: string
  ): Promise<EsMembership> {
    let sessionId: string | null = null;
    try {
      const session = await this.users.createSession(inviterAccountId);
      sessionId = session.$id;
      const asInviter = new Client()
        .setEndpoint(this.config.endpoint || DEFAULT_PROVIDER_URL)
        .setProject(this.config.projectId)
        .setSession(session.secret);
      const membership = await new Teams(asInviter).createMembership(teamId, roles, email, undefined, undefined, url);
      return this.mapMembership(membership);
    } catch (error) {
      throw esError('Failed to invite to team', error);
    } finally {
      if (sessionId) await this.users.deleteSession(inviterAccountId, sessionId).catch(() => {});
    }
  }

  // ==================== ACCOUNT SERVICE METHODS (Requires Session) ====================
  //
  // IMPORTANT: These methods require an active user session (JWT token).
  // Set the session using: client.setJWT(jwtToken)
  // or client.setSession(sessionId)
  //
  // These are different from Users service methods which are admin-only.
  // ====================================================================================

  /**
   * Get currently logged in user (requires session)
   */
  async getCurrentAccount(): Promise<EsAccount> {
    try {
      const user = await this.account.get();
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to get current account', error);
    }
  }

  /**
   * Create new account (signup) - does not require session
   */
  async createAccount(userId: string, email: string, password: string, name?: string): Promise<EsAccount> {
    try {
      const user = await this.account.create(userId, email, password, name);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to create account', error);
    }
  }

  /**
   * Update current account email (requires session and password)
   */
  async updateCurrentEmail(email: string, password: string): Promise<EsAccount> {
    try {
      const user = await this.account.updateEmail(email, password);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to update email', error);
    }
  }

  /**
   * Update current account name (requires session)
   */
  async updateCurrentName(name: string): Promise<EsAccount> {
    try {
      const user = await this.account.updateName(name);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to update name', error);
    }
  }

  /**
   * Update current account password (requires session)
   */
  async updateCurrentPassword(password: string, oldPassword?: string): Promise<EsAccount> {
    try {
      const user = await this.account.updatePassword(password, oldPassword);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to update password', error);
    }
  }

  /**
   * Update current account phone (requires session and password)
   */
  async updateCurrentPhone(phone: string, password: string): Promise<EsAccount> {
    try {
      const user = await this.account.updatePhone(phone, password);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to update phone', error);
    }
  }

  /**
   * Get current account preferences (requires session)
   */
  async getCurrentAccountPreferences(): Promise<EsAccountPreferences> {
    try {
      const prefs = await this.account.getPrefs();
      return prefs as EsAccountPreferences;
    } catch (error) {
      throw esError('Failed to get preferences', error);
    }
  }

  /**
   * Update current account preferences (requires session)
   */
  async updateCurrentAccountPreferences(prefs: EsAccountPreferences): Promise<EsAccount> {
    try {
      const user = await this.account.updatePrefs(prefs);
      return this.mapAccount(user);
    } catch (error) {
      throw esError('Failed to update preferences', error);
    }
  }

  // ==================== SESSION MANAGEMENT (Account Service) ====================

  /**
   * Create email/password session (login)
   */
  async createEmailPasswordSession(email: string, password: string): Promise<any> {
    try {
      return await this.account.createEmailPasswordSession(email, password);
    } catch (error) {
      throw esError('Failed to create session', error);
    }
  }

  /**
   * Create anonymous session
   */
  async createAnonymousSession(): Promise<any> {
    try {
      return await this.account.createAnonymousSession();
    } catch (error) {
      throw esError('Failed to create anonymous session', error);
    }
  }

  /**
   * Create session from token (Magic URL, Phone, Email Token)
   */
  async createSessionFromToken(userId: string, secret: string): Promise<any> {
    try {
      return await this.account.createSession(userId, secret);
    } catch (error) {
      throw esError('Failed to create session from token', error);
    }
  }

  /**
   * List all sessions for current user
   */
  async listCurrentSessions(): Promise<any> {
    try {
      return await this.account.listSessions();
    } catch (error) {
      throw esError('Failed to list sessions', error);
    }
  }

  /**
   * Get specific session
   */
  async getCurrentSession(sessionId: string): Promise<any> {
    try {
      return await this.account.getSession(sessionId);
    } catch (error) {
      throw esError('Failed to get session', error);
    }
  }

  /**
   * Update session (extend expiration)
   */
  async updateCurrentSession(sessionId: string): Promise<any> {
    try {
      return await this.account.updateSession(sessionId);
    } catch (error) {
      throw esError('Failed to update session', error);
    }
  }

  /**
   * Delete specific session (logout from specific device)
   */
  async deleteCurrentSession(sessionId: string): Promise<boolean> {
    try {
      await this.account.deleteSession(sessionId);
      return true;
    } catch (error) {
      throw esError('Failed to delete session', error);
    }
  }

  /**
   * Delete all sessions (logout from all devices)
   */
  async deleteAllCurrentSessions(): Promise<boolean> {
    try {
      await this.account.deleteSessions();
      return true;
    } catch (error) {
      throw esError('Failed to delete all sessions', error);
    }
  }

  // ==================== TOKEN CREATION (Account Service) ====================

  /**
   * Create Magic URL token (sends email automatically)
   */
  async createAccountMagicURLToken(userId: string, email: string, url?: string, phrase?: boolean): Promise<any> {
    try {
      return await this.account.createMagicURLToken(userId, email, url, phrase);
    } catch (error) {
      throw esError('Failed to create magic URL token', error);
    }
  }

  /**
   * Create email token (sends email automatically)
   */
  async createAccountEmailToken(userId: string, email: string, phrase?: boolean): Promise<any> {
    try {
      return await this.account.createEmailToken(userId, email, phrase);
    } catch (error) {
      throw esError('Failed to create email token', error);
    }
  }

  /**
   * Create phone token (sends SMS automatically)
   */
  async createAccountPhoneToken(userId: string, phone: string): Promise<any> {
    try {
      return await this.account.createPhoneToken(userId, phone);
    } catch (error) {
      throw esError('Failed to create phone token', error);
    }
  }

  /**
   * Create JWT token for current session
   */
  async createAccountJWT(duration?: number): Promise<any> {
    try {
      return await this.account.createJWT(duration);
    } catch (error) {
      throw esError('Failed to create JWT', error);
    }
  }

  // ==================== PASSWORD RECOVERY (Account Service) ====================

  /**
   * Create password recovery (sends email)
   */
  async createAccountRecovery(email: string, url: string): Promise<any> {
    try {
      return await this.account.createRecovery(email, url);
    } catch (error) {
      throw esError('Failed to create recovery', error);
    }
  }

  /**
   * Complete password recovery
   */
  async updateAccountRecovery(userId: string, secret: string, password: string): Promise<any> {
    try {
      return await this.account.updateRecovery(userId, secret, password);
    } catch (error) {
      throw esError('Failed to update recovery', error);
    }
  }

  // ==================== VERIFICATION (Account Service) ====================

  /**
   * Create email verification (sends email)
   */
  async createAccountEmailVerification(url: string): Promise<any> {
    try {
      return await this.account.createEmailVerification(url);
    } catch (error) {
      throw esError('Failed to create email verification', error);
    }
  }

  /**
   * Complete email verification
   */
  async updateAccountEmailVerification(userId: string, secret: string): Promise<any> {
    try {
      return await this.account.updateEmailVerification(userId, secret);
    } catch (error) {
      throw esError('Failed to update email verification', error);
    }
  }

  /**
   * Create phone verification (sends SMS)
   */
  async createAccountPhoneVerification(): Promise<any> {
    try {
      return await this.account.createPhoneVerification();
    } catch (error) {
      throw esError('Failed to create phone verification', error);
    }
  }

  /**
   * Complete phone verification
   */
  async updateAccountPhoneVerification(userId: string, secret: string): Promise<any> {
    try {
      return await this.account.updatePhoneVerification(userId, secret);
    } catch (error) {
      throw esError('Failed to update phone verification', error);
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

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
