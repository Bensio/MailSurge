# MailSurge v0.1.0

## Release Date
January 2025

## What's New

This is the initial release of MailSurge, a production-ready email campaign management tool.

### Enterprise Contact Library
- Tabbed interface (Library / All / Campaigns)
- Real-time search and filtering
- Bulk selection and operations
- CSV export functionality
- Automatic deduplication

### Email Campaigns
- Visual drag-and-drop email editor
- Campaign creation and management
- From email selection (multiple Gmail accounts)
- Campaign sending with configurable delay
- Retry failed campaigns
- Archive completed campaigns
- Real-time progress tracking

### Gmail Integration
- OAuth 2.0 authentication
- Multiple Gmail account support
- Automatic token refresh
- Direct email sending via Gmail API

### Contact Management
- CSV bulk import
- Manual contact addition
- Library system (campaign-independent)
- Add contacts from library to campaigns
- Contact status tracking

## Technical Details

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js (dev) + Vercel Serverless Functions (prod)
- **Database**: Supabase PostgreSQL with RLS
- **UI**: Shadcn/ui + Tailwind CSS
- **Email**: Gmail API via googleapis

## Installation

See README.md for complete setup instructions.

## Migration Guide

Run database migrations in order:
1. `001_initial_schema.sql`
2. `002_add_contacts_library.sql`
3. `003_add_from_email.sql`
4. `004_add_archived_status.sql`
5. `005_remove_duplicate_library_contacts.sql` (optional)

## Breaking Changes

None (initial release)

## Known Issues

None reported

## Next Steps

See ROADMAP in README.md for planned features.


