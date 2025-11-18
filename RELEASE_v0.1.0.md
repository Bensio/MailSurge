# MailSurge v0.1.0 Release

## Release Date
January 2025

## Overview
MailSurge v0.1.0 is the first stable release of the email campaign management tool. This release includes a complete enterprise-grade contact library system, email campaign management, and Gmail integration.

## Key Features

### Enterprise Contact Library
- ✅ Tabbed interface (Library / All / Campaigns)
- ✅ Real-time search and filtering
- ✅ Bulk operations (select, delete, move to library, export CSV)
- ✅ Automatic deduplication
- ✅ Campaign association tracking

### Email Campaign Management
- ✅ Visual email editor (Unlayer)
- ✅ Multiple Gmail account support
- ✅ Campaign sending with configurable delays
- ✅ Retry failed campaigns
- ✅ Archive completed campaigns
- ✅ Real-time progress tracking

### Gmail Integration
- ✅ OAuth 2.0 authentication
- ✅ Multiple account support
- ✅ Automatic token refresh
- ✅ Direct email sending via Gmail API

### Contact Management
- ✅ Individual contact addition
- ✅ CSV bulk upload
- ✅ Library-based contact storage
- ✅ Add contacts from library to campaigns
- ✅ Status tracking (pending, sent, failed)

## Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js (dev) + Vercel Serverless Functions (prod)
- **Database**: Supabase (PostgreSQL) with RLS
- **Email**: Gmail API
- **UI**: Shadcn/ui + Tailwind CSS
- **State**: Zustand
- **Validation**: Zod

## Database Migrations

Run these migrations in order:
1. `001_initial_schema.sql` - Base schema
2. `002_add_contacts_library.sql` - Contact library support
3. `003_add_from_email.sql` - Campaign from_email field
4. `004_add_archived_status.sql` - Archive functionality
5. `005_remove_duplicate_library_contacts.sql` - Cleanup (optional)

## Setup Instructions

1. Clone repository
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill in credentials
4. Run database migrations in Supabase
5. Run `npm run dev:all` to start development servers

## Breaking Changes

None - This is the initial release.

## Known Issues

- Server-side logging still uses console.log (will be improved in future versions)
- Some error messages use alert() instead of toast notifications

## Next Steps

See `CHANGELOG.md` for detailed feature list and `README.md` for setup instructions.

