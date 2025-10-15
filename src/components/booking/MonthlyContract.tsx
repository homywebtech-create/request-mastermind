import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Share2, FileSignature, User, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MonthlyContractProps {
  companyName: string;
  companyLogo: string | null;
  contractType: 'electronic' | 'physical' | '';
  onContractTypeChange: (type: 'electronic' | 'physical') => void;
  contractDuration: string;
  specialistNames: string[];
  startDate: string;
  language: 'ar' | 'en';
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  idCardNumber?: string;
  commercialRegister?: string;
  contractValue?: string;
  onApprove?: () => void;
}

const translations = {
  ar: {
    title: 'عقد الخدمة الشهرية',
    subtitle: 'يرجى مراجعة العقد واختيار نوع التوقيع',
    contractLanguage: 'لغة العقد',
    arabicVersion: 'النسخة العربية',
    englishVersion: 'النسخة الإنجليزية',
    contractTypes: 'نوع العقد',
    electronic: 'عقد إلكتروني',
    electronicDesc: 'الموافقة الإلكترونية على العقد',
    physical: 'عقد أصلي',
    physicalDesc: 'سيتم إرسال مندوب لتوقيع العقد الورقي معك',
    download: 'تنزيل PDF',
    share: 'مشاركة',
    approve: 'موافق على العقد',
    approved: 'تمت الموافقة',
    contractContent: {
      title: 'عقد خدمة نظافة شهرية',
      agreementDate: 'تم الاتفاق بتاريخ',
      between: 'بين:',
      firstParty: 'الطرف الأول',
      clientLabel: 'السيد / السيدة',
      idCard: 'بطاقة شخصية رقم',
      address: 'عنوان',
      and: 'وبين:',
      secondParty: 'الطرف الثاني',
      companyInfo: 'شركة',
      commercialRegister: 'سجل تجاري رقم',
      officeAddress: 'المكتب',
      agreementText: 'اتفق الطرفان على توفير عاملة أو محترفة نظافة لمدة',
      duration: 'مدة العقد',
      startingFrom: 'تبدأ من تاريخ العقد',
      financialValue: 'القيمة المالية للاتفاق',
      paymentTerms: 'شروط الدفع',
      specialists: 'العاملات المخصصات',
      terms: 'الأحكام والشروط',
      termsList: [
        'يمكن للطرف الأول طلب البديل في حال كانت العاملة غير مناسبة أو لا ترغب في العمل، ويجب إخطار المكتب فورية بصورة لإرسال السائق لأخذ العاملة حتى لا يتم احتساب أي قيمة إضافية.',
        'يتكفل الطرف الأول بتوفير مكان خاص ومناسب للعاملة في منزله.',
        'يتكفل الطرف الأول بتوفير طعام وشراب للعاملة 3 وجبات إما بتقديمه لها أو بإعطائها الإذن بإعداده.',
        'الطرف الثاني غير مسئول عن ضياع وفقدان أي شيء من منزل الطرف الأول، ويحث الطرف الأول بأن يحفظ أغراضه القيمة بعيد عن متناول الغرباء.',
        'الطرف الثاني مسئول عن علاج العاملة.',
        'الطرف الثاني مسئول عن تجديد الأوراق الخاصة بالعمالة.',
        'الطرف الأول مسؤول عن تدريب العاملة على استخدام الأدوات الكهربائية في المنزل، والطرف الثاني غير مسؤول عن أي أضرار تلحق بهذه الأدوات المعدات.',
        'الطرف الثاني غير مسؤول عن أي تلفيات تحدث في منزل الطرف الأول.',
        'في حال كان هناك مشكلة أو تقصير في عدم أداء العاملة مهامها بالطريق الصحيحة، يمكن أن يطلب الطرف الأول تبديل العاملة.',
        'يمكن للطرف الأول التواصل مع الطرف الثاني عبر الهاتف الخاص بالشركة الموضح لديكم في أوقات العمل الرسمية من الساعة 8 صباحا وحتى الساعة 10 ليل من يوم السبت وحتى يوم الخميس.',
      ],
      contractCopies: 'العقد مكون من نسختين لكل طرف ومرفق صورة البطاقة الشخصية للعاملة وإيصال استلام المبلغ.',
      startDate: 'تاريخ بدء العقد',
      signature: 'التوقيع',
      date: 'التاريخ'
    }
  },
  en: {
    title: 'Monthly Service Contract',
    subtitle: 'Please review the contract and choose signature type',
    contractLanguage: 'Contract Language',
    arabicVersion: 'Arabic Version',
    englishVersion: 'English Version',
    contractTypes: 'Contract Type',
    electronic: 'Electronic Contract',
    electronicDesc: 'Electronic approval of the contract',
    physical: 'Physical Contract',
    physicalDesc: 'A representative will be sent to sign the paper contract with you',
    download: 'Download PDF',
    share: 'Share',
    approve: 'Approve Contract',
    approved: 'Approved',
    contractContent: {
      title: 'Monthly Cleaning Service Contract',
      agreementDate: 'Agreement dated',
      between: 'Between:',
      firstParty: 'First Party',
      clientLabel: 'Mr. / Mrs.',
      idCard: 'ID Card No.',
      address: 'Address',
      and: 'And:',
      secondParty: 'Second Party',
      companyInfo: 'Company',
      commercialRegister: 'Commercial Register No.',
      officeAddress: 'Office',
      agreementText: 'The two parties have agreed to provide a cleaning worker or specialist for a period of',
      duration: 'Contract Duration',
      startingFrom: 'Starting from contract date',
      financialValue: 'Financial Value of Agreement',
      paymentTerms: 'Payment Terms',
      specialists: 'Assigned Workers',
      terms: 'Terms and Conditions',
      termsList: [
        'The first party may request a replacement if the worker is not suitable or unwilling to work, and must immediately notify the office to send a driver to pick up the worker to avoid additional charges.',
        'The first party shall provide a private and suitable place for the worker in their home.',
        'The first party shall provide food and drink for the worker (3 meals) either by providing them or allowing her to prepare them.',
        'The second party is not responsible for the loss or disappearance of anything from the first party\'s home, and urges the first party to keep valuable items away from strangers.',
        'The second party is responsible for the worker\'s medical treatment.',
        'The second party is responsible for renewing labor-related documents.',
        'The first party is responsible for training the worker on using electrical appliances in the home, and the second party is not responsible for any damage to these appliances or equipment.',
        'The second party is not responsible for any damage occurring in the first party\'s home.',
        'If there is a problem or failure in the worker\'s performance of duties properly, the first party may request a replacement.',
        'The first party may contact the second party via the company phone shown during official working hours from 8 AM to 10 PM, Saturday through Thursday.',
      ],
      contractCopies: 'The contract consists of two copies for each party, with a copy of the worker\'s ID card and receipt of payment.',
      startDate: 'Contract Start Date',
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
  language,
  customerName,
  customerPhone,
  customerAddress,
  idCardNumber,
  commercialRegister,
  contractValue,
  onApprove
}: MonthlyContractProps) {
  const [contractLanguage, setContractLanguage] = useState<'ar' | 'en'>('ar');
  const [isApproved, setIsApproved] = useState(false);
  const t = translations[language];
  const contractT = translations[contractLanguage];

  const handleDownload = () => {
    toast({
      title: language === 'ar' ? 'جاري التحميل' : 'Downloading',
      description: language === 'ar' ? 'سيتم تنزيل العقد قريباً' : 'Contract will be downloaded shortly',
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: contractT.contractContent.title,
        text: `${contractT.contractContent.title} - ${companyName}`,
      }).catch(() => {});
    } else {
      toast({
        title: language === 'ar' ? 'تم النسخ' : 'Copied',
        description: language === 'ar' ? 'تم نسخ رابط العقد' : 'Contract link copied',
      });
    }
  };

  const handleApprove = () => {
    setIsApproved(true);
    onApprove?.();
    toast({
      title: language === 'ar' ? 'تمت الموافقة' : 'Approved',
      description: language === 'ar' ? 'تمت الموافقة على العقد بنجاح' : 'Contract approved successfully',
    });
  };

  const renderContractContent = (lang: 'ar' | 'en') => {
    const ct = translations[lang].contractContent;
    return (
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
          <h2 className="text-2xl font-bold">{ct.title}</h2>
          <p className="text-sm text-muted-foreground mt-2">{companyName}</p>
        </div>

        {/* Contract Body */}
        <div className="space-y-4 text-sm" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <p className="text-center font-semibold">{ct.agreementDate}: {startDate}</p>

          <div className="space-y-2">
            <p className="font-bold">{ct.between}</p>
            
            <div className="ps-4">
              <p className="font-semibold">● {ct.firstParty}</p>
              <p>{ct.clientLabel}: {customerName}</p>
              {idCardNumber && <p>{ct.idCard}: {idCardNumber}</p>}
              <p>{ct.address}: {customerAddress}</p>
            </div>

            <div className="ps-4 mt-4">
              <p className="font-semibold">● {ct.and}</p>
              <p className="font-semibold">● {ct.secondParty}</p>
              <p>{ct.companyInfo}: {companyName}</p>
              {commercialRegister && <p>{ct.commercialRegister}: {commercialRegister}</p>}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="font-semibold mb-2">● {ct.agreementText}:</p>
            <p className="ps-4">{contractDuration}</p>
            <p className="ps-4">{ct.startingFrom}</p>
          </div>

          {contractValue && (
            <div className="border-t pt-4">
              <p className="font-semibold mb-2">● {ct.financialValue}:</p>
              <p className="ps-4">{contractValue}</p>
            </div>
          )}

          {specialistNames.length > 0 && (
            <div className="border-t pt-4">
              <p className="font-semibold mb-2">{ct.specialists}:</p>
              <ul className="list-disc list-inside ps-4">
                {specialistNames.map((name, index) => (
                  <li key={index}>{name}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="font-bold mb-3">{ct.terms}:</p>
            <ul className="space-y-2 ps-4">
              {ct.termsList.map((term, index) => (
                <li key={index} className="leading-relaxed">- {term}</li>
              ))}
            </ul>
          </div>

          <div className="border-t pt-4 mt-6">
            <p className="text-xs">{ct.contractCopies}</p>
          </div>

          {/* Signature Section */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t mt-8">
            <div>
              <p className="font-semibold mb-2">{ct.secondParty}</p>
              <div className="border-t border-dashed pt-2 mt-8">
                <p className="text-xs text-muted-foreground">{ct.signature}</p>
              </div>
              <div className="border-t border-dashed pt-2 mt-4">
                <p className="text-xs text-muted-foreground">{ct.date}</p>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-2">{ct.firstParty}</p>
              <div className="border-t border-dashed pt-2 mt-8">
                <p className="text-xs text-muted-foreground">{ct.signature}</p>
              </div>
              <div className="border-t border-dashed pt-2 mt-4">
                <p className="text-xs text-muted-foreground">{ct.date}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-xl font-semibold mb-2">{t.title}</h3>
          <p className="text-muted-foreground text-sm">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 me-2" />
            {t.download}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 me-2" />
            {t.share}
          </Button>
        </div>
      </div>

      {/* Language Selection */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-semibold mb-3 block">{t.contractLanguage}</Label>
          <Tabs value={contractLanguage} onValueChange={(v) => setContractLanguage(v as 'ar' | 'en')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ar">{t.arabicVersion}</TabsTrigger>
              <TabsTrigger value="en">{t.englishVersion}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Contract Preview */}
      <Card className="border-2">
        <CardContent className="p-8">
          <ScrollArea className="h-[500px] w-full pr-4">
            {renderContractContent(contractLanguage)}
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
                  <Check className="h-5 w-5 text-primary" />
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

          {/* Electronic Approval Button */}
          {contractType === 'electronic' && (
            <div className="mt-6 pt-6 border-t">
              <Button
                onClick={handleApprove}
                disabled={isApproved}
                className="w-full"
                size="lg"
              >
                {isApproved ? (
                  <>
                    <Check className="h-5 w-5 me-2" />
                    {t.approved}
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 me-2" />
                    {t.approve}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
