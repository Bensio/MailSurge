# API Documentation

All API routes are serverless functions deployed on Vercel.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://your-domain.vercel.app/api`

## Authentication

All endpoints (except auth callback) require authentication via Bearer token:

```
Authorization: Bearer <supabase_jwt_token>
```

## Endpoints

### Campaigns

#### Create Campaign

```http
POST /api/campaigns/create
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Q4 Launch",
  "subject": "Exciting news from {{company}}",
  "body_html": "<p>Hello {{company}}!</p>",
  "body_text": "Hello {{company}}!",
  "settings": {
    "delay": 45,
    "ccEmail": "cc@example.com"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "Q4 Launch",
  "subject": "Exciting news from {{company}}",
  "body_html": "<p>Hello {{company}}!</p>",
  "body_text": "Hello {{company}}!",
  "status": "draft",
  "settings": {
    "delay": 45,
    "ccEmail": "cc@example.com"
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Get Campaign

```http
GET /api/campaigns/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "Q4 Launch",
  "subject": "Exciting news from {{company}}",
  "body_html": "<p>Hello {{company}}!</p>",
  "body_text": "Hello {{company}}!",
  "status": "draft",
  "settings": {
    "delay": 45,
    "ccEmail": "cc@example.com"
  },
  "created_at": "2024-01-01T00:00:00Z",
  "contacts": [
    {
      "id": "uuid",
      "campaign_id": "uuid",
      "email": "user@example.com",
      "company": "Example Corp",
      "status": "pending"
    }
  ]
}
```

#### Update Campaign

```http
PUT /api/campaigns/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Updated Name",
  "status": "paused"
}
```

#### Delete Campaign

```http
DELETE /api/campaigns/:id
Authorization: Bearer <token>
```

**Response:** `204 No Content`

#### Send Campaign

```http
POST /api/campaigns/:id/send
Authorization: Bearer <token>
```

**Response:**
```json
{
  "status": "started",
  "total": 100
}
```

**Note:** This endpoint returns immediately and sends emails in the background.

### Contacts

#### Upload Contacts

```http
POST /api/contacts/upload
Content-Type: application/json
Authorization: Bearer <token>

{
  "campaign_id": "uuid",
  "contacts": [
    {
      "email": "user@example.com",
      "company": "Example Corp",
      "custom_fields": {
        "position": "CEO",
        "industry": "Tech"
      }
    }
  ]
}
```

**Response:**
```json
{
  "message": "Contacts uploaded successfully",
  "count": 1,
  "contacts": [
    {
      "id": "uuid",
      "campaign_id": "uuid",
      "email": "user@example.com",
      "company": "Example Corp",
      "status": "pending"
    }
  ]
}
```

### Templates

#### List Templates

```http
GET /api/templates/list
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Welcome Email",
    "subject": "Welcome!",
    "body_html": "<p>Welcome!</p>",
    "body_text": "Welcome!",
    "usage_count": 5,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Auth

#### Gmail OAuth Callback

```http
GET /api/auth/callback?code=<code>&state=<token>
```

**Response:** Redirects to `/settings?gmail=connected`

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message"
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `404` - Not Found
- `405` - Method Not Allowed
- `409` - Conflict (duplicate entry)
- `500` - Internal Server Error

### Validation Errors

When validation fails (400), response includes detailed errors:

```json
{
  "error": [
    {
      "path": ["email"],
      "message": "Invalid email address"
    }
  ]
}
```

## Rate Limits

- **Gmail API**: 2,000 emails/day per account
- **Supabase**: Based on plan (free tier: 2GB bandwidth)
- **Vercel**: 100GB bandwidth/month (free tier)

## Personalization

Email content supports template variables:

- `{{company}}` - Replaced with contact's company name

Example:
```
Subject: "News from {{company}}"
Body: "Hello {{company}} team!"
```

## Best Practices

1. **Always validate** data before sending to API
2. **Handle errors** gracefully in frontend
3. **Show loading states** during async operations
4. **Retry failed requests** with exponential backoff
5. **Cache responses** when appropriate
6. **Use pagination** for large lists (future)




