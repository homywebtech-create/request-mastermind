import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Share2, FileSignature, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MonthlyContractProps {
  companyName: string;
  companyLogo: string | null;
  contractType: 'electronic' | 'physical' | '';
  onContractTypeChange: (type: 'electronic' | 'physical') => void;
  contractDuration: string;
  specialistNames: string[];
  startDate: string;
  language: 'ar' | 'en';
}

const translations = {
  ar: {
    title: 'عقد الخدمة الشهرية',
    subtitle: 'يرجى مراجعة العقد واختيار نوع التوقيع',
    contractTypes: 'نوع العقد',
    electronic: 'عقد إلكتروني',
    electronicDesc: 'سيتم توقيع العقد إلكترونياً وإرساله عبر البريد الإلكتروني',
    physical: 'عقد أصلي',
    physicalDesc: 'سيتم إرسال مندوب لتوقيع العقد الورقي معك',
    download: 'تنزيل العقد',
    share: 'مشاركة العقد',
    contractContent: {
      title: 'عقد خدمة نظافة شهرية',
      between: 'هذا عقد خدمة نظافة شهرية مبرم بين:',
      firstParty: 'الطرف الأول (مقدم الخدمة):',
      secondParty: 'الطرف الثاني (العميل)',
      duration: 'مدة العقد:',
      specialists: 'المحترفات المخصصات:',
      terms: 'بنود العقد:',
      termsList: [
        'يلتزم الطرف الأول بتقديم خدمة النظافة الشهرية حسب الجدول المتفق عليه.',
        'يلتزم الطرف الثاني بالدفع في المواعيد المحددة حسب قيمة العقد.',
        'يحق للطرف الأول استبدال المحترفة في حالة الضرورة مع إبلاغ الطرف الثاني مسبقاً.',
        'في حالة إلغاء العقد، يجب إشعار الطرف الآخر قبل شهر على الأقل.',
        'يتحمل الطرف الثاني مسؤولية توفير مواد التنظيف ما لم يتم الاتفاق على خلاف ذلك.',
        'لا يحق للطرف الثاني تكليف المحترفة بمهام خارج نطاق العقد.',
        'يجب على الطرف الثاني توفير بيئة عمل آمنة وصحية للمحترفة.',
        'يحق للطرف الأول إيقاف الخدمة في حالة عدم الالتزام بالدفع.',
      ],
      startDate: 'تاريخ بدء العقد:',
      signature: 'التوقيع',
      date: 'التاريخ'
    }
  },
  en: {
    title: 'Monthly Service Contract',
    subtitle: 'Please review the contract and choose signature type',
    contractTypes: 'Contract Type',
    electronic: 'Electronic Contract',
    electronicDesc: 'Contract will be signed electronically and sent via email',
    physical: 'Physical Contract',
    physicalDesc: 'A representative will be sent to sign the paper contract with you',
    download: 'Download Contract',
    share: 'Share Contract',
    contractContent: {
      title: 'Monthly Cleaning Service Contract',
      between: 'This is a monthly cleaning service contract between:',
      firstParty: 'First Party (Service Provider):',
      secondParty: 'Second Party (Client)',
      duration: 'Contract Duration:',
      specialists: 'Assigned Specialists:',
      terms: 'Contract Terms:',
      termsList: [
        'The first party commits to providing monthly cleaning service as per the agreed schedule.',
        'The second party commits to payment on the specified dates according to the contract value.',
        'The first party has the right to replace the specialist if necessary with prior notice to the second party.',
        'In case of contract cancellation, the other party must be notified at least one month in advance.',
        'The second party is responsible for providing cleaning materials unless otherwise agreed.',
        'The second party may not assign tasks to the specialist outside the contract scope.',
        'The second party must provide a safe and healthy work environment for the specialist.',
        'The first party has the right to suspend service in case of non-payment.',
      ],
      startDate: 'Contract Start Date:',
      signature: 'Signature',
      date: 'Date'
    }
  }
};

export function MonthlyContract({
  companyName,
  companyLogo,
  contractType,
  onContractTypeChange,
  contractDuration,
  specialistNames,
  startDate,
  language
}: MonthlyContractProps) {
  const t = translations[language];

  const handleDownload = () => {
    toast({
      title: language === 'ar' ? 'جاري التحميل' : 'Downloading',
      description: language === 'ar' ? 'سيتم تنزيل العقد قريباً' : 'Contract will be downloaded shortly',
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: t.contractContent.title,
        text: `${t.contractContent.title} - ${companyName}`,
      }).catch(() => {});
    } else {
      toast({
        title: language === 'ar' ? 'تم النسخ' : 'Copied',
        description: language === 'ar' ? 'تم نسخ رابط العقد' : 'Contract link copied',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold mb-2">{t.title}</h3>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            {t.download}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            {t.share}
          </Button>
        </div>
      </div>

      {/* Contract Preview */}
      <Card className="border-2">
        <CardContent className="p-8">
          <ScrollArea className="h-[400px] w-full pr-4">
            <div className="space-y-6">
              {/* Header with Logo */}
              <div className="text-center border-b pb-6">
                {companyLogo && (
                  <img 
                    src={companyLogo} 
                    alt={companyName} 
                    className="h-20 mx-auto mb-4 object-contain"
                  />
                )}
                <h2 className="text-2xl font-bold">{t.contractContent.title}</h2>
                <p className="text-sm text-muted-foreground mt-2">{companyName}</p>
              </div>

              {/* Contract Body */}
              <div className="space-y-4 text-sm">
                <p className="font-semibold">{t.contractContent.between}</p>

                <div>
                  <p className="font-semibold">{t.contractContent.firstParty}</p>
                  <p className="text-muted-foreground">{companyName}</p>
                </div>

                <div>
                  <p className="font-semibold">{t.contractContent.secondParty}</p>
                </div>

                <div>
                  <p className="font-semibold">{t.contractContent.duration}</p>
                  <p className="text-muted-foreground">{contractDuration}</p>
                </div>

                <div>
                  <p className="font-semibold">{t.contractContent.startDate}</p>
                  <p className="text-muted-foreground">{startDate}</p>
                </div>

                <div>
                  <p className="font-semibold">{t.contractContent.specialists}</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {specialistNames.map((name, index) => (
                      <li key={index}>{name}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="font-semibold mb-2">{t.contractContent.terms}</p>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    {t.contractContent.termsList.map((term, index) => (
                      <li key={index} className="leading-relaxed">{term}</li>
                    ))}
                  </ol>
                </div>

                {/* Signature Section */}
                <div className="grid grid-cols-2 gap-8 pt-8 border-t mt-8">
                  <div>
                    <p className="font-semibold mb-2">{t.contractContent.firstParty}</p>
                    <div className="border-t border-dashed pt-2 mt-8">
                      <p className="text-xs text-muted-foreground">{t.contractContent.signature}</p>
                    </div>
                    <div className="border-t border-dashed pt-2 mt-4">
                      <p className="text-xs text-muted-foreground">{t.contractContent.date}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold mb-2">{t.contractContent.secondParty}</p>
                    <div className="border-t border-dashed pt-2 mt-8">
                      <p className="text-xs text-muted-foreground">{t.contractContent.signature}</p>
                    </div>
                    <div className="border-t border-dashed pt-2 mt-4">
                      <p className="text-xs text-muted-foreground">{t.contractContent.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Contract Type Selection */}
      <Card>
        <CardContent className="p-6">
          <Label className="text-base font-semibold mb-4 block">{t.contractTypes}</Label>
          <RadioGroup
            value={contractType}
            onValueChange={(value) => onContractTypeChange(value as 'electronic' | 'physical')}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3 space-x-reverse p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <RadioGroupItem value="electronic" id="electronic" className="mt-1" />
              <Label htmlFor="electronic" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <FileSignature className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{t.electronic}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t.electronicDesc}</p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 space-x-reverse p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <RadioGroupItem value="physical" id="physical" className="mt-1" />
              <Label htmlFor="physical" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{t.physical}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t.physicalDesc}</p>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
