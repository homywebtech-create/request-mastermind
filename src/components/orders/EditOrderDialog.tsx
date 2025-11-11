import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { countries } from "@/data/countries";
import { qatarAreas } from "@/data/areas";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Service {
  id: string;
  name: string;
  name_en: string;
  sub_services: Array<{
    id: string;
    name: string;
    name_en: string;
  }>;
}

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onSuccess: () => void;
  language: 'ar' | 'en';
}

interface OrderData {
  customerName: string;
  whatsappNumber: string;
  countryCode: string;
  phoneNumber: string;
  area: string;
  budget: string;
  budgetType: string;
  notes: string;
  preferredLanguage: 'ar' | 'en';
  cleaningEquipmentRequired: boolean | null;
  serviceType: string;
  customerLanguage: 'ar' | 'en';
  serviceId: string;
  subServiceId: string;
}

export function EditOrderDialog({ open, onOpenChange, orderId, onSuccess, language }: EditOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [orderData, setOrderData] = useState<OrderData>({
    customerName: '',
    whatsappNumber: '',
    countryCode: 'QA',
    phoneNumber: '',
    area: '',
    budget: '',
    budgetType: '',
    notes: '',
    preferredLanguage: 'ar',
    cleaningEquipmentRequired: null,
    serviceType: '',
    customerLanguage: 'ar',
    serviceId: '',
    subServiceId: '',
  });

  useEffect(() => {
    const fetchServices = async () => {
      const { data: servicesData } = await supabase
        .from('services')
        .select(`
          id,
          name,
          name_en,
          sub_services (
            id,
            name,
            name_en
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (servicesData) {
        setServices(servicesData as any);
      }
    };

    fetchServices();
  }, []);

  useEffect(() => {
    if (open && orderId) {
      fetchOrderData();
    }
  }, [open, orderId]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);
      
      const { data: servicesData } = await supabase
        .from('services')
        .select(`
          id,
          name,
          name_en,
          sub_services (
            id,
            name,
            name_en
          )
        `)
        .eq('is_active', true)
        .order('name');

      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers (
            name,
            whatsapp_number,
            area,
            budget,
            budget_type,
            preferred_language
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      if (order && order.customers) {
        // Extract country code and phone number
        const fullNumber = order.customers.whatsapp_number;
        let countryCode = 'QA';
        let phoneNumber = fullNumber;

        // Try to match country code
        for (const country of countries) {
          if (fullNumber.startsWith(country.dialCode)) {
            countryCode = country.code;
            phoneNumber = fullNumber.substring(country.dialCode.length);
            break;
          }
        }

        // Parse service type to get serviceId and subServiceId
        let serviceId = '';
        let subServiceId = '';
        
        if (order.service_type) {
          const parts = order.service_type.split(' - ');
          if (parts.length === 2) {
            const service = servicesData?.find(s => s.name === parts[0]);
            if (service) {
              serviceId = service.id;
              const subService = service.sub_services?.find((ss: any) => ss.name === parts[1]);
              if (subService) {
                subServiceId = subService.id;
              }
            }
          }
        }

        setOrderData({
          customerName: order.customers.name || '',
          whatsappNumber: fullNumber,
          countryCode,
          phoneNumber,
          area: order.customers.area || '',
          budget: order.customers.budget || '',
          budgetType: order.customers.budget_type || '',
          notes: order.notes || '',
          preferredLanguage: (order.customers.preferred_language as 'ar' | 'en') || 'ar',
          cleaningEquipmentRequired: order.cleaning_equipment_required,
          serviceType: order.service_type || '',
          customerLanguage: (order.customers.preferred_language as 'ar' | 'en') || 'ar',
          serviceId,
          subServiceId,
        });
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحميل بيانات الطلب' : 'Failed to load order data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate required fields
      if (!orderData.customerName.trim()) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يرجى إدخال اسم العميل' : 'Please enter customer name',
          variant: 'destructive',
        });
        return;
      }

      if (!orderData.phoneNumber || orderData.phoneNumber.length < 7) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يرجى إدخال رقم هاتف صحيح' : 'Please enter a valid phone number',
          variant: 'destructive',
        });
        return;
      }

      if (!orderData.area) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يرجى اختيار المنطقة' : 'Please select area',
          variant: 'destructive',
        });
        return;
      }

      // Get full WhatsApp number
      const country = countries.find(c => c.code === orderData.countryCode);
      const fullWhatsappNumber = `${country?.dialCode}${orderData.phoneNumber}`;

      // Build service type from service and sub-service
      let serviceType = orderData.serviceType;
      if (orderData.serviceId && orderData.subServiceId) {
        const service = services.find(s => s.id === orderData.serviceId);
        const subService = service?.sub_services.find(ss => ss.id === orderData.subServiceId);
        if (service && subService) {
          serviceType = `${service.name} - ${subService.name}`;
        }
      }

      // Update customer data
      const { data: orderInfo, error: orderError } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { error: customerError } = await supabase
        .from('customers')
        .update({
          name: orderData.customerName.trim(),
          whatsapp_number: fullWhatsappNumber,
          area: orderData.area,
          budget: orderData.budget || null,
          budget_type: orderData.budgetType || null,
          preferred_language: orderData.customerLanguage,
        })
        .eq('id', orderInfo.customer_id);

      if (customerError) throw customerError;

      // Update order data
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          notes: orderData.notes || null,
          cleaning_equipment_required: orderData.cleaningEquipmentRequired,
          service_type: serviceType,
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      console.log('✅ Order updated successfully:', {
        orderId,
        customerLanguage: orderData.customerLanguage,
        cleaningEquipment: orderData.cleaningEquipmentRequired,
        serviceType
      });

      // Force complete refresh of order data
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.refetchQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['order-stats'] });
      
      // Small delay to ensure queries complete
      await new Promise(resolve => setTimeout(resolve, 500));

      toast({
        title: language === 'ar' ? 'تم التحديث' : 'Updated',
        description: language === 'ar' ? 'تم تحديث بيانات الطلب بنجاح' : 'Order data updated successfully',
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحديث بيانات الطلب' : 'Failed to update order data',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isCleaningService = orderData.serviceType.includes('نظافة') || 
                            orderData.serviceType.includes('تنظيف') || 
                            orderData.serviceType.toLowerCase().includes('clean');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? '✏️ تعديل بيانات الطلب' : '✏️ Edit Order Details'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar' 
              ? 'قم بتعديل المعلومات الأساسية للطلب' 
              : 'Edit the basic information of the order'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="customerName">
                {language === 'ar' ? 'اسم العميل' : 'Customer Name'} *
              </Label>
              <Input
                id="customerName"
                value={orderData.customerName}
                onChange={(e) => setOrderData({ ...orderData, customerName: e.target.value })}
                placeholder={language === 'ar' ? 'أدخل اسم العميل' : 'Enter customer name'}
              />
            </div>

            {/* WhatsApp Number */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'كود الدولة' : 'Country Code'} *</Label>
                <Select
                  value={orderData.countryCode}
                  onValueChange={(value) => setOrderData({ ...orderData, countryCode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.flag} {country.nameAr} ({country.dialCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">
                  {language === 'ar' ? 'رقم الواتساب' : 'WhatsApp Number'} *
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={orderData.phoneNumber}
                  onChange={(e) => setOrderData({ ...orderData, phoneNumber: e.target.value })}
                  placeholder="33775033"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Service Type */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الخدمة الرئيسية' : 'Main Service'} *</Label>
                <Select
                  value={orderData.serviceId}
                  onValueChange={(value) => setOrderData({ ...orderData, serviceId: value, subServiceId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر الخدمة' : 'Select Service'} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 max-h-[300px]">
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الخدمة الفرعية' : 'Sub Service'} *</Label>
                <Select
                  value={orderData.subServiceId}
                  onValueChange={(value) => setOrderData({ ...orderData, subServiceId: value })}
                  disabled={!orderData.serviceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر الخدمة الفرعية' : 'Select Sub Service'} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50 max-h-[300px]">
                    {services
                      .find(s => s.id === orderData.serviceId)
                      ?.sub_services?.map((subService) => (
                        <SelectItem key={subService.id} value={subService.id}>
                          {subService.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Area */}
            <div className="space-y-2">
              <Label htmlFor="area">{language === 'ar' ? 'المنطقة' : 'Area'} *</Label>
              <Select
                value={orderData.area}
                onValueChange={(value) => setOrderData({ ...orderData, area: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر المنطقة' : 'Select Area'} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {qatarAreas.map((area) => (
                    <SelectItem key={area.id} value={area.name}>
                      {area.name} ({area.nameEn})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Budget */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'نوع السعر' : 'Price Type'}</Label>
                <Select
                  value={orderData.budgetType}
                  onValueChange={(value) => setOrderData({ ...orderData, budgetType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر النوع' : 'Select Type'} />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="hourly">{language === 'ar' ? 'بالساعة' : 'Hourly'}</SelectItem>
                    <SelectItem value="daily">{language === 'ar' ? 'يومي' : 'Daily'}</SelectItem>
                    <SelectItem value="task">{language === 'ar' ? 'بالمهمة' : 'Per Task'}</SelectItem>
                    <SelectItem value="service">{language === 'ar' ? 'للخدمة' : 'Per Service'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">{language === 'ar' ? 'الميزانية' : 'Budget'}</Label>
                <Input
                  id="budget"
                  type="number"
                  value={orderData.budget}
                  onChange={(e) => setOrderData({ ...orderData, budget: e.target.value })}
                  placeholder="0"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Customer Preferred Language */}
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'لغة العميل المفضلة' : 'Customer Preferred Language'} *</Label>
              <Select
                value={orderData.customerLanguage}
                onValueChange={(value: 'ar' | 'en') => setOrderData({ ...orderData, customerLanguage: value, preferredLanguage: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="ar">
                    🇸🇦 {language === 'ar' ? 'العربية' : 'Arabic'}
                  </SelectItem>
                  <SelectItem value="en">
                    🇬🇧 {language === 'ar' ? 'الإنجليزية' : 'English'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cleaning Equipment - Only for cleaning services */}
            {isCleaningService && (
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'معدات التنظيف' : 'Cleaning Equipment'}</Label>
                <Select
                  value={orderData.cleaningEquipmentRequired === null ? 'null' : orderData.cleaningEquipmentRequired ? 'yes' : 'no'}
                  onValueChange={(value) => setOrderData({ 
                    ...orderData, 
                    cleaningEquipmentRequired: value === 'null' ? null : value === 'yes' ? true : false 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="yes">
                      ✅ {language === 'ar' ? 'بمعدات التنظيف' : 'With Equipment'}
                    </SelectItem>
                    <SelectItem value="no">
                      ❌ {language === 'ar' ? 'بدون معدات' : 'Without Equipment'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">{language === 'ar' ? 'ملاحظات' : 'Notes'}</Label>
              <Textarea
                id="notes"
                value={orderData.notes}
                onChange={(e) => setOrderData({ ...orderData, notes: e.target.value })}
                placeholder={language === 'ar' ? 'أدخل ملاحظات إضافية...' : 'Enter additional notes...'}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {language === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
