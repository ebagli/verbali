# Database Migration from Supabase to SQLite

## Overview

This application has been migrated from Supabase to an internal SQLite database with Express.js backend.

## Architecture Changes

### Before
- Supabase for database, authentication, and edge functions
- Direct client-to-Supabase communication

### After
- SQLite database (local file-based)
- Express.js API server
- JWT-based authentication
- Local file storage

## Setup Instructions

### 1. Install Dependencies

All dependencies are already installed. The key new packages are:
- `better-sqlite3` - SQLite database
- `express` - API server
- `jsonwebtoken` - JWT authentication
- `bcrypt` - Password hashing

### 2. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Update the following variables:
- `JWT_SECRET` - Change to a secure random string for production
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key for transcription
- `LOVABLE_API_KEY` - Your Lovable AI Gateway API key

### 3. Start the Application

```bash
npm run dev
```

This will start both:
- Express API server on port 3001
- Vite dev server on port 8080

### 4. Default Credentials

The system creates a default admin user:
- Email: `admin@example.com`
- Password: `admin123`

**IMPORTANT:** Change these credentials immediately after first login!

## Database Structure

The SQLite database is stored in `data/verbali.db` and contains:

### Tables

1. **users** - Application users
   - id, email, password_hash, created_at

2. **authorized_users** - Whitelist for login
   - id, email, password_hash, created_at

3. **transcriptions** - Audio transcriptions
   - id, user_id, conversation_date, transcript_json, speaker_mapping, summary, report_html, created_at

4. **speakers** - Speaker/participant registry
   - id, user_id, full_name, title, created_at

5. **sessions** - JWT token sessions
   - id, user_id, token, expires_at, created_at

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Transcriptions
- `GET /api/transcriptions` - List all transcriptions
- `GET /api/transcriptions/:id` - Get single transcription
- `POST /api/transcriptions` - Create transcription
- `PUT /api/transcriptions/:id` - Update transcription
- `DELETE /api/transcriptions/:id` - Delete transcription

### Speakers
- `GET /api/speakers` - List all speakers
- `POST /api/speakers` - Create speaker
- `DELETE /api/speakers/:id` - Delete speaker

### AI Services
- `POST /api/ai/transcribe` - Transcribe audio file
- `POST /api/ai/extract-cases` - Extract cases from transcript

## Security Features

1. **Password Hashing** - bcrypt with salt rounds
2. **JWT Tokens** - 7-day expiration
3. **Session Management** - Database-backed token validation
4. **Authorization Whitelist** - Only pre-approved users can log in
5. **CORS** - Configured for security

## Data Migration

If you have existing data in Supabase:

1. Export data from Supabase using their dashboard
2. Convert to SQL INSERT statements
3. Run against the SQLite database using `server/db.ts`

Example migration script:
```typescript
import { db } from './server/db.js';

// Insert existing users
const users = [...]; // Your exported data
users.forEach(user => {
  db.prepare(`
    INSERT INTO users (id, email, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `).run(user.id, user.email, user.password_hash, user.created_at);
});
```

## Backup and Restore

### Backup
```bash
cp data/verbali.db data/backup-$(date +%Y%m%d).db
```

### Restore
```bash
cp data/backup-YYYYMMDD.db data/verbali.db
```

## Production Deployment

1. **Change JWT_SECRET** to a strong random value
2. **Remove default user** or change password
3. **Set up file permissions** - Restrict access to `data/` directory
4. **Use process manager** - PM2 or similar for the Express server
5. **Set up HTTPS** - Use reverse proxy (nginx/Apache)
6. **Regular backups** - Automate database backups
7. **Monitor logs** - Server logs for security events

## Troubleshooting

### Database locked error
- Close any SQLite browser tools
- Check file permissions on `data/verbali.db`

### Authentication fails
- Check JWT_SECRET is set
- Verify token hasn't expired
- Clear browser localStorage

### Server won't start
- Check port 3001 is available
- Verify all dependencies installed
- Check .env file exists

## File Structure

```
project/
├── server/              # Express API server
│   ├── index.ts        # Main server file
│   ├── db.ts           # Database initialization
│   ├── auth.ts         # Authentication logic
│   └── routes/         # API routes
├── data/               # SQLite database (auto-created)
│   └── verbali.db     # Main database file
├── src/
│   ├── lib/
│   │   └── api.ts      # API client (replaces Supabase)
│   └── hooks/
│       └── useAuth.ts  # Updated auth hook
└── .env                # Environment variables
```

## Notes

- The SQLite database file will be created automatically on first run
- All data is stored locally - no external dependencies
- File uploads are handled in-memory for transcription
- Consider implementing file storage for large files in production
