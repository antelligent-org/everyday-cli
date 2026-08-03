/**
 * EverydaySeries CLI - Server Entry Point
 *
 * For use in Node.js environments: Server Components, API Routes, Server Actions
 * Requires API key for admin-level operations
 */

// Export the server implementation
export { EsDbClient } from './dbClient.js';
export type { EsDbClientConfigServer } from './dbClient.js';

// Export universal helpers (work in both server and client)
export {
  EsQuery,
  EsPermission,
  EsRole,
  EsID,
  type EsQueryString,
  type EsPermissionString,
  type EsRoleString
} from '../helpers/index.js';

// Export shared types
export type {
  EsRecord,
  EsRecordSet,
  EsAccount,
  EsAccountSet,
  EsAsset,
  EsAssetSet,
  EsQueryConfig,
  EsAccountPreferences
} from '../types.js';

// Also export the EsClient for flow execution (if needed)
export { EsClient } from '../client.js';
export type { EsClientConfig } from '../types.js';
