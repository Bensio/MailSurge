# MailSurge v0.1.0 Release Notes

## 🎉 Initial Release

MailSurge v0.1.0 is the first stable release of our email campaign management tool. This version includes all core features needed for managing email campaigns and contacts.

## ✨ Key Features

### Enterprise Contact Library
- **Tabbed Interface**: Separate views for Library, All Contacts, and Campaign Contacts
- **Search & Filter**: Real-time search across email, name, company, and campaigns
- **Bulk Operations**: Select multiple contacts and perform bulk actions
  - Delete selected contacts
  - Move to library (remove from campaigns)
  - Export to CSV
- **Automatic Deduplication**: Prevents duplicate library contacts
- **Campaign Visibility**: See which campaigns each contact is in

### Email Campaign Management
- **Visual Editor**: Drag-and-drop email design with Unlayer
- **Campaign Creation**: Create campaigns with custom subject, content, and settings
- **From Email Selection**: Choose which Gmail account to send from
- **Campaign Sending**: Send emails with configurable delay between sends
- **Status Tracking**: Monitor campaign progress in real-time
- **Retry Failed**: One-click retry for failed campaigns
- **Archive**: Organize completed campaigns

### Gmail Integration
- **OAuth 2.0**: Secure authentication with Google
- **Multiple Accounts**: Connect and use multiple Gmail addresses
- **Auto Token Refresh**: Automatic token management
- **Direct Sending**: Send emails directly via Gmail API

### Contact Management
- **CSV Upload**: Bulk import contacts from CSV files
- **Manual Addition**: Add contacts one by one
- **Library System**: Store contacts independently of campaigns
- **Campaign Linking**: Add library contacts to campaigns
- **Status Tracking**: Track sent, pending, and failed contacts

## 🚀 Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase and Google OAuth credentials

3. **Run Database Migrations**
   - Go to Supabase Dashboard → SQL Editor
   - Run migrations in order: `001_initial_schema.sql` through `004_add_archived_status.sql`

4. **Start Development**
   ```bash
   npm run dev:all
   ```

5. **Access the Application**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

## 📋 Requirements

- Node.js 18+
- Supabase account
- Google Cloud account (for Gmail API)

## 🔧 Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js (dev) + Vercel Serverless Functions (prod)
- **Database**: Supabase (PostgreSQL)
- **Email**: Gmail API
- **UI**: Shadcn/ui + Tailwind CSS
- **Editor**: Unlayer (react-email-editor)

## 📝 Database Migrations

Run these migrations in order:
1. `001_initial_schema.sql` - Initial tables and RLS policies
2. `002_add_contacts_library.sql` - Contact library support
3. `003_add_from_email.sql` - Campaign from_email field
4. `004_add_archived_status.sql` - Campaign archived status
5. `005_remove_duplicate_library_contacts.sql` - Optional cleanup script

## 🐛 Known Issues

- None reported in v0.1.0

## 🔮 Roadmap

Future versions will include:
- Email templates library
- Campaign scheduling
- A/B testing
- Analytics dashboard
- Webhook integrations
- Multi-user teams
- Advanced personalization

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

Built for Viraal Media with ❤️


