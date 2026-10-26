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
export { EsDbClient } from './server/dbClient';
export type { EsDbClientConfigServer as EsDbClientConfig } from './server/dbClient';

// Export flow execution client
export { EsClient } from './client';
export type { EsClientConfig } from './types';

// Export universal helpers
export {
  EsQuery,
  EsPermission,
  EsRole,
  EsID,
  type EsQueryString,
  type EsPermissionString,
  type EsRoleString
} from './helpers';

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
  RunOptions,
  FlowValue,
  NodeError,
  MultiValueTypes,
  ModelInputType,
  SourceTarget
} from './types';
