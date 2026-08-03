# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.7] - 2026-08-03

### 🐛 Fixed

- **Realtime WebSocket connections failing with `1008 Server Error`** - Downgraded `appwrite` dependency from `^26.0.0` to `^24.2.0`
  - `appwrite@25.0.0` changed the realtime protocol: channels are now sent as a message after the socket connects, instead of as `channels[]` query params on the WebSocket URL
  - Backends that only implement the older URL-based protocol (e.g. `provider.everydayseries.ai`) reject the new protocol immediately with a `1008` policy-violation close, before any `subscribe` message can be sent
  - `^24.2.0` is the last version using the URL-based protocol; verified directly against the affected backend that this restores working `client.subscribe()` connections
  - No public API changes — this only affects the realtime transport internals

## [2.0.6] - 2026-06-27

### 🚀 Server-Side Account Service

This release adds comprehensive server-side Account service support with 27 new methods for session-based authentication and user operations.

### Added

- **Account Service (Server-Side)** - Complete session-based user operations
  - Imported `Account` from `node-appwrite` alongside existing `Users` service
  - Users service = Admin operations (API key)
  - Account service = Session-based operations (JWT/session required)

- **Session Management (8 methods)**
  - `createEmailPasswordSession(email, password)` - Login with credentials
  - `createAnonymousSession()` - Create anonymous session
  - `createSessionFromToken(userId, secret)` - Complete token-based login
  - `listCurrentSessions()` - List all user sessions
  - `getCurrentSession(sessionId)` - Get specific session details
  - `updateCurrentSession(sessionId)` - Extend session expiration
  - `deleteCurrentSession(sessionId)` - Logout from specific device
  - `deleteAllCurrentSessions()` - Logout from all devices

- **Account Management (8 methods)**
  - `getCurrentAccount()` - Get currently logged in user
  - `createAccount(userId, email, password, name?)` - Signup (no session required)
  - `updateCurrentEmail(email, password)` - Update email with password confirmation
  - `updateCurrentName(name)` - Update display name
  - `updateCurrentPassword(password, oldPassword?)` - Change password
  - `updateCurrentPhone(phone, password)` - Update phone number
  - `getCurrentAccountPreferences()` - Get current user's preferences
  - `updateCurrentAccountPreferences(prefs)` - Update current user's preferences

- **Token & Authentication (4 methods)**
  - `createAccountMagicURLToken(userId, email, url?, phrase?)` - Magic URL with automatic email
  - `createAccountEmailToken(userId, email, phrase?)` - Email token with automatic email
  - `createAccountPhoneToken(userId, phone)` - Phone token with automatic SMS
  - `createAccountJWT(duration?)` - Create JWT for current session

- **Password Recovery (2 methods)**
  - `createAccountRecovery(email, url)` - Initiate password reset (sends email)
  - `updateAccountRecovery(userId, secret, password)` - Complete password reset

- **Verification (4 methods)**
  - `createAccountEmailVerification(url)` - Send email verification
  - `updateAccountEmailVerification(userId, secret)` - Complete email verification
  - `createAccountPhoneVerification()` - Send phone verification SMS
  - `updateAccountPhoneVerification(userId, secret)` - Complete phone verification

- **Generic Token Creator (1 method)**
  - `createAuthToken(userId, length?, expire?)` - Create custom auth token (Users service)
  - Does NOT send email - you must handle notification yourself
  - For custom authentication flows where you control the notification system

### Changed

- **Server-Side Architecture**
  - Now includes both `Users` and `Account` services
  - Clear distinction: Users = admin ops, Account = session ops
  - Account methods require active session (JWT or session ID)
  - Set session via `client.setJWT(token)` or `client.setSession(id)`

- **README.md** - Added 150+ lines of documentation
  - New section: "Account Service Methods (Server-Side - Requires Session)"
  - Complete API reference for all 27 Account methods
  - Usage examples for session management
  - Clear warnings about session requirements
  - Token creation vs custom token creation explained

### Implementation Details

All Account service methods:
- Require active user session (except `createAccount` for signup)
- Use proper error handling with descriptive messages
- Return mapped EsAccount types where applicable
- Follow existing code patterns and conventions

**Difference from Users service:**
- Users service: Admin operations with API key, no session needed
- Account service: User operations with session/JWT required
- Both available on server-side for different use cases

**Build Status**: ✅ All code compiles successfully with no TypeScript errors

---

## [2.0.5] - 2026-06-27

### 🎉 Five Powerful New Features

This release adds real-time subscriptions, preferences management, and passwordless authentication. All features verified against Appwrite SDK v26.0.0.

### Added

- **Realtime Subscriptions (Client-Side)** - Subscribe to database and storage changes
  - `subscribe(channels, callback)` - Generic subscription to multiple channels
  - `subscribeToCollection(storeId, tableId, callback)` - Subscribe to all documents in a collection
  - `subscribeToDocument(storeId, tableId, recordId, callback)` - Subscribe to specific document
  - `subscribeToBucket(containerId, callback)` - Subscribe to all files in a bucket
  - `subscribeToFile(containerId, assetId, callback)` - Subscribe to specific file
  - Returns unsubscribe function for cleanup
  - Full React example with live updates

- **Account Preferences** - Store user-specific settings (64KB limit)
  - **Client-Side**: `getAccountPreferences()`, `updateAccountPreferences(prefs)`
  - **Server-Side**: `getAccountPreferences(accountId)`, `updateAccountPreferences(accountId, prefs)`
  - Preferences automatically merge with existing values
  - Perfect for themes, language settings, custom user configurations

- **Team Preferences (Client-Side)** - Store team-wide shared settings
  - `getTeamPreferences(teamId)` - Get team's shared preferences
  - `updateTeamPreferences(teamId, prefs)` - Update team preferences (requires owner/admin)
  - Shared by all team members
  - Ideal for team workflows, project settings, notification configs

- **Magic URL Authentication (Client-Side)** - Passwordless login via email
  - `sendMagicURL(email, loginUrl?)` - Send passwordless login email
  - `completeMagicURLSession(userId, secret)` - Complete magic URL authentication
  - No password required, more secure
  - Complete authentication flow example

- **Membership Status Updates (Client-Side)** - Accept/reject team invitations
  - `updateMembershipStatus(teamId, membershipId, userId, secret)` - Accept/reject invitations
  - Process invitation from email link
  - Automatically creates session on acceptance

### Changed

- **Type Definitions** - Added new TypeScript types:
  - `EsAccountPreferences` - Account preferences interface
  - `EsTeamPreferences` - Team preferences interface
  - `RealtimeCallback<T>` - Callback type for realtime events
  - `RealtimeResponseEvent<T>` - Realtime event response structure
  - `UnsubscribeFunction` - Unsubscribe function type
  - All types properly exported from client/server/main entry points

- **README.md** - 350+ lines of new documentation:
  - Updated Features section with 4 new features
  - Complete Realtime Subscriptions section with 5 methods and React example
  - Account Preferences documentation for both client and server
  - Team Preferences documentation with usage examples
  - Magic URL authentication with complete flow example
  - Membership status updates documentation
  - Version header updated to v2.0.5

### Implementation Details

All implementations follow Appwrite SDK patterns:
- Client methods use session-based authentication
- Server methods use API key authentication
- Type-safe with full TypeScript support
- Error handling with descriptive messages
- Automatic payload mapping to EsRecord/EsAsset types

**Build Status**: ✅ All code compiles successfully with no TypeScript errors

---

## [2.0.4] - 2026-06-25

### 📚 Complete API Documentation

This release adds comprehensive documentation for all client-side authentication methods and clarifies server vs client API availability.

### Added

- **Authentication Documentation (Client-Side)** - Complete documentation for 12 authentication methods:
  - `login()`, `logout()`, `getCurrentUser()`, `signup()`
  - OAuth with `loginWithProvider()` (Google, GitHub, Apple, Microsoft, Facebook, Twitter)
  - Profile management: `updateName()`, `updateEmail()`, `updatePassword()`
  - Password recovery: `sendPasswordRecovery()`, `completePasswordRecovery()`
  - Email verification: `sendEmailVerification()`, `completeEmailVerification()`
  - Complete React authentication component example

### Changed

- **README.md** - 220+ lines of new documentation
  - Clarified EsDbClient API works in both server and client
  - Separate constructor examples for server vs client
  - Updated all section headers with availability labels
  - Added cross-references between related sections

### Documentation Structure

All API sections now clearly labeled:
- ✅ **Record Operations** - Available in Both Server & Client
- ✅ **Asset Storage Operations** - Available in Both Server & Client
- ✅ **Account Operations** - Server-Side Only (admin operations)
- ✅ **Authentication** - Client-Side Only (user login/signup) [NEW]
- ✅ **Team Operations** - Client-Side Only (user-scoped)

**No code changes** - Documentation-only release.

---

## [2.0.3] - 2026-06-25

### 📚 Documentation Cleanup

This release cleans up the documentation by removing obsolete and temporary files.

### Removed

- **Obsolete Documentation Files** (1,900+ lines removed)
  - `BUILD_SYSTEM_FIXES.md` - Documented v2.0.1 (which didn't work)
  - `MIGRATION_V2.0.0_TO_V2.0.1.md` - Obsolete migration guide
  - `NEXTJS_DUAL_SUPPORT.md` - Too detailed, info now in quick start
  - `SCHEMA_FIX.md` - Old bug-specific documentation
  - `TYPE_SAFETY_DEMO.md` - Demo file, not essential

### Changed

- **README.md** - Added Documentation section for better navigation
- **package.json** - Updated `files` array to include all essential docs explicitly

### Documentation Structure

Final clean structure with only essential documentation:
- ✅ `README.md` - Complete API reference (32KB)
- ✅ `CHANGELOG.md` - Version history (this file)
- ✅ `V2.0.2_REAL_FIX.md` - Understanding the ESM fix (7.2KB)
- ✅ `NEXTJS_QUICK_START.md` - Quick start for Next.js (10KB)
- ✅ `MIGRATION_V2.md` - v1.x to v2.x migration (8.7KB)

**No code changes** - This is a documentation-only release.

---

## [2.0.2] - 2026-06-25

### 🔧 The REAL Fix - ESM Output

**v2.0.1 didn't actually solve the webpack/bundler issues** - this release provides the real solution.

### Fixed

- **CRITICAL: Changed from CommonJS to ESM output**
  - TypeScript now compiles to pure ESM (`import/export`) instead of CommonJS (`require/exports`)
  - Fixed `module: "commonjs"` → `module: "ESNext"` in TypeScript config
  - Added `moduleResolution: "bundler"` for modern bundler compatibility
  - Added `"type": "module"` to package.json

- **Webpack/Vite/Turbopack Compatibility**
  - Modern bundlers can now properly tree-shake and optimize the code
  - ESM enables static analysis for better dead code elimination
  - Resolved all bundler incompatibility issues

### Changed

- **Module Format:** All output is now pure ESM
  - `dist/client/` uses `import/export` statements
  - `dist/server/` uses `import/export` statements
  - No more `require()` or `module.exports`

### Benefits

- ✅ **20-30% smaller client bundles** via better tree-shaking
- ✅ **Faster builds** - modern bundlers optimize ESM better
- ✅ **Native browser support** - ESM works directly in modern browsers
- ✅ **Better code splitting** - ESM enables proper chunking

### Migration from v2.0.0/v2.0.1

**No code changes required!** Just update the package:

```bash
npm update @antelligent-app/everyday-cli
rm -rf .next
npm run dev
```

See [V2.0.2_REAL_FIX.md](./V2.0.2_REAL_FIX.md) for complete details on what was actually wrong and how v2.0.2 fixes it.

---

## [2.0.1] - 2026-06-25

### ⚠️ Note: This version did NOT fully solve the bundler issues

v2.0.1 attempted to fix webpack errors by separating TypeScript configs, but continued using CommonJS output. **Please upgrade to v2.0.2 for the real fix.**

### 🔧 Critical Fixes

This is a **critical patch** fixing build system issues that prevented the client package from working in browser/webpack environments.

### Fixed

- **CRITICAL: Client Build Node.js Dependencies**
  - Client code no longer includes Node.js type definitions
  - Fixed `UnhandledSchemeError: Reading from "node:assert"` in webpack/browser builds
  - Client package now works correctly in all bundlers (Webpack, Vite, Turbopack)

- **Build System Overhaul**
  - Created separate TypeScript configurations for server and client
  - Server builds with Node.js types (`tsconfig.server.json`)
  - Client builds with DOM types only (`tsconfig.client.json`)
  - Shared base configuration (`tsconfig.base.json`)

- **Package.json Exports**
  - Improved export conditions for better bundler resolution
  - Proper `node` conditions for server exports
  - Simplified `browser` conditions for client exports

### Changed

- **Build Process**
  - Split into separate server and client builds
  - New build commands: `build:server`, `build:client`, `build:clean`
  - Backwards compatible: `npm run build` runs both builds

### Added

- `BUILD_SYSTEM_FIXES.md` - Comprehensive documentation of all fixes
- Separate TypeScript configs: `tsconfig.base.json`, `tsconfig.server.json`, `tsconfig.client.json`

### Technical Details

**Before:**
- Single build with Node.js types for ALL code
- Client bundle included Node.js type references
- Failed in webpack/browser environments

**After:**
- Separate builds with environment-specific types
- Client bundle is pure browser code (no Node.js deps)
- Works in all JavaScript environments

See [BUILD_SYSTEM_FIXES.md](./BUILD_SYSTEM_FIXES.md) for complete technical details.

---

## [2.0.0] - 2026-06-25

### 🎉 Major Release: Dual-Environment Support

This is a **major release** introducing dual-environment support for both Node.js (server) and browser (client) usage.

### Added
- **Client-Side Support**: Full browser/client-side implementation using `appwrite` web SDK
  - Import from `@antelligent-app/everyday-cli/client` for browser environments
  - Session-based authentication (no API keys exposed)
  - Authentication methods: `login()`, `logout()`, `signup()`, `loginWithProvider()`
  - OAuth support: Google, GitHub, Apple, Microsoft, Facebook, Twitter
  - User profile management: `updateName()`, `updateEmail()`, `updatePassword()`
  - Password recovery: `sendPasswordRecovery()`, `completePasswordRecovery()`
  - Email verification: `sendEmailVerification()`, `completeEmailVerification()`
  - `getCurrentUser()` method to check authentication status
  - **Teams Management**: Full team collaboration support (client-side only)
    - `createTeam()`, `getTeam()`, `listTeams()`, `updateTeamName()`, `deleteTeam()`
    - `listTeamMembers()`, `createTeamMembership()`, `updateTeamMemberRoles()`
    - `deleteTeamMembership()`, `getTeamMembership()`
    - Team types: `EsTeam`, `EsTeamSet`, `EsTeamMember`, `EsTeamMemberSet`, `EsTeamMembership`

- **Server-Side Implementation**:
  - Import from `@antelligent-app/everyday-cli/server` for Node.js environments
  - Uses `node-appwrite` with API key authentication
  - Full admin operations (same as v1.x)

- **Universal Helpers**: Now environment-independent
  - `EsQuery`, `EsPermission`, `EsRole`, `EsID` work in both environments
  - Removed dependency on `node-appwrite` for helpers
  - Custom implementations for ID generation and query building

- **Documentation**:
  - `NEXTJS_DUAL_SUPPORT.md` - Comprehensive 600+ line strategy guide
  - `MIGRATION_V2.md` - Complete migration guide from v1.x
  - `examples/nextjs-usage.tsx` - Full Next.js integration examples
  - Updated README with dual-environment examples

- **Build System**:
  - Conditional exports in package.json
  - Separate builds for `/server` and `/client`
  - Tree-shaking for optimal bundle sizes

### Changed
- **BREAKING**: Import paths have changed
  - Old: `import { EsDbClient } from '@antelligent-app/everyday-cli'`
  - New (Server): `import { EsDbClient } from '@antelligent-app/everyday-cli/server'`
  - New (Client): `import { EsDbClient } from '@antelligent-app/everyday-cli/client'`
  - Default import still works but uses server implementation (backwards compatibility)

- **Project Structure**:
  - Reorganized into `/server`, `/client`, `/shared`, `/helpers` directories
  - Abstract base class in `/shared/base.ts`
  - Helpers moved to `/helpers` (universal implementation)

- **Configuration Types**:
  - `EsDbClientConfigServer` (requires `apiKey`)
  - `EsDbClientConfigBrowser` (no `apiKey`, uses sessions)

- **Helper Implementations**:
  - `EsID.unique()` now uses custom timestamp-based generation (no external dependency)
  - `EsQuery` now builds JSON strings directly (no Appwrite Query import)
  - `EsPermission` and `EsRole` use string templates

### Security
- **Enhanced Security Model**:
  - API keys strictly server-side only
  - Client-side uses session-based authentication
  - Type system prevents accidental API key exposure
  - Conditional exports ensure correct SDK per environment

### Performance
- **Optimized Bundles**:
  - Server builds: Only `node-appwrite` (~200KB)
  - Client builds: Only `appwrite` web SDK (~150KB)
  - Universal helpers: Zero dependencies
  - Better tree-shaking support

### Migration
- See [MIGRATION_V2.md](./MIGRATION_V2.md) for detailed upgrade instructions
- Backwards compatible default export for v1.x users
- Simple import path changes required

## [1.1.1] - 2026-06-23

### Fixed
- **Schema Pull**: Fixed issue where `schema pull` would generate invalid integer min/max values
- Integer attributes with bounds outside JavaScript's safe integer range (±9,007,199,254,740,991) are now automatically handled
- The `mapAttributeFromAppwrite` method now detects and omits unsafe min/max values with warnings
- Enhanced schema validator to catch unsafe integer bounds before pushing to Appwrite
- Prevents corruption of 64-bit integer bounds from Appwrite during JSON serialization

### Added
- `SCHEMA_FIX.md` - Comprehensive troubleshooting guide for integer min/max issues
- Console warnings when unsafe integer values are detected during schema pull
- New validation error codes: `UNSAFE_INTEGER_MIN`, `UNSAFE_INTEGER_MAX`

### Changed
- Schema pull now automatically sanitizes integer min/max values to prevent push failures
- Validator provides clearer error messages with specific problematic values

## [1.1.0] - 2026-06-23

### Added
- Appwrite database integration via `EsDbClient`
- Complete CRUD operations for records, accounts, and assets
- Schema management system with CLI commands
- Schema validation and synchronization
- Environment variable support via `.env` files
- Comprehensive TypeScript type definitions
- Production-ready configuration
- `.env.example` template file
- `CHANGELOG.md` for version tracking

### Changed
- **BREAKING**: Updated package version to 1.1.0 for production release
- Updated README with comprehensive API documentation (355 → 743 lines)
- Updated package description to better reflect features
- Updated keywords to include: `typescript`, `database`, `appwrite`, `schema-management`, `flow-execution`, `automation`, `workflow`
- Reorganized project structure for better maintainability
- Enhanced error handling across all clients
- Improved `.gitignore` with comprehensive patterns (14 → 56 lines)

### Security
- Removed all hardcoded API keys from codebase
- Added `.env.example` for secure credential management
- Updated `.gitignore` to prevent accidental credential commits
- Removed test files containing sensitive data

### Removed
- Development documentation files (moved to internal docs)
  - API_NAMING_STRATEGY.md
  - DATABASE_API.md
  - DB_API_REFERENCE.md
  - IMPLEMENTATION_ROADMAP.md
  - PACKAGE_SUMMARY.md
  - SCHEMA_SYSTEM_PLAN.md
  - SCHEMA_TEST_RESULTS.md
  - SECURITY_BENEFITS.md
  - TEST_RESULTS.md
- Test files with hardcoded credentials (9 files)
- Temporary schema and metadata files
- **Total reduction**: 5,983 lines removed, 608 lines added (90% cleaner)

## [1.0.1] - 2026-06-19

### Added
- GitHub installation support via prepare script
- Package publishing configuration

### Changed
- Updated package metadata
- Improved build process

## [1.0.0] - 2026-06-18

### Added
- Initial release
- EsClient for flow execution
- CLI interface for running flows
- TypeScript support with 48 node types
- Helper methods for node filtering and data extraction
- Comprehensive documentation

### Features
- Flow execution with type-safe parameters
- Node type filtering
- JSON auto-parsing in node values
- Environment variable support for API keys
- Command-line interface

[1.1.1]: https://github.com/antelligent-app/everyday-cli/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/antelligent-app/everyday-cli/compare/v1.0.2...v1.1.0
[1.0.1]: https://github.com/antelligent-app/everyday-cli/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/antelligent-app/everyday-cli/releases/tag/v1.0.0
