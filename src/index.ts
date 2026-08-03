/**
 * EverydaySeries CLI - Main Entry Point
 *
 * ⚠️ IMPORTANT: This package now supports both server and client environments!
 *
 * For Next.js and modern applications:
 * - Server-side: import from '@antelligent-app/everyday-cli/server'
 * - Client-side: import from '@antelligent-app/everyday-cli/client'
 *
 * This main export is kept for backwards compatibility (v1.x users)
 * It exports the SERVER implementation by default.
 */

// Re-export server implementation as default (backwards compatibility)
export { EsDbClient } from './server/dbClient.js';
export type { EsDbClientConfigServer as EsDbClientConfig } from './server/dbClient.js';

// Export flow execution client
export { EsClient } from './client.js';
export type { EsClientConfig } from './types.js';

// Export universal helpers
export {
  EsQuery,
  EsPermission,
  EsRole,
  EsID,
  type EsQueryString,
  type EsPermissionString,
  type EsRoleString
} from './helpers/index.js';

// Export types
export type {
  EsRecord,
  EsRecordSet,
  EsAccount,
  EsAccountSet,
  EsAsset,
  EsAssetSet,
  EsQueryConfig,
  EsAccountPreferences,
  NodeType,
  FlowNode,
  FlowResponse,
  RunFlowResult,
  FlowValue,
  NodeError,
  MultiValueTypes,
  ModelInputType,
  SourceTarget
} from './types.js';
