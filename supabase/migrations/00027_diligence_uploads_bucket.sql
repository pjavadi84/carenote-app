-- Create the `diligence-uploads` storage bucket used by the audio-upload
-- diligence flow.
--
-- Background: Vercel caps serverless request bodies at ~4.5 MB. Diligence
-- recordings are typically 30+ minutes (well past that cap), so the
-- audio cannot flow through `/api/diligence/process` directly. Instead:
--
--   1. The browser asks `/api/diligence/upload-url` for a short-lived
--      signed upload URL (minted by the service role).
--   2. The browser uploads the audio directly to Supabase Storage at
--      `<org_id>/<user_id>/<uuid>.<ext>`.
--   3. The browser POSTs `{ storagePath }` to `/api/diligence/process`.
--   4. The server mints a signed READ URL and hands it to Deepgram's
--      `/v1/listen` (Deepgram fetches the audio directly from Supabase).
--   5. The server deletes the object once transcription completes.
--
-- The bucket is private (public = false) and intentionally has NO RLS
-- policies on `storage.objects` for the authenticated role. Storage RLS is
-- default-deny, so the anon/authenticated JWT cannot read or list the
-- bucket. All access — minting upload URLs, minting read URLs, deletion —
-- happens via the service-role admin client, which bypasses RLS. Clients
-- only ever interact with the bucket via the time-limited tokens the
-- server hands them.
--
-- `file_size_limit` is enforced by Storage; the upload-URL route also
-- echoes its own cap so a too-large upload fails before bytes leave the
-- browser.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diligence-uploads',
  'diligence-uploads',
  false,
  104857600, -- 100 MiB
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg',
    'audio/flac',
    'audio/aac'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
