# Architecture Documentation

## System Overview

MailSurge is a serverless email campaign management tool built for scalability and cost-effectiveness. The system is designed to start at $0/month and scale as needed.

## Tech Stack

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/ui** - High-quality component library
- **Zustand** - Lightweight state management
- **React Router** - Client-side routing
- **Unlayer (react-email-editor)** - Visual email editor

### Backend
- **Vercel Serverless Functions** - API routes (Node.js)
- **Supabase** - PostgreSQL database + Authentication
- **Gmail API** - Email sending

### Validation & Utilities
- **Zod** - Schema validation
- **Lucide React** - Icon library

## System Architecture

```
┌─────────────────┐
│   React Frontend │
│   (Vite + TS)   │
└────────┬────────┘
         │
         │ HTTP/REST
         │
┌────────▼────────┐
│ Vercel API      │
│ Serverless      │
│ Functions       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Supabase│ │Gmail │
│Postgres│ │ API  │
└────────┘ └──────┘
```

## Data Flow

1. **User Authentication**
   - User signs in via Supabase Auth
   - JWT token stored in browser
   - Token sent with all API requests

2. **Campaign Creation**
   - User creates campaign in UI
   - Frontend validates with Zod
   - API route validates again
   - Campaign saved to Supabase
   - RLS ensures user can only access own campaigns

3. **Email Sending**
   - User triggers send from UI
   - API route verifies ownership
   - Background process sends emails via Gmail API
   - Status updated in real-time
   - Rate limiting: 45 seconds between emails (configurable)

## Scaling Strategy

### Current Limits (Free Tier)
- **Vercel**: 100GB bandwidth/month, unlimited requests
- **Supabase**: 500MB database, 2GB bandwidth
- **Gmail API**: 2,000 emails/day per account

### Upgrade Triggers

1. **Database Size > 400MB**
   - Upgrade to Supabase Pro ($25/month)
   - 8GB database, 50GB bandwidth

2. **Email Volume > 1,500/day**
   - Add additional Gmail accounts
   - Implement queue system with Redis (future)

3. **High Traffic**
   - Vercel Pro ($20/month) for better performance
   - Add CDN caching

4. **Advanced Features**
   - Redis for job queue ($10-20/month)
   - Email service provider (SendGrid/Mailgun) for higher limits

## Security

1. **Authentication**: Supabase Auth with JWT tokens
2. **Authorization**: Row Level Security (RLS) in Supabase
3. **Validation**: Zod schemas on frontend and backend
4. **HTTPS**: Enforced by Vercel
5. **Environment Variables**: Secrets stored in Vercel dashboard

## Performance Optimizations

1. **Database Indexes**: All foreign keys and status fields indexed
2. **Pagination**: Large lists paginated (future)
3. **Caching**: Static assets cached by Vercel CDN
4. **Lazy Loading**: Code splitting with React Router

## Future Enhancements

1. **Job Queue**: Redis for background email sending
2. **Email Templates**: Save and reuse templates
3. **Analytics**: Open rates, click tracking
4. **A/B Testing**: Test different subject lines
5. **Scheduling**: Schedule campaigns for future
6. **Webhooks**: Notify external systems on events






