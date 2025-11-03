-- Create specialist_chats table for conversations between companies and their specialists
CREATE TABLE IF NOT EXISTS public.specialist_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, specialist_id)
);

-- Create specialist_chat_messages table
CREATE TABLE IF NOT EXISTS public.specialist_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.specialist_chats(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('company', 'specialist')),
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.specialist_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for specialist_chats
-- Companies can view their specialists' chats
CREATE POLICY "Companies can view their specialists chats"
ON public.specialist_chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = specialist_chats.company_id
  )
);

-- Companies can manage their specialists' chats
CREATE POLICY "Companies can manage their specialists chats"
ON public.specialist_chats
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = specialist_chats.company_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.company_id = specialist_chats.company_id
  )
);

-- Specialists can view their own chats
CREATE POLICY "Specialists can view their own chats"
ON public.specialist_chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.specialists s
    JOIN public.profiles p ON p.phone = s.phone
    WHERE p.user_id = auth.uid()
    AND s.id = specialist_chats.specialist_id
  )
);

-- Admins can view all specialist chats
CREATE POLICY "Admins can view all specialist chats"
ON public.specialist_chats
FOR SELECT
USING (is_admin(auth.uid()));

-- RLS Policies for specialist_chat_messages
-- Users can view messages in their chats
CREATE POLICY "Users can view messages in their specialist chats"
ON public.specialist_chat_messages
FOR SELECT
USING (
  chat_id IN (
    SELECT sc.id FROM public.specialist_chats sc
    WHERE sc.company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR sc.specialist_id IN (
      SELECT s.id FROM public.specialists s
      JOIN public.profiles p ON p.phone = s.phone
      WHERE p.user_id = auth.uid()
    )
  )
);

-- Users can send messages in their chats
CREATE POLICY "Users can send messages in their specialist chats"
ON public.specialist_chat_messages
FOR INSERT
WITH CHECK (
  chat_id IN (
    SELECT sc.id FROM public.specialist_chats sc
    WHERE sc.company_id IN (
      SELECT company_id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR sc.specialist_id IN (
      SELECT s.id FROM public.specialists s
      JOIN public.profiles p ON p.phone = s.phone
      WHERE p.user_id = auth.uid()
    )
  )
);

-- Admins can view all messages
CREATE POLICY "Admins can view all specialist chat messages"
ON public.specialist_chat_messages
FOR SELECT
USING (is_admin(auth.uid()));

-- Create trigger to update updated_at
CREATE TRIGGER update_specialist_chats_updated_at
BEFORE UPDATE ON public.specialist_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_specialist_chats_company_id ON public.specialist_chats(company_id);
CREATE INDEX IF NOT EXISTS idx_specialist_chats_specialist_id ON public.specialist_chats(specialist_id);
CREATE INDEX IF NOT EXISTS idx_specialist_chat_messages_chat_id ON public.specialist_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_specialist_chat_messages_created_at ON public.specialist_chat_messages(created_at);

-- Add publication for realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.specialist_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.specialist_chat_messages;