-- RLS baseline: exact mirror of production pg_policies as of 2026-09-17.
--
-- Before this migration, RLS lived in hand-applied supabase/week*.sql files and
-- ~40 policies existed only in prod. This file makes the repo the source of
-- truth. It is idempotent (DROP IF EXISTS + CREATE) and runs in one transaction,
-- so re-applying it to prod is a no-op. Expressions are as reported by
-- pg_policies, not hand-edited. Duplicate legacy/new policy pairs are kept
-- verbatim; collapsing them is a separate change.
--
-- Note: only policies are versioned here. Base table DDL predates the first
-- migration and still needs a pg_dump baseline (requires Docker or pg_dump).

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY; -- service_role only, no client policies
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confirmation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graveyard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gum_piece_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gum_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rotating_qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- blocked_users
DROP POLICY IF EXISTS "Users can manage their own blocks" ON public.blocked_users;
CREATE POLICY "Users can manage their own blocks" ON public.blocked_users
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.uid() = blocker_id));

-- bridges
DROP POLICY IF EXISTS "Bridges are created by the system only" ON public.bridges;
CREATE POLICY "Bridges are created by the system only" ON public.bridges
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (false);

DROP POLICY IF EXISTS "Users can see bridges they are part of" ON public.bridges;
CREATE POLICY "Users can see bridges they are part of" ON public.bridges
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id)));

DROP POLICY IF EXISTS "Users can view bridges of their connections" ON public.bridges;
CREATE POLICY "Users can view bridges of their connections" ON public.bridges
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id) OR (EXISTS ( SELECT 1
   FROM connections
  WHERE ((connections.status = 'active'::text) AND (((connections.user_a_id = auth.uid()) AND (connections.user_b_id = bridges.user_a_id)) OR ((connections.user_a_id = auth.uid()) AND (connections.user_b_id = bridges.user_b_id)) OR ((connections.user_b_id = auth.uid()) AND (connections.user_a_id = bridges.user_a_id)) OR ((connections.user_b_id = auth.uid()) AND (connections.user_a_id = bridges.user_b_id))))))));

DROP POLICY IF EXISTS "Users can view their own bridges" ON public.bridges;
CREATE POLICY "Users can view their own bridges" ON public.bridges
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id)));

-- categories
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
CREATE POLICY "Anyone can read categories" ON public.categories
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (true);

-- comments
DROP POLICY IF EXISTS "Comments visible to network" ON public.comments;
CREATE POLICY "Comments visible to network" ON public.comments
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM posts
  WHERE ((posts.id = comments.post_id) AND ((posts.author_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM connections
          WHERE ((connections.status = 'active'::text) AND (((connections.user_a_id = auth.uid()) AND (connections.user_b_id = posts.author_id)) OR ((connections.user_b_id = auth.uid()) AND (connections.user_a_id = posts.author_id)))))))))));

DROP POLICY IF EXISTS "Network members can see comments" ON public.comments;
CREATE POLICY "Network members can see comments" ON public.comments
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
CREATE POLICY "Users can create comments" ON public.comments
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can delete their own comments" ON public.comments
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can insert comments" ON public.comments;
CREATE POLICY "Users can insert comments" ON public.comments
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = user_id));

-- confirmation_sessions
DROP POLICY IF EXISTS "Users can see confirmation sessions for their pieces" ON public.confirmation_sessions;
CREATE POLICY "Users can see confirmation sessions for their pieces" ON public.confirmation_sessions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gum_pieces
  WHERE ((gum_pieces.id = confirmation_sessions.gum_piece_id) AND ((gum_pieces.creator_id = auth.uid()) OR (gum_pieces.recipient_id = auth.uid()))))));

DROP POLICY IF EXISTS "Users can view their confirmation sessions" ON public.confirmation_sessions;
CREATE POLICY "Users can view their confirmation sessions" ON public.confirmation_sessions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gum_pieces
  WHERE ((gum_pieces.id = confirmation_sessions.gum_piece_id) AND ((gum_pieces.creator_id = auth.uid()) OR (gum_pieces.recipient_id = auth.uid()))))));

-- connections
DROP POLICY IF EXISTS "Users can create connection requests" ON public.connections;
CREATE POLICY "Users can create connection requests" ON public.connections
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = requested_by));

DROP POLICY IF EXISTS "Users can see their own connections" ON public.connections;
CREATE POLICY "Users can see their own connections" ON public.connections
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id)));

DROP POLICY IF EXISTS "Users can update their own connections" ON public.connections;
CREATE POLICY "Users can update their own connections" ON public.connections
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id)));

DROP POLICY IF EXISTS "connections_insert_participant" ON public.connections;
CREATE POLICY "connections_insert_participant" ON public.connections
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (((user_a_id = auth.uid()) OR (user_b_id = auth.uid())));

DROP POLICY IF EXISTS "connections_select_participant" ON public.connections;
CREATE POLICY "connections_select_participant" ON public.connections
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (((user_a_id = auth.uid()) OR (user_b_id = auth.uid())));

DROP POLICY IF EXISTS "connections_update_participant" ON public.connections;
CREATE POLICY "connections_update_participant" ON public.connections
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (((user_a_id = auth.uid()) OR (user_b_id = auth.uid())))
  WITH CHECK (((user_a_id = auth.uid()) OR (user_b_id = auth.uid())));

-- graveyard
DROP POLICY IF EXISTS "Graveyard entries created by system only" ON public.graveyard;
CREATE POLICY "Graveyard entries created by system only" ON public.graveyard
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK (false);

DROP POLICY IF EXISTS "Users can see their own graveyard entries" ON public.graveyard;
CREATE POLICY "Users can see their own graveyard entries" ON public.graveyard
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id)));

DROP POLICY IF EXISTS "Users can view their own graveyard" ON public.graveyard;
CREATE POLICY "Users can view their own graveyard" ON public.graveyard
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = user_a_id) OR (auth.uid() = user_b_id)));

-- gum_piece_members
DROP POLICY IF EXISTS "gum_piece_members_select_for_members" ON public.gum_piece_members;
CREATE POLICY "gum_piece_members_select_for_members" ON public.gum_piece_members
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (is_gum_piece_member(gum_piece_id, auth.uid()));

-- gum_pieces
DROP POLICY IF EXISTS "Users can create gum pieces" ON public.gum_pieces;
CREATE POLICY "Users can create gum pieces" ON public.gum_pieces
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = creator_id));

DROP POLICY IF EXISTS "Users can update their own gum pieces" ON public.gum_pieces;
CREATE POLICY "Users can update their own gum pieces" ON public.gum_pieces
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING (((auth.uid() = creator_id) OR (auth.uid() = recipient_id)));

DROP POLICY IF EXISTS "gum_pieces_select_for_members" ON public.gum_pieces;
CREATE POLICY "gum_pieces_select_for_members" ON public.gum_pieces
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM gum_piece_members
  WHERE ((gum_piece_members.gum_piece_id = gum_pieces.id) AND (gum_piece_members.user_id = auth.uid())))));

-- notifications
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
CREATE POLICY "Users can see their own notifications" ON public.notifications
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "notifications_insert_own_or_related" ON public.notifications;
CREATE POLICY "notifications_insert_own_or_related" ON public.notifications
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()));

-- posts
DROP POLICY IF EXISTS "Network members can see posts" ON public.posts;
CREATE POLICY "Network members can see posts" ON public.posts
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = author_id) OR (EXISTS ( SELECT 1
   FROM connections
  WHERE ((connections.status = 'active'::text) AND (((connections.user_a_id = auth.uid()) AND (connections.user_b_id = posts.author_id)) OR ((connections.user_b_id = auth.uid()) AND (connections.user_a_id = posts.author_id))))))));

DROP POLICY IF EXISTS "Posts visible to network" ON public.posts;
CREATE POLICY "Posts visible to network" ON public.posts
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((auth.uid() = author_id) OR (EXISTS ( SELECT 1
   FROM connections
  WHERE ((connections.status = 'active'::text) AND (((connections.user_a_id = auth.uid()) AND (connections.user_b_id = posts.author_id)) OR ((connections.user_b_id = auth.uid()) AND (connections.user_a_id = posts.author_id))))))));

DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts" ON public.posts
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = author_id));

DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts" ON public.posts
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = author_id));

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" ON public.posts
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((auth.uid() = author_id))
  WITH CHECK ((auth.uid() = author_id));

-- reactions
DROP POLICY IF EXISTS "Network members can see reactions" ON public.reactions;
CREATE POLICY "Network members can see reactions" ON public.reactions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Reactions visible to network" ON public.reactions;
CREATE POLICY "Reactions visible to network" ON public.reactions
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((EXISTS ( SELECT 1
   FROM posts
  WHERE ((posts.id = reactions.post_id) AND ((posts.author_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM connections
          WHERE ((connections.status = 'active'::text) AND (((connections.user_a_id = auth.uid()) AND (connections.user_b_id = posts.author_id)) OR ((connections.user_b_id = auth.uid()) AND (connections.user_a_id = posts.author_id)))))))))));

DROP POLICY IF EXISTS "Users can delete their own reactions" ON public.reactions;
CREATE POLICY "Users can delete their own reactions" ON public.reactions
  AS PERMISSIVE
  FOR DELETE
  TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can manage their own reactions" ON public.reactions;
CREATE POLICY "Users can manage their own reactions" ON public.reactions
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users can react to posts" ON public.reactions;
CREATE POLICY "Users can react to posts" ON public.reactions
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = user_id));

-- rotating_qr_tokens
DROP POLICY IF EXISTS "Users can manage their own QR tokens" ON public.rotating_qr_tokens;
CREATE POLICY "Users can manage their own QR tokens" ON public.rotating_qr_tokens
  AS PERMISSIVE
  FOR ALL
  TO public
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "qr_delete_own" ON public.rotating_qr_tokens;
CREATE POLICY "qr_delete_own" ON public.rotating_qr_tokens
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "qr_insert_own" ON public.rotating_qr_tokens;
CREATE POLICY "qr_insert_own" ON public.rotating_qr_tokens
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "qr_tokens_insert_own" ON public.rotating_qr_tokens;
CREATE POLICY "qr_tokens_insert_own" ON public.rotating_qr_tokens
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "qr_tokens_select_own" ON public.rotating_qr_tokens;
CREATE POLICY "qr_tokens_select_own" ON public.rotating_qr_tokens
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "qr_tokens_update_own" ON public.rotating_qr_tokens;
CREATE POLICY "qr_tokens_update_own" ON public.rotating_qr_tokens
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

-- users
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  AS PERMISSIVE
  FOR INSERT
  TO public
  WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "Users can read any profile" ON public.users;
CREATE POLICY "Users can read any profile" ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  AS PERMISSIVE
  FOR UPDATE
  TO public
  USING ((auth.uid() = id));

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((id = auth.uid()));

DROP POLICY IF EXISTS "users_select_own_or_username_lookup" ON public.users;
CREATE POLICY "users_select_own_or_username_lookup" ON public.users
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

