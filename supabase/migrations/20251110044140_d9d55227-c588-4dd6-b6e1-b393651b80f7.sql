-- Create wallet_transactions table for specialist wallet
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  specialist_id UUID NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deduction', 'topup', 'refund')),
  balance_after NUMERIC NOT NULL,
  description TEXT,
  invoice_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_wallet_transactions_specialist_id ON public.wallet_transactions(specialist_id);
CREATE INDEX idx_wallet_transactions_order_id ON public.wallet_transactions(order_id);
CREATE INDEX idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);

-- Add wallet_balance to specialists table
ALTER TABLE public.specialists 
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0 NOT NULL;

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallet_transactions
CREATE POLICY "Specialists can view their own transactions"
ON public.wallet_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM specialists s
    JOIN profiles p ON p.phone = s.phone
    WHERE s.id = wallet_transactions.specialist_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all transactions"
ON public.wallet_transactions
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert transactions"
ON public.wallet_transactions
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update transactions"
ON public.wallet_transactions
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Companies can view their specialists transactions"
ON public.wallet_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM specialists s
    JOIN profiles p ON p.company_id = s.company_id
    WHERE s.id = wallet_transactions.specialist_id
    AND p.user_id = auth.uid()
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_wallet_transactions_updated_at
BEFORE UPDATE ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();