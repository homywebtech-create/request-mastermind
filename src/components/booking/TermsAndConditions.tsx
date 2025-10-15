import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';

interface TermsAndConditionsProps {
  accepted: boolean;
  onAcceptChange: (accepted: boolean) => void;
  language: 'ar' | 'en';
}

const translations = {
  ar: {
    title: 'الشروط والأحكام',
    subtitle: 'يرجى قراءة والموافقة على الشروط والأحكام التالية',
    accept: 'أوافق على الشروط والأحكام',
    terms: [
      'يجب أن يكون المنزل جاهزاً عند وصول المحترفة في الوقت المحدد.',
      'يتحمل العميل مسؤولية توفير مواد التنظيف والأدوات اللازمة ما لم يتم الاتفاق على خلاف ذلك.',
      'في حالة إلغاء الخدمة، يجب إخطار الشركة قبل 24 ساعة على الأقل.',
      'الأسعار المعروضة شاملة لساعات العمل المتفق عليها فقط.',
      'لا تتحمل الشركة مسؤولية أي أضرار ناتجة عن سوء استخدام العميل للخدمة.',
      'يحق للشركة تغيير المحترفة المخصصة في حالة الضرورة مع إبلاغ العميل.',
      'يلتزم العميل بالدفع فور إتمام الخدمة أو حسب الاتفاق المسبق.',
      'يحق للعميل تقييم الخدمة بعد الانتهاء منها.',
      'تخضع جميع الخدمات للقوانين واللوائح المحلية.',
    ]
  },
  en: {
    title: 'Terms and Conditions',
    subtitle: 'Please read and accept the following terms and conditions',
    accept: 'I agree to the terms and conditions',
    terms: [
      'The home must be ready when the specialist arrives at the scheduled time.',
      'The client is responsible for providing cleaning materials and necessary tools unless otherwise agreed.',
      'In case of service cancellation, the company must be notified at least 24 hours in advance.',
      'The displayed prices are inclusive of the agreed working hours only.',
      'The company is not responsible for any damages resulting from the client\'s misuse of the service.',
      'The company reserves the right to change the assigned specialist if necessary with client notification.',
      'The client is obligated to pay upon completion of the service or as per prior agreement.',
      'The client has the right to rate the service after completion.',
      'All services are subject to local laws and regulations.',
    ]
  }
};

export function TermsAndConditions({ accepted, onAcceptChange, language }: TermsAndConditionsProps) {
  const t = translations[language];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">{t.title}</h3>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <ScrollArea className="h-[300px] w-full pr-4">
            <ol className="space-y-3 list-decimal list-inside">
              {t.terms.map((term, index) => (
                <li key={index} className="text-sm leading-relaxed">
                  {term}
                </li>
              ))}
            </ol>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="flex items-start space-x-3 space-x-reverse">
        <Checkbox
          id="terms"
          checked={accepted}
          onCheckedChange={(checked) => onAcceptChange(checked as boolean)}
        />
        <Label
          htmlFor="terms"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          {t.accept}
        </Label>
      </div>
    </div>
  );
}
