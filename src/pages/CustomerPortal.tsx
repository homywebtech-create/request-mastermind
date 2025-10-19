import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { sendWhatsAppMessage } from '@/lib/whatsappHelper';
import { qatarAreas } from '@/data/areas';

// Service icons mapping
const serviceIcons: Record<string, string> = {
  'Cleaning': '🧹',
  'تنظيف': '🧹',
  'Hospitality': '☕',
  'ضيافة': '☕',
  'Home salon': '💇',
  'صالون منزلي': '💇',
  'Home exercise': '🏋️',
  'رياضة منزلية': '🏋️',
  'Caregiver': '👶',
  'رعاية': '👶',
  'Teaching': '👨‍🏫',
  'تعليم': '👨‍🏫',
};

interface Service {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
}

interface SubService {
  id: string;
  service_id: string;
  name: string;
  name_en: string | null;
  description: string | null;
}

interface OrderData {
  id: string;
  customer_id: string;
  service_type: string;
  notes: string | null;
  hours_count: string | null;
  customers: {
    name: string;
    whatsapp_number: string;
    area: string | null;
    budget: string | null;
  };
}

export default function CustomerPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { language } = useLanguage();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  
  // Services data
  const [services, setServices] = useState<Service[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedSubService, setSelectedSubService] = useState<SubService | null>(null);
  
  // Form data
  const [hoursCount, setHoursCount] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [budget, setBudget] = useState('');

  const translations = {
    ar: {
      editOrder: 'تعديل الطلب',
      welcome: 'مرحباً',
      selectMainService: 'اختر الخدمة الرئيسية',
      selectSubService: 'اختر الخدمة الفرعية',
      orderDetails: 'تفاصيل الطلب',
      hoursCount: 'عدد الساعات',
      area: 'المنطقة',
      selectArea: 'اختر المنطقة',
      notes: 'ملاحظات',
      notesPlaceholder: 'أضف أي ملاحظات إضافية...',
      budget: 'الميزانية المتوقعة',
      budgetPlaceholder: 'مثال: 500 ريال',
      previous: 'السابق',
      next: 'التالي',
      sendOrder: 'إرسال الطلب',
      orderSent: 'تم إرسال الطلب',
      orderSentSuccess: 'تم إرسال طلبك بنجاح عبر واتساب',
      errorTitle: 'خطأ',
      loadError: 'حدث خطأ في تحميل البيانات',
      fillAllFields: 'يرجى ملء جميع الحقول',
      selectServiceError: 'يرجى اختيار الخدمة',
      selectSubServiceError: 'يرجى اختيار الخدمة الفرعية',
    },
    en: {
      editOrder: 'Edit Order',
      welcome: 'Welcome',
      selectMainService: 'Select Main Service',
      selectSubService: 'Select Sub Service',
      orderDetails: 'Order Details',
      hoursCount: 'Hours Count',
      area: 'Area',
      selectArea: 'Select Area',
      notes: 'Notes',
      notesPlaceholder: 'Add any additional notes...',
      budget: 'Expected Budget',
      budgetPlaceholder: 'Example: 500 QR',
      previous: 'Previous',
      next: 'Next',
      sendOrder: 'Send Order',
      orderSent: 'Order Sent',
      orderSentSuccess: 'Your order has been sent successfully via WhatsApp',
      errorTitle: 'Error',
      loadError: 'An error occurred while loading data',
      fillAllFields: 'Please fill all fields',
      selectServiceError: 'Please select a service',
      selectSubServiceError: 'Please select a sub service',
    },
  };

  const t = translations[language];

  useEffect(() => {
    fetchData();
  }, [orderId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      let orderDataTemp: OrderData | null = null;

      // Fetch order data if orderId exists
      if (orderId) {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select(`
            *,
            customers (
              name,
              whatsapp_number,
              area,
              budget
            )
          `)
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;
        setOrderData(order);
        orderDataTemp = order;
        
        // Pre-fill form with existing data
        if (order.hours_count) setHoursCount(order.hours_count);
        if (order.customers.area) setArea(order.customers.area);
        if (order.notes) setNotes(order.notes);
        if (order.customers.budget) setBudget(order.customers.budget);
      }

      // Fetch services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('id, name, name_en, description')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Fetch sub-services
      const { data: subServicesData, error: subServicesError } = await supabase
        .from('sub_services')
        .select('id, service_id, name, name_en, description')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (subServicesError) throw subServicesError;
      setSubServices(subServicesData || []);

      // Auto-select service and sub-service if order exists
      if (orderDataTemp && orderDataTemp.service_type) {
        // Find matching sub-service
        const matchingSubService = subServicesData?.find(
          (sub) => 
            sub.name === orderDataTemp.service_type || 
            sub.name_en === orderDataTemp.service_type
        );

        if (matchingSubService) {
          // Find parent service
          const parentService = servicesData?.find(
            (service) => service.id === matchingSubService.service_id
          );

          if (parentService) {
            setSelectedService(parentService);
            setSelectedSubService(matchingSubService);
            setCurrentStep(3); // Go directly to details step
          }
        }
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: t.errorTitle,
        description: t.loadError,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedSubService(null);
    setCurrentStep(2);
  };

  const handleSubServiceSelect = (subService: SubService) => {
    setSelectedSubService(subService);
    setCurrentStep(3);
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedService) {
      toast({
        title: t.errorTitle,
        description: t.selectServiceError,
        variant: 'destructive',
      });
      return;
    }
    if (currentStep === 2 && !selectedSubService) {
      toast({
        title: t.errorTitle,
        description: t.selectSubServiceError,
        variant: 'destructive',
      });
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!hoursCount || !area || !budget) {
      toast({
        title: t.errorTitle,
        description: t.fillAllFields,
        variant: 'destructive',
      });
      return;
    }

    try {
      const serviceTypeName = language === 'ar' 
        ? selectedSubService?.name 
        : (selectedSubService?.name_en || selectedSubService?.name);

      // Update order
      if (orderId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            service_type: serviceTypeName || '',
            hours_count: hoursCount,
            notes: notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) throw updateError;

        // Update customer
        if (orderData?.customer_id) {
          const { error: customerError } = await supabase
            .from('customers')
            .update({
              area: area,
              budget: budget,
            })
            .eq('id', orderData.customer_id);

          if (customerError) throw customerError;
        }
      }

      // Send WhatsApp message
      const message = `
${t.editOrder}

${t.selectMainService}: ${language === 'ar' ? selectedService?.name : (selectedService?.name_en || selectedService?.name)}
${t.selectSubService}: ${serviceTypeName}
${t.hoursCount}: ${hoursCount}
${t.area}: ${area}
${t.budget}: ${budget}
${notes ? `${t.notes}: ${notes}` : ''}
      `.trim();

      if (orderData?.customers?.whatsapp_number) {
        await sendWhatsAppMessage({
          to: orderData.customers.whatsapp_number,
          message: message,
          customerName: orderData.customers.name,
        });
      }

      toast({
        title: t.orderSent,
        description: t.orderSentSuccess,
      });

      // Redirect back or to order tracking
      setTimeout(() => {
        if (orderId) {
          navigate(`/order-tracking/${orderId}`);
        }
      }, 2000);

    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: t.errorTitle,
        description: t.loadError,
        variant: 'destructive',
      });
    }
  };

  const filteredSubServices = subServices.filter(
    (sub) => sub.service_id === selectedService?.id
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 px-6 py-6 border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {orderData ? t.editOrder : t.welcome}
              </h1>
              {orderData && (
                <div className="text-sm text-muted-foreground mt-1">
                  {orderData.customers.name}
                </div>
              )}
            </div>
            {selectedService && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'الخدمة' : 'Service'}
                </div>
                <div className="text-sm font-semibold">
                  {language === 'ar' ? selectedService.name : (selectedService.name_en || selectedService.name)}
                </div>
              </div>
            )}
          </div>
          {/* Progress indicator */}
          <div className="flex gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  step <= currentStep ? 'bg-primary shadow-sm' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="shadow-lg">
          <CardContent className="p-6 md:p-8">
            {/* Step 1: Select Main Service */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-foreground mb-4">
                  {t.selectMainService}
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {services.map((service) => {
                    const serviceName = language === 'ar' ? service.name : (service.name_en || service.name);
                    const icon = serviceIcons[serviceName] || serviceIcons[service.name] || '🔧';
                    
                    return (
                      <Card 
                        key={service.id}
                        className={`cursor-pointer hover:shadow-md transition-all hover:scale-105 border-2 ${
                          selectedService?.id === service.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => handleServiceSelect(service)}
                      >
                        <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                          <div className="text-5xl">{icon}</div>
                          <div className="text-sm font-semibold text-foreground">
                            {serviceName}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Select Sub Service */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ArrowRight className={`h-4 w-4 ${language === 'en' ? 'rotate-180' : ''}`} />
                  </Button>
                  <h2 className="text-xl font-bold text-foreground">
                    {t.selectSubService}
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredSubServices.map((subService) => {
                    const subServiceName = language === 'ar' ? subService.name : (subService.name_en || subService.name);
                    
                    return (
                      <Card 
                        key={subService.id}
                        className={`cursor-pointer hover:shadow-md transition-all border-2 ${
                          selectedSubService?.id === subService.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => handleSubServiceSelect(subService)}
                      >
                        <CardContent className="p-4">
                          <div className="font-semibold text-foreground">
                            {subServiceName}
                          </div>
                          {subService.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {subService.description}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Order Details */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(2)}
                  >
                    <ArrowRight className={`h-4 w-4 ${language === 'en' ? 'rotate-180' : ''}`} />
                  </Button>
                  <h2 className="text-xl font-bold text-foreground">
                    {t.orderDetails}
                  </h2>
                </div>

                <div className="space-y-4">
                  {/* Hours Count */}
                  <div className="space-y-2">
                    <Label htmlFor="hoursCount">{t.hoursCount}</Label>
                    <Input
                      id="hoursCount"
                      type="number"
                      value={hoursCount}
                      onChange={(e) => setHoursCount(e.target.value)}
                      placeholder="8"
                      min="1"
                    />
                  </div>

                  {/* Area */}
                  <div className="space-y-2">
                    <Label htmlFor="area">{t.area}</Label>
                    <Select value={area} onValueChange={setArea}>
                      <SelectTrigger>
                        <SelectValue placeholder={t.selectArea} />
                      </SelectTrigger>
                      <SelectContent>
                        {qatarAreas.map((qArea) => (
                          <SelectItem key={qArea.id} value={language === 'ar' ? qArea.name : qArea.nameEn}>
                            {language === 'ar' ? qArea.name : qArea.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Budget */}
                  <div className="space-y-2">
                    <Label htmlFor="budget">{t.budget}</Label>
                    <Input
                      id="budget"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder={t.budgetPlaceholder}
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">{t.notes}</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t.notesPlaceholder}
                      rows={4}
                      dir="auto"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-6 border-t mt-6">
              {currentStep > 1 && currentStep !== 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  className="flex items-center gap-2"
                >
                  {language === 'ar' ? (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      {t.previous}
                    </>
                  ) : (
                    <>
                      <ArrowLeft className="h-4 w-4" />
                      {t.previous}
                    </>
                  )}
                </Button>
              )}

              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2"
                  disabled={currentStep === 1 ? !selectedService : !selectedSubService}
                >
                  {language === 'ar' ? (
                    <>
                      {t.next}
                      <ArrowLeft className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      {t.next}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!hoursCount || !area || !budget}
                  className="flex-1 flex items-center justify-center gap-2 font-bold"
                >
                  <Check className="h-5 w-5" />
                  {t.sendOrder}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
