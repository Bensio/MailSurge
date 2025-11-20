# Commit Message for v0.1.0

```
feat: Initial release v0.1.0 - Enterprise Email Campaign Management

## 🎉 MailSurge v0.1.0 - Initial Release

### Core Features
- Enterprise contact library with tabbed interface (Library/All/Campaigns)
- Real-time search and filtering across contacts
- Bulk operations: select, delete, move to library, export CSV
- Automatic deduplication of library contacts
- Email campaign creation and management
- Visual drag-and-drop email editor (Unlayer)
- Gmail OAuth 2.0 integration with multiple account support
- Campaign sending with configurable delay
- Retry failed campaigns functionality
- Archive completed campaigns
- Contact status tracking (pending, sent, failed, bounced)
- From email selection per campaign

### Technical Implementation
- React 18 + TypeScript + Vite frontend
- Express.js API server for local development
- Vercel serverless functions for production
- Supabase PostgreSQL database with RLS policies
- Zustand state management
- Zod schema validation
- Centralized logging utility
- Shadcn/ui + Tailwind CSS for UI

### Database
- Initial schema with campaigns, contacts, templates tables
- Contact library support (nullable campaign_id)
- From email field for campaigns
- Archived status for campaigns
- Unique constraints to prevent duplicates
- 5 migration scripts included

### Developer Experience
- TypeScript strict mode
- ESLint configuration
- Comprehensive error handling
- Development scripts (dev, dev:api, dev:all, stop, restart)
- Server management utilities

### Documentation
- README with setup instructions
- CHANGELOG.md
- API documentation
- Database schema documentation
- Deployment guide
- Gmail setup guide

### Files Added
- Complete source code structure
- Database migrations
- API endpoints (Vercel serverless functions)
- UI components (Shadcn/ui based)
- Configuration files
- Documentation

Breaking Changes: None (initial release)

Migration Guide: Run database migrations 001-004 in order
```



