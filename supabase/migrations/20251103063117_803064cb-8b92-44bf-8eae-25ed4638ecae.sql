-- Create company chats table for admin-company communication
CREATE TABLE IF NOT EXISTS company_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create company chat messages table
CREATE TABLE IF NOT EXISTS company_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES company_chats(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'company')),
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_chats
CREATE POLICY "Admins can view all company chats"
  ON company_chats FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Companies can view their own chats"
  ON company_chats FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins can manage company chats"
  ON company_chats FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for company_chat_messages
CREATE POLICY "Users can view messages in their chats"
  ON company_chat_messages FOR SELECT
  TO authenticated
  USING (
    chat_id IN (
      SELECT cc.id FROM company_chats cc
      WHERE cc.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
    OR is_admin(auth.uid())
  );

CREATE POLICY "Users can send messages"
  ON company_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    chat_id IN (
      SELECT cc.id FROM company_chats cc
      WHERE cc.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
    OR is_admin(auth.uid())
  );

-- Add indexes for performance
CREATE INDEX idx_company_chats_company_id ON company_chats(company_id);
CREATE INDEX idx_company_chat_messages_chat_id ON company_chat_messages(chat_id);
CREATE INDEX idx_company_chat_messages_created_at ON company_chat_messages(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE company_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE company_chat_messages;