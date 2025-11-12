-- =====================================================
-- المرحلة 1: إنشاء جداول نظام الدفع والمحفظة
-- =====================================================

-- 1. جدول محفظة العملاء (Customer Wallets)
CREATE TABLE IF NOT EXISTS public.customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(customer_id)
);

-- Index لتحسين الأداء
CREATE INDEX idx_customer_wallets_customer_id ON public.customer_wallets(customer_id);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_customer_wallets_updated_at
  BEFORE UPDATE ON public.customer_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. جدول تأكيدات الدفع (Payment Confirmations)
CREATE TABLE IF NOT EXISTS public.payment_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES public.specialists(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- مبالغ الدفع
  invoice_amount NUMERIC(10, 2) NOT NULL, -- قيمة الفاتورة الأصلية
  amount_received NUMERIC(10, 2) NOT NULL, -- المبلغ المستلم فعلياً
  difference_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- الفرق (موجب = زيادة، سالب = نقص)
  
  -- سبب الفارق
  difference_reason TEXT CHECK (difference_reason IN ('tip', 'wallet', 'no_change', 'other')),
  other_reason_details TEXT, -- تفاصيل إضافية إذا كان السبب "other"
  
  -- حالة التأكيد
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending_customer_approval')),
  customer_confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- معلومات إضافية
  whatsapp_message_sent BOOLEAN DEFAULT false,
  whatsapp_message_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  -- قيد فريد: تأكيد دفع واحد لكل طلب
  UNIQUE(order_id)
);

-- Indexes لتحسين الأداء
CREATE INDEX idx_payment_confirmations_order_id ON public.payment_confirmations(order_id);
CREATE INDEX idx_payment_confirmations_specialist_id ON public.payment_confirmations(specialist_id);
CREATE INDEX idx_payment_confirmations_customer_id ON public.payment_confirmations(customer_id);
CREATE INDEX idx_payment_confirmations_status ON public.payment_confirmations(status);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_payment_confirmations_updated_at
  BEFORE UPDATE ON public.payment_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 3. جدول معاملات محفظة العملاء (Customer Wallet Transactions)
CREATE TABLE IF NOT EXISTS public.customer_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_confirmation_id UUID REFERENCES public.payment_confirmations(id) ON DELETE SET NULL,
  
  -- المبالغ
  amount NUMERIC(10, 2) NOT NULL, -- موجب = إضافة، سالب = خصم
  balance_after NUMERIC(10, 2) NOT NULL, -- الرصيد بعد العملية
  
  -- نوع المعاملة
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'debit', 'refund', 'adjustment')),
  description TEXT NOT NULL, -- وصف العملية
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes لتحسين الأداء
CREATE INDEX idx_customer_wallet_transactions_customer_id ON public.customer_wallet_transactions(customer_id);
CREATE INDEX idx_customer_wallet_transactions_order_id ON public.customer_wallet_transactions(order_id);
CREATE INDEX idx_customer_wallet_transactions_created_at ON public.customer_wallet_transactions(created_at DESC);

-- =====================================================
-- 4. إضافة أعمدة جديدة لجدول orders لتتبع حالة الدفع
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_confirmation_id UUID REFERENCES public.payment_confirmations(id) ON DELETE SET NULL;

-- =====================================================
-- Row Level Security Policies
-- =====================================================

-- تفعيل RLS
ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies لـ customer_wallets
CREATE POLICY "Admins can view all customer wallets"
  ON public.customer_wallets FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage customer wallets"
  ON public.customer_wallets FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Companies can view their customers wallets"
  ON public.customer_wallets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      JOIN public.profiles p ON p.company_id = c.company_id
      WHERE c.id = customer_wallets.customer_id
      AND p.user_id = auth.uid()
    )
  );

-- Policies لـ payment_confirmations
CREATE POLICY "Admins can view all payment confirmations"
  ON public.payment_confirmations FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage payment confirmations"
  ON public.payment_confirmations FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Companies can view their payment confirmations"
  ON public.payment_confirmations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.specialists s
      JOIN public.profiles p ON p.company_id = s.company_id
      WHERE s.id = payment_confirmations.specialist_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Specialists can insert payment confirmations"
  ON public.payment_confirmations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.specialists s
      JOIN public.profiles p ON p.phone = s.phone
      WHERE s.id = payment_confirmations.specialist_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Specialists can update their payment confirmations"
  ON public.payment_confirmations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.specialists s
      JOIN public.profiles p ON p.phone = s.phone
      WHERE s.id = payment_confirmations.specialist_id
      AND p.user_id = auth.uid()
    )
  );

-- Policies لـ customer_wallet_transactions
CREATE POLICY "Admins can view all wallet transactions"
  ON public.customer_wallet_transactions FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage wallet transactions"
  ON public.customer_wallet_transactions FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Companies can view their customers transactions"
  ON public.customer_wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      JOIN public.profiles p ON p.company_id = c.company_id
      WHERE c.id = customer_wallet_transactions.customer_id
      AND p.user_id = auth.uid()
    )
  );

-- =====================================================
-- Comments لتوثيق الجداول
-- =====================================================

COMMENT ON TABLE public.customer_wallets IS 'محفظة العملاء الرقمية - يتم تخزين الرصيد المتاح لكل عميل';
COMMENT ON TABLE public.payment_confirmations IS 'تأكيدات الدفع من المحترفين - تسجيل كامل لعملية الدفع وأي فروقات';
COMMENT ON TABLE public.customer_wallet_transactions IS 'سجل معاملات المحفظة - كل عملية إضافة أو خصم من محفظة العميل';

COMMENT ON COLUMN public.payment_confirmations.difference_reason IS 'سبب الفارق: tip=إكرامية, wallet=حفظ بالمحفظة, no_change=لا يوجد باقي, other=سبب آخر';
COMMENT ON COLUMN public.customer_wallet_transactions.transaction_type IS 'نوع المعاملة: credit=إضافة, debit=خصم, refund=استرجاع, adjustment=تعديل';