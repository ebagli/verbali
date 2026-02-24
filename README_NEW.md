# Verbali - Internal Database Version

A transcription and meeting minutes platform with internal SQLite database.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
- `ELEVENLABS_API_KEY` - For audio transcription
- `LOVABLE_API_KEY` - For AI features
- `JWT_SECRET` - Change to secure random string

### 3. Start Application
```bash
npm run dev
```

This starts:
- API server on http://localhost:3001
- Frontend on http://localhost:8080

### 4. Login
Default credentials:
- Email: `admin@example.com`
- Password: `admin123`

**Change these immediately after first login!**

## Features

- Audio recording and transcription
- Speaker identification and mapping
- Automatic case extraction from medical-legal transcripts
- Meeting minutes (verbale) generation
- Export to DOCX format
- Local SQLite database - no external dependencies

## Architecture

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express.js + SQLite
- **Auth:** JWT tokens with bcrypt password hashing
- **AI Services:** ElevenLabs (transcription), Lovable AI (case extraction)

## Database

- **Location:** `data/verbali.db` (auto-created)
- **Type:** SQLite (file-based)
- **Tables:** users, authorized_users, transcriptions, speakers, sessions

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

### Transcriptions
- `GET /api/transcriptions` - List
- `POST /api/transcriptions` - Create
- `PUT /api/transcriptions/:id` - Update
- `DELETE /api/transcriptions/:id` - Delete

### Speakers
- `GET /api/speakers` - List
- `POST /api/speakers` - Create
- `DELETE /api/speakers/:id` - Delete

### AI
- `POST /api/ai/transcribe` - Transcribe audio
- `POST /api/ai/extract-cases` - Extract patient cases

## Security

- Password hashing with bcrypt
- JWT authentication (7-day expiration)
- Authorization whitelist
- CORS protection
- Session management

## Adding New Users

Add users to the `authorized_users` table:

```sql
INSERT INTO authorized_users (id, email, password_hash)
VALUES (
  'uuid-here',
  'user@example.com',
  -- Generate hash with: bcrypt.hash('password', 10)
  '$2b$10$...'
);
```

Or use the API to create users programmatically.

## Backup

```bash
# Backup database
cp data/verbali.db data/backup-$(date +%Y%m%d).db

# Restore database
cp data/backup-YYYYMMDD.db data/verbali.db
```

## Production Deployment

1. Set `JWT_SECRET` to strong random value
2. Remove/change default admin user
3. Set up HTTPS with reverse proxy
4. Use process manager (PM2)
5. Set up automated backups
6. Restrict file permissions on `data/` directory

## Troubleshooting

**Server won't start**
- Check port 3001 is available
- Verify .env file exists
- Check all dependencies installed

**Authentication fails**
- Verify JWT_SECRET is set
- Check token expiration
- Clear browser localStorage

**Database locked**
- Close SQLite browser tools
- Check file permissions

## Development

```bash
npm run dev          # Start both servers
npm run server       # Start API server only
npm run build        # Build for production
npm test             # Run tests
```

## File Structure

```
├── server/          # Express API
│   ├── index.ts     # Main server
│   ├── db.ts        # Database setup
│   ├── auth.ts      # Authentication
│   └── routes/      # API routes
├── src/             # React frontend
│   ├── lib/api.ts   # API client
│   ├── hooks/       # React hooks
│   ├── components/  # UI components
│   └── pages/       # Page components
├── data/            # SQLite database (auto-created)
└── .env             # Configuration
```

## License

Private - Not for distribution

## Support

For issues or questions, contact the development team.
