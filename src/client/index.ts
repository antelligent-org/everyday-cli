/**
 * EverydaySeries CLI - Client Entry Point
 *
 * For use in browser environments: Client Components, Browser JavaScript
 * Uses session authentication (no API key required)
 */

// Export the client implementation
export { EsDbClient } from './dbClient.js';
export type { EsDbClientConfigBrowser, OAuthProvider } from './dbClient.js';

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
  RealtimeResponseEvent,
  UnsubscribeFunction
} from '../types.js';

// Note: EsClient (flow execution) not exported here - only works server-side
