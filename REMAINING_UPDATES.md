# Remaining Component Updates

The following components still need to be updated to replace Supabase with the new API client:

## Components to Update

### 1. `src/components/SpeakerManager.tsx`
- Replace `supabase.from("speakers")` with `api.speakers`
- Update insert, delete operations

### 2. `src/pages/TranscriptionEditor.tsx`
- Replace `supabase.from("transcriptions")` with `api.transcriptions`
- Replace `supabase.from("speakers")` with `api.speakers`
- Update fetch, update, delete operations

### 3. `src/components/VerbaleManager.tsx`
- Replace `supabase.functions.invoke("extract-cases")` with `api.ai.extractCases`
- Replace `supabase.from("transcriptions")` with `api.transcriptions`
- Replace `supabase.from("speakers")` with `api.speakers`

### 4. `src/pages/AccessDenied.tsx`
- Replace `supabase.auth.signOut()` with `signOut()` from `useAuth` hook

### 5. `src/components/AppHeader.tsx`
- Check if user metadata access is correct

## Quick Find & Replace Patterns

Use these patterns to help with the migration:

```typescript
// OLD: Supabase queries
const { data } = await supabase.from("table_name").select("*")

// NEW: API calls
const data = await api.tableName.list()
```

```typescript
// OLD: Supabase insert
const { data, error } = await supabase.from("table_name").insert({...}).select().single()

// NEW: API create
const data = await api.tableName.create({...})
```

```typescript
// OLD: Supabase update
await supabase.from("table_name").update({...}).eq("id", id)

// NEW: API update
await api.tableName.update(id, {...})
```

```typescript
// OLD: Supabase delete
await supabase.from("table_name").delete().eq("id", id)

// NEW: API delete
await api.tableName.delete(id)
```

```typescript
// OLD: Supabase edge functions
await supabase.functions.invoke("function-name", { body: {...} })

// NEW: API calls
await api.ai.functionName({...})
```

## User Object Changes

The user object structure has changed:

### OLD (Supabase)
```typescript
{
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
  ...
}
```

### NEW (Internal)
```typescript
{
  id: string;
  email: string;
}
```

If components access `user.user_metadata`, they need to be updated.

## Testing After Migration

1. Test login/logout
2. Test creating new transcriptions
3. Test editing transcriptions
4. Test speaker management
5. Test generating verbale documents
6. Test AI features (transcription, case extraction)
7. Test file upload
8. Test search functionality

## Common Issues

### Issue: "Cannot read property of undefined"
**Cause:** User object structure changed
**Fix:** Update code that accesses `user.user_metadata`

### Issue: API call fails
**Cause:** Server not running or wrong endpoint
**Fix:** Ensure `npm run dev` is running both servers

### Issue: Authentication doesn't persist
**Cause:** Token not stored
**Fix:** Check browser localStorage for `auth_token`

### Issue: Database doesn't exist
**Cause:** Database not initialized
**Fix:** Server creates it automatically on first run
