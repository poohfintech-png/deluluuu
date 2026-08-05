/*
# Enable Realtime on key tables

Adds tables to the supabase_realtime publication so the admin dashboard
auto-refreshes when data changes (payments, books, chapters, comments, profiles).
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chapters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
