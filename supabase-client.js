/**
 * ChefTag — Supabase Client & Schema Guide
 *
 * SETUP INSTRUCTIONS (one-time):
 *
 * 1. Go to https://supabase.com and create a free account
 * 2. Create a new project (e.g. "cheftag")
 * 3. Go to Project Settings > API and copy:
 *    - Project URL
 *    - anon public key
 * 4. Go to SQL Editor and run the SQL below to create tables + RLS policies
 * 5. Replace the SUPABASE_URL and SUPABASE_ANON_KEY below with your values
 * 6. To seed the existing 5 chefs, use the SQL seed script (included below)
 *
 * That's it — the site will now read/write chefs from your database.
 */

// ============================================================
// >>> REPLACE THESE TWO VALUES WITH YOUR SUPABASE CREDENTIALS
// ============================================================
var SUPABASE_URL = "https://knvdfsgzsjfdufzrdkwf.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudmRmc2d6c2pmZHVmenJka3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTkyODEsImV4cCI6MjA5Nzk5NTI4MX0.o-5CYYNJZPVipJcX78y8FYkX6eArX4t_QFpGWv3ChXw";

// Admin key — bypasses RLS (removed for security, supplied at admin portal login)
var SUPABASE_SERVICE_KEY = "";
// ============================================================

/**
 * Creates a Supabase client using the CDN build.
 * This avoids npm/bundler — works on static GitHub Pages.
 */
function createSupabaseClient() {
  // Check if the library loaded under any known global name
  var sbLib = (typeof supabase !== "undefined") ? supabase
            : (typeof Supabase !== "undefined") ? Supabase
            : null;

  if (!sbLib) {
    console.error("[ChefTag] Supabase JS library not loaded. Check the <script> tag in your HTML.");
    return null;
  }

  if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL_HERE") {
    console.warn("[ChefTag] Supabase URL not configured.");
    return null;
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY_HERE") {
    console.warn("[ChefTag] Supabase anon key not configured.");
    return null;
  }

  try {
    var client = sbLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("[ChefTag] Supabase client created successfully for:", SUPABASE_URL);
    return client;
  } catch (err) {
    console.error("[ChefTag] Failed to create Supabase client:", err);
    return null;
  }
}

/**
 * ============================================================
 * SQL SCHEMA — Run this in Supabase SQL Editor
 * ============================================================

CREATE TABLE IF NOT EXISTS chefs (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  location TEXT NOT NULL,
  areas TEXT[] NOT NULL DEFAULT '{}',
  rate INTEGER NOT NULL DEFAULT 0,
  cuisines TEXT[] NOT NULL DEFAULT '{}',
  events TEXT[] NOT NULL DEFAULT '{}',
  specialty TEXT,
  image_url TEXT,
  rating NUMERIC(2,1) DEFAULT 0,
  capacity INTEGER DEFAULT 10,
  is_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chef_id UUID NOT NULL REFERENCES chefs(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE chefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 4. Chefs policies
-- Anyone can view approved+verified chefs
CREATE POLICY "Public read approved chefs"
  ON chefs FOR SELECT
  USING (is_approved = TRUE AND is_verified = TRUE);

-- Anyone can insert a new chef (sign-up)
CREATE POLICY "Allow chef sign-up"
  ON chefs FOR INSERT
  WITH CHECK (true);

-- 5. Reviews policies
-- Anyone can read reviews for approved chefs
CREATE POLICY "Public read reviews"
  ON reviews FOR SELECT
  USING (
    chef_id IN (SELECT id FROM chefs WHERE is_approved = TRUE AND is_verified = TRUE)
  );

-- Anyone can insert a review
CREATE POLICY "Allow review submit"
  ON reviews FOR INSERT
  WITH CHECK (true);

-- 6. Index for faster queries
CREATE INDEX IF NOT EXISTS idx_chefs_approved ON chefs(is_approved, is_verified);
CREATE INDEX IF NOT EXISTS idx_reviews_chef_id ON reviews(chef_id);

-- 7. Seed existing 5 chefs (run once)
INSERT INTO chefs (name, email, phone, location, areas, rate, cuisines, events, specialty, image_url, rating, capacity, is_verified, is_approved) VALUES
  ('Chef Amara Oke', 'amara@cheftag.com', '+2348010000001', 'Lagos', ARRAY['lagos','ikoyi','lekki','victoria island'], 65000, ARRAY['afrofusion','continental','grill'], ARRAY['private dinner','birthday','events'], 'Afro-fusion tasting menus, flame-grilled mains, and polished dinner service.', 'https://sfile.chatglm.cn/images-ppt/3318b5e331ef.jpg', 4.9, 24, TRUE, TRUE),
  ('Chef Leo Martins', 'leo@cheftag.com', '+2348010000002', 'Abuja', ARRAY['abuja','maitama','asokoro'], 55000, ARRAY['italian','continental','dessert'], ARRAY['private dinner','anniversary','brunch'], 'Handmade pasta, plated desserts, and intimate dinner-party menus.', 'https://sfile.chatglm.cn/images-ppt/8fb8360ec5b1.jpg', 4.8, 18, TRUE, TRUE),
  ('Chef Tomi Ade', 'tomi@cheftag.com', '+2348010000003', 'Lagos', ARRAY['lagos','yaba','surulere','ikeja'], 42000, ARRAY['vegan','afrofusion','continental'], ARRAY['meal prep','brunch','private dinner'], 'Bright plant-forward menus, wellness brunches, and weekly meal prep.', 'https://sfile.chatglm.cn/images-ppt/c99664597746.jpg', 4.7, 14, TRUE, TRUE),
  ('Chef Nora Bassey', 'nora@cheftag.com', '+2348010000004', 'Port Harcourt', ARRAY['port harcourt','gra','old gra'], 70000, ARRAY['grill','afrofusion','continental'], ARRAY['events','birthday','corporate'], 'Large-format grills, seafood spreads, and celebration catering.', 'https://sfile.chatglm.cn/images-ppt/16d0acbdd095.jpg', 5.0, 40, TRUE, TRUE),
  ('Chef Sade Cole', 'sade@cheftag.com', '+2348010000005', 'Lagos', ARRAY['lagos','ikoyi','lekki','victoria island'], 58000, ARRAY['continental','vegan','dessert'], ARRAY['anniversary','private dinner','brunch'], 'Modern small plates, elegant brunches, and allergy-aware menus.', 'https://sfile.chatglm.cn/images-ppt/5a61f50c2afd.jpg', 4.8, 20, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- 8. Some sample reviews
INSERT INTO reviews (chef_id, client_name, rating, comment) VALUES
  ((SELECT id FROM chefs WHERE email = 'amara@cheftag.com'), 'Adebayo O.', 5, 'Absolutely stunning dinner! The jollof risotto was a showstopper.'),
  ((SELECT id FROM chefs WHERE email = 'amara@cheftag.com'), 'Chidinma E.', 5, 'Chef Amara made my birthday unforgettable. 24 guests, zero complaints.'),
  ((SELECT id FROM chefs WHERE email = 'leo@cheftag.com'), 'Fatima M.', 4, 'Pasta was divine. Would love a bit more spice next time.'),
  ((SELECT id FROM chefs WHERE email = 'nora@cheftag.com'), 'Obinna K.', 5, 'Best grilled seafood spread I have ever had. Nora is a legend.'),
  ((SELECT id FROM chefs WHERE email = 'sade@cheftag.com'), 'Tolu A.', 5, 'Her allergy-aware menu saved my event. Every guest was impressed.')
ON CONFLICT DO NOTHING;

-- 9. Chat tables for in-app messaging

-- Conversations table (one per client-chef pair)
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

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'chef')),
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on chat tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies (restricted to authenticated clients & chefs)
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

-- Messages policies (restricted to conversation participants)
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

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_conversations_chef_id ON conversations(chef_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_email ON conversations(client_email);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Enable Realtime for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 10. Profiles table (auto-created on auth signup)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'chef')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

 * ============================================================
 */
