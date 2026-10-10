-- Videos a member uploads when the server can't download them (Instagram
-- without the provider, private posts). They live here only while Gemini
-- watches them: the server deletes each file right after the analysis.
--
-- Private bucket, no storage policies: the browser uploads through a signed
-- upload URL the API creates after requireMember, and only the service role
-- reads or deletes. Paths are <room code>/<idea id>/<random>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('idea-videos', 'idea-videos', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'])
on conflict (id) do nothing;
