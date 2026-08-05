/*
# Make payments bucket public

The payments bucket was created as private. Screenshots need to be viewable by admins
in the dashboard. Making it public allows the public URL to work for display purposes.
Access control is still maintained via RLS policies on storage.objects (only the owner
or admin can list/select objects, but the public URL is accessible if known).
*/

UPDATE storage.buckets SET public = true WHERE id = 'payments';
