import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countries } from "@/data/countries";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  sub_services: SubService[];
}

interface SubService {
  id: string;
  name: string;
}

interface OrderFormData {
  customerName: string;
  countryCode: string;
  phoneNumber: string;
  serviceId: string;
  subServiceId: string;
  sendToAll: boolean;
  companyId: string;
  notes: string;
}

interface SubmittedOrderData {
  customerName: string;
  whatsappNumber: string;
  serviceType: string;
  sendToAll: boolean;
  companyId?: string;
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
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState<OrderFormData>({
    customerName: '',
    countryCode: 'QA',
    phoneNumber: '',
    serviceId: '',
    subServiceId: '',
    sendToAll: true,
    companyId: '',
    notes: '',
  });

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (formData.serviceId) {
      const service = services.find(s => s.id === formData.serviceId);
      setSelectedService(service || null);
      setFormData(prev => ({ ...prev, subServiceId: '' }));
    }
  }, [formData.serviceId, services]);

  useEffect(() => {
    if (formData.serviceId && !formData.sendToAll) {
      fetchCompaniesForService(formData.serviceId, formData.subServiceId);
    } else {
      setCompanies([]);
    }
  }, [formData.serviceId, formData.subServiceId, formData.sendToAll]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select(`
          id,
          name,
          sub_services (
            id,
            name
          )
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchCompaniesForService = async (serviceId: string, subServiceId?: string) => {
    try {
      let query = supabase
        .from("company_services")
        .select(`
          company_id,
          companies!inner (
            id,
            name,
            is_active
          )
        `)
        .eq("companies.is_active", true)
        .eq("service_id", serviceId);

      if (subServiceId) {
        query = query.eq("sub_service_id", subServiceId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const uniqueCompanies = Array.from(
        new Map(
          data?.map((cs: any) => [
            cs.companies.id,
            { id: cs.companies.id, name: cs.companies.name }
          ])
        ).values()
      );

      setCompanies(uniqueCompanies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      setCompanies([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.phoneNumber || !formData.serviceId) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    // التحقق من اختيار خدمة فرعية إذا كانت موجودة
    if (selectedService && selectedService.sub_services.length > 0 && !formData.subServiceId) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى اختيار خدمة فرعية",
        variant: "destructive",
      });
      return;
    }

    // التحقق من اختيار شركة في حال عدم اختيار "كل الشركات"
    if (!formData.sendToAll && !formData.companyId) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى اختيار شركة محددة أو تفعيل خيار إرسال لكل الشركات",
        variant: "destructive",
      });
      return;
    }

    // دمج كود الدولة مع رقم الهاتف
    const selectedCountry = countries.find(c => c.code === formData.countryCode);
    const fullWhatsappNumber = `${selectedCountry?.dialCode}${formData.phoneNumber}`;
    
    // بناء serviceType من الأسماء
    const service = services.find(s => s.id === formData.serviceId);
    const subService = service?.sub_services.find(ss => ss.id === formData.subServiceId);
    const serviceType = subService ? `${service?.name} - ${subService.name}` : service?.name || "";
    
    const submittedData: SubmittedOrderData = {
      customerName: formData.customerName,
      whatsappNumber: fullWhatsappNumber,
      serviceType,
      sendToAll: formData.sendToAll,
      companyId: formData.sendToAll ? undefined : formData.companyId,
      notes: formData.notes
    };
    
    onSubmit(submittedData);
    
    setFormData({
      customerName: '',
      countryCode: 'QA',
      phoneNumber: '',
      serviceId: '',
      subServiceId: '',
      sendToAll: true,
      companyId: '',
      notes: '',
    });
    setSelectedService(null);
  };

  const handleInputChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => {
      if (field === 'serviceId') {
        return { ...prev, [field]: value, subServiceId: '', companyId: '' };
      }
      if (field === 'subServiceId') {
        return { ...prev, [field]: value, companyId: '' };
      }
      return { ...prev, [field]: value };
    });
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
                <Label htmlFor="serviceId">الخدمة الرئيسية *</Label>
                <Select value={formData.serviceId} onValueChange={(value) => handleInputChange('serviceId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الخدمة الرئيسية" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedService && selectedService.sub_services.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subServiceId">الخدمة الفرعية *</Label>
                  <Select value={formData.subServiceId} onValueChange={(value) => handleInputChange('subServiceId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الخدمة الفرعية" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedService.sub_services.map((subService) => (
                        <SelectItem key={subService.id} value={subService.id}>
                          {subService.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>إرسال الطلب إلى</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendToAll"
                    checked={formData.sendToAll}
                    onChange={() => {
                      setFormData(prev => ({ ...prev, sendToAll: true, companyId: '' }));
                    }}
                    className="w-4 h-4 text-primary"
                    disabled={!formData.serviceId}
                  />
                  <span className={`text-sm ${!formData.serviceId ? 'text-muted-foreground' : ''}`}>
                    كل الشركات
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendToAll"
                    checked={!formData.sendToAll}
                    onChange={() => {
                      setFormData(prev => ({ ...prev, sendToAll: false }));
                    }}
                    className="w-4 h-4 text-primary"
                    disabled={!formData.serviceId}
                  />
                  <span className={`text-sm ${!formData.serviceId ? 'text-muted-foreground' : ''}`}>
                    شركة محددة {companies.length > 0 && `(${companies.length})`}
                  </span>
                </label>
              </div>
              {!formData.serviceId && (
                <p className="text-xs text-muted-foreground">
                  اختر الخدمة أولاً
                </p>
              )}
              {formData.serviceId && !formData.sendToAll && companies.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  لا توجد شركات تقدم هذه الخدمة حالياً
                </p>
              )}
            </div>

            {!formData.sendToAll && (
              <div className="space-y-2">
                <Label htmlFor="companyId">اختر الشركة *</Label>
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
            )}
            
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