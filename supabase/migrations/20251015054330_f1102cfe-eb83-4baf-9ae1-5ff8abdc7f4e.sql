-- Create contract templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content_ar TEXT NOT NULL,
  content_en TEXT NOT NULL,
  terms_ar TEXT[] NOT NULL DEFAULT '{}',
  terms_en TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage contract templates
CREATE POLICY "Admins can manage contract templates"
ON public.contract_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can view active templates (for customer-facing pages)
CREATE POLICY "Everyone can view active templates"
ON public.contract_templates
FOR SELECT
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default contract template
INSERT INTO public.contract_templates (
  title,
  content_ar,
  content_en,
  terms_ar,
  terms_en
) VALUES (
  'عقد الخدمة الشهرية الافتراضي',
  'عقد خدمة نظافة شهرية',
  'Monthly Cleaning Service Contract',
  ARRAY[
    'يمكن للطرف الأول طلب البديل في حال كانت العاملة غير مناسبة أو لا ترغب في العمل، ويجب إخطار المكتب فورية بصورة لإرسال السائق لأخذ العاملة حتى لا يتم احتساب أي قيمة إضافية.',
    'يتكفل الطرف الأول بتوفير مكان خاص ومناسب للعاملة في منزله.',
    'يتكفل الطرف الأول بتوفير طعام وشراب للعاملة 3 وجبات إما بتقديمه لها أو بإعطائها الإذن بإعداده.',
    'الطرف الثاني غير مسئول عن ضياع وفقدان أي شيء من منزل الطرف الأول، ويحث الطرف الأول بأن يحفظ أغراضه القيمة بعيد عن متناول الغرباء.',
    'الطرف الثاني مسئول عن علاج العاملة.',
    'الطرف الثاني مسئول عن تجديد الأوراق الخاصة بالعمالة.',
    'الطرف الأول مسؤول عن تدريب العاملة على استخدام الأدوات الكهربائية في المنزل، والطرف الثاني غير مسؤول عن أي أضرار تلحق بهذه الأدوات المعدات.',
    'الطرف الثاني غير مسؤول عن أي تلفيات تحدث في منزل الطرف الأول.',
    'في حال كان هناك مشكلة أو تقصير في عدم أداء العاملة مهامها بالطريق الصحيحة، يمكن أن يطلب الطرف الأول تبديل العاملة.',
    'يمكن للطرف الأول التواصل مع الطرف الثاني عبر الهاتف الخاص بالشركة الموضح لديكم في أوقات العمل الرسمية من الساعة 8 صباحا وحتى الساعة 10 ليل من يوم السبت وحتى يوم الخميس.'
  ],
  ARRAY[
    'The first party may request a replacement if the worker is not suitable or unwilling to work, and must immediately notify the office to send a driver to pick up the worker to avoid additional charges.',
    'The first party shall provide a private and suitable place for the worker in their home.',
    'The first party shall provide food and drink for the worker (3 meals) either by providing them or allowing her to prepare them.',
    'The second party is not responsible for the loss or disappearance of anything from the first party''s home, and urges the first party to keep valuable items away from strangers.',
    'The second party is responsible for the worker''s medical treatment.',
    'The second party is responsible for renewing labor-related documents.',
    'The first party is responsible for training the worker on using electrical appliances in the home, and the second party is not responsible for any damage to these appliances or equipment.',
    'The second party is not responsible for any damage occurring in the first party''s home.',
    'If there is a problem or failure in the worker''s performance of duties properly, the first party may request a replacement.',
    'The first party may contact the second party via the company phone shown during official working hours from 8 AM to 10 PM, Saturday through Thursday.'
  ]
);