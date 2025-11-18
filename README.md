# MailSurge - Email Campaign Management Tool

**Version 0.1.0**

A production-ready email campaign management tool built for Viraal Media. Enterprise-grade contact library and email campaign management with Gmail integration.

## Features

### Core Features
- 📧 **Email Campaigns** - Create, send, and manage email campaigns
- 📝 **Visual Email Editor** - Drag-and-drop email design with Unlayer
- 📚 **Enterprise Contact Library** - Centralized contact management
- 📊 **Bulk Operations** - Select, delete, move, and export contacts
- 🔍 **Search & Filter** - Find contacts quickly across library and campaigns
- 📈 **Progress Tracking** - Real-time campaign sending progress
- 🔄 **Retry Failed** - Retry failed campaigns with one click
- 📦 **Archive Campaigns** - Organize completed campaigns

### Gmail Integration
- 🔐 **OAuth 2.0** - Secure Gmail account connection
- 📧 **Multiple Accounts** - Connect and use multiple Gmail addresses
- 🔄 **Auto Token Refresh** - Automatic token management
- ⚡ **Direct Sending** - Send emails directly via Gmail API

### Contact Management
- 📥 **CSV Upload** - Bulk import contacts
- ➕ **Manual Add** - Add contacts one by one
- 📚 **Library System** - Campaign-independent contact storage
- 🔗 **Campaign Linking** - Add library contacts to campaigns
- ✅ **Status Tracking** - Track sent, pending, and failed contacts

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **Email**: Gmail API
- **UI**: Shadcn/ui + Tailwind CSS
- **Editor**: Unlayer (react-email-editor)
- **Validation**: Zod
- **State**: Zustand

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Google Cloud account (for Gmail API)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/mailsurge.git
cd mailsurge
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Fill in `.env` with your credentials:
   - Get Supabase credentials from your Supabase project dashboard
   - Get Google OAuth credentials from Google Cloud Console (see [Gmail Setup Guide](./docs/GMAIL_SETUP.md))

5. Run database migrations (in order):
   - Go to Supabase Dashboard → SQL Editor
   - Run migrations in order: `001_initial_schema.sql`, `002_add_contacts_library.sql`, `003_add_from_email.sql`, `004_add_archived_status.sql`
   - Optionally run `005_remove_duplicate_library_contacts.sql` if you have existing duplicates

6. Start development servers:
```bash
npm run dev:all
```

This starts both the frontend (port 3000) and API server (port 3001).

7. Open [http://localhost:3000](http://localhost:3000)

### Development Scripts

- `npm run dev` - Start frontend only (Vite)
- `npm run dev:api` - Start API server only (Express)
- `npm run dev:all` - Start both servers concurrently
- `npm run stop` - Stop all running servers
- `npm run restart` - Restart all servers
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Project Structure

```
mailsurge/
├── api/                    # Vercel serverless functions
│   ├── campaigns/
│   ├── contacts/
│   ├── templates/
│   └── auth/
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # Shadcn components
│   │   ├── campaigns/
│   │   ├── contacts/
│   │   ├── editor/
│   │   └── layout/
│   ├── pages/             # Page components
│   ├── lib/               # Utilities
│   ├── stores/            # Zustand stores
│   └── types/             # TypeScript types
├── supabase/
│   └── migrations/        # Database migrations
└── docs/                  # Documentation
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - System design and scaling
- [Database](./docs/DATABASE.md) - Schema and RLS policies
- [API](./docs/API.md) - API endpoint documentation
- [Deployment](./docs/DEPLOYMENT.md) - Step-by-step deployment guide

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Quality

- TypeScript strict mode enabled
- ESLint for code linting
- Zod for runtime validation
- Proper error handling throughout

## Deployment

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

Quick steps:
1. Set up Supabase project
2. Configure Google Cloud (Gmail API)
3. Deploy to Vercel
4. Add environment variables
5. Run database migrations

## Environment Variables

Required environment variables:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_CLIENT_SECRET=your-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

## Version 0.1.0 Features

✅ **Implemented:**
- Enterprise contact library with tabs and search
- Bulk contact operations (select, delete, move, export)
- Email campaign creation and management
- Visual email editor (Unlayer)
- Gmail OAuth integration (multiple accounts)
- Campaign sending with retry and archive
- Contact status tracking
- Automatic deduplication

## Roadmap

- [ ] Email templates library
- [ ] Campaign scheduling
- [ ] A/B testing
- [ ] Analytics dashboard
- [ ] Webhook integrations
- [ ] Multi-user teams
- [ ] Advanced personalization
- [ ] Contact merge/deduplication tools
- [ ] Contact tags and groups

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open a GitHub issue
- Check documentation in `/docs`
- Review error logs

## Credits

Built for Viraal Media with ❤️


