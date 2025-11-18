# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-XX

### Added
- **Enterprise Contact Library**
  - Tabbed interface (Library / All / Campaigns)
  - Real-time search and filtering
  - Bulk selection with checkboxes
  - Bulk operations: delete, move to library, export CSV
  - Automatic deduplication of library contacts
  - Contact status tracking (pending, sent, failed, bounced)

- **Email Campaign Management**
  - Create and manage email campaigns
  - Visual drag-and-drop email editor (Unlayer)
  - Campaign status tracking (draft, sending, completed, failed, archived)
  - Retry failed campaigns
  - Archive completed campaigns
  - Campaign progress tracking

- **Gmail Integration**
  - OAuth 2.0 authentication
  - Multiple Gmail account support
  - Automatic token refresh
  - Direct email sending via Gmail API
  - From email selection per campaign

- **Contact Management**
  - CSV bulk import
  - Manual contact addition
  - Library system (campaign-independent storage)
  - Add contacts from library to campaigns
  - Remove contacts from campaigns (keep in library)

- **User Interface**
  - Modern, responsive design with Tailwind CSS
  - Shadcn/ui component library
  - Dashboard with campaign statistics
  - Campaign list with filtering
  - Settings page for Gmail account management

### Technical
- TypeScript strict mode
- Zod schema validation
- Zustand state management
- Supabase PostgreSQL database
- Row-level security (RLS) policies
- Vercel serverless functions
- Express.js API server for local development
- Centralized logging utility
- Error handling throughout

### Database
- Initial schema with campaigns, contacts, and templates tables
- Contact library support (nullable campaign_id)
- From email field for campaigns
- Archived status for campaigns
- Unique constraints to prevent duplicates
- Migration scripts for database setup

### Fixed
- Token refresh handling for Gmail API
- Email formatting (From header, line endings)
- Contact status management
- Duplicate contact prevention
- User metadata refresh after OAuth
- Campaign retry functionality

### Security
- Environment variable configuration
- Secure token storage in Supabase user metadata
- CORS configuration
- Input validation with Zod

## [Unreleased]

### Planned
- Email templates library
- Campaign scheduling
- A/B testing
- Analytics dashboard
- Webhook integrations
- Multi-user teams
- Advanced personalization
- Contact merge/deduplication tools
- Contact tags and groups
