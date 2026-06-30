-- =============================================================
-- ChefTag Chat System — SQL Setup
-- Run this in your Supabase SQL Editor
-- https://supabase.com/dashboard → SQL Editor
-- =============================================================

-- 1. Conversations table (one per client-chef pair)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Messages table (with is_read for read receipts)
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'chef')),
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. Conversations policies (restricted to authenticated clients & chefs)
CREATE POLICY "Allow users to read their own conversations" ON conversations
  FOR SELECT TO authenticated
  USING (
    client_email = auth.jwt() ->> 'email' OR 
    chef_id IN (SELECT id FROM chefs WHERE email = auth.jwt() ->> 'email')
  );

CREATE POLICY "Allow clients to start their own conversations" ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    client_email = auth.jwt() ->> 'email'
  );

CREATE POLICY "Allow participants to update conversations" ON conversations
  FOR UPDATE TO authenticated
  USING (
    client_email = auth.jwt() ->> 'email' OR 
    chef_id IN (SELECT id FROM chefs WHERE email = auth.jwt() ->> 'email')
  );

-- 5. Messages policies (restricted to conversation participants)
CREATE POLICY "Allow members to read messages" ON messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE 
        client_email = auth.jwt() ->> 'email' OR 
        chef_id IN (SELECT id FROM chefs WHERE email = auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Allow members to send messages" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE 
        client_email = auth.jwt() ->> 'email' OR 
        chef_id IN (SELECT id FROM chefs WHERE email = auth.jwt() ->> 'email')
    )
  );

-- Allow participants to mark messages as read
CREATE POLICY "Allow members to update messages" ON messages
  FOR UPDATE TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE 
        client_email = auth.jwt() ->> 'email' OR 
        chef_id IN (SELECT id FROM chefs WHERE email = auth.jwt() ->> 'email')
    )
  );

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_chef_id ON conversations(chef_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_email ON conversations(client_email);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(conversation_id, is_read);

-- 7. Enable Realtime for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- =============================================================
-- Migration: Add is_read column to existing tables
-- (Safe to re-run if column already exists)
-- =============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
