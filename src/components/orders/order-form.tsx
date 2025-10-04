import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { serviceTypes } from "@/data/serviceTypes";
import { countries } from "@/data/countries";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OrderFormData {
  customerName: string;
  countryCode: string;
  phoneNumber: string;
  serviceType: string;
  companyId: string;
  notes: string;
}

interface SubmittedOrderData {
  customerName: string;
  whatsappNumber: string;
  serviceType: string;
  companyId: string;
  notes: string;
}

interface Company {
  id: string;
  name: string;
}

interface OrderFormProps {
  onSubmit: (data: SubmittedOrderData) => void;
  onCancel?: () => void;
}

export function OrderForm({ onSubmit, onCancel }: OrderFormProps) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState<OrderFormData>({
    customerName: '',
    countryCode: 'QA', // قطر كدولة افتراضية
    phoneNumber: '',
    serviceType: '',
    companyId: '',
    notes: '',
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (data) {
      setCompanies(data);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.phoneNumber || !formData.serviceType || !formData.companyId) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    // دمج كود الدولة مع رقم الهاتف
    const selectedCountry = countries.find(c => c.code === formData.countryCode);
    const fullWhatsappNumber = `${selectedCountry?.dialCode}${formData.phoneNumber}`;
    
    const submittedData: SubmittedOrderData = {
      customerName: formData.customerName,
      whatsappNumber: fullWhatsappNumber,
      serviceType: formData.serviceType,
      companyId: formData.companyId,
      notes: formData.notes
    };
    
    onSubmit(submittedData);
    
    setFormData({
      customerName: '',
      countryCode: 'QA',
      phoneNumber: '',
      serviceType: '',
      companyId: '',
      notes: '',
    });
  };

  const handleInputChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          إنشاء طلب جديد
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">معلومات العميل</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">اسم العميل *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  placeholder="أدخل اسم العميل"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">رقم الواتساب *</Label>
                <div className="flex gap-2">
                  <Select 
                    value={formData.countryCode} 
                    onValueChange={(value) => handleInputChange('countryCode', value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue>
                        {(() => {
                          const country = countries.find(c => c.code === formData.countryCode);
                          return country ? (
                            <span className="flex items-center gap-2">
                              <span className="text-xl">{country.flag}</span>
                              <span className="text-sm">{country.dialCode}</span>
                            </span>
                          ) : 'اختر';
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {countries.map((country) => (
                        <SelectItem 
                          key={country.code} 
                          value={country.code}
                          className="cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-xl">{country.flag}</span>
                            <span className="font-medium">{country.nameAr}</span>
                            <span className="text-muted-foreground text-sm">{country.dialCode}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      // السماح بالأرقام فقط
                      const value = e.target.value.replace(/\D/g, '');
                      handleInputChange('phoneNumber', value);
                    }}
                    placeholder="501234567"
                    dir="ltr"
                    className="flex-1"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  أدخل الرقم بدون كود الدولة
                </p>
              </div>
            </div>
          </div>

          {/* Service Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">تفاصيل الخدمة</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceType">نوع الخدمة *</Label>
                <Select value={formData.serviceType} onValueChange={(value) => handleInputChange('serviceType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر نوع الخدمة" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((service) => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyId">الشركة المختصة *</Label>
                <Select value={formData.companyId} onValueChange={(value) => handleInputChange('companyId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الشركة" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="أدخل أي ملاحظات إضافية..."
                rows={3}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              إنشاء الطلب
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                إلغاء
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}