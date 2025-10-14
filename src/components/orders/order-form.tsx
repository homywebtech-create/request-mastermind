import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { countries } from "@/data/countries";
import { qatarAreas } from "@/data/areas";
import { Plus, Phone, User, Users, Check, ChevronsUpDown, ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  name_en: string | null;
  price?: number | null;
  sub_services: SubService[];
}

interface SubService {
  id: string;
  name: string;
  name_en: string | null;
  price?: number | null;
}

interface OrderFormData {
  customerName: string;
  countryCode: string;
  phoneNumber: string;
  area: string;
  budget: string;
  budgetType: string;
  serviceId: string;
  subServiceId: string;
  hoursCount: string;
  sendToAll: boolean;
  companyId: string;
  specialistIds: string[];
  notes: string;
}

interface SubmittedOrderData {
  customerName: string;
  whatsappNumber: string;
  area: string;
  budget: string;
  budgetType: string;
  serviceType: string;
  hoursCount: string;
  sendToAll: boolean;
  companyId?: string;
  specialistIds?: string[];
  notes: string;
}

interface Company {
  id: string;
  name: string;
}

interface Specialist {
  id: string;
  name: string;
  specialty: string | null;
  phone: string;
  image_url: string | null;
}

interface OrderFormProps {
  onSubmit: (data: SubmittedOrderData) => void;
  onCancel?: () => void;
}

export function OrderForm({ onSubmit, onCancel }: OrderFormProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [areaOpen, setAreaOpen] = useState(false);
  const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);
  const [formData, setFormData] = useState<OrderFormData>({
    customerName: '',
    countryCode: 'QA',
    phoneNumber: '',
    area: '',
    budget: '',
    budgetType: '',
    serviceId: '',
    subServiceId: '',
    hoursCount: '',
    sendToAll: true,
    companyId: '',
    specialistIds: [],
    notes: '',
  });

  const totalSteps = 4;

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

  useEffect(() => {
    if (formData.companyId) {
      fetchSpecialistsForCompany(formData.companyId);
    } else {
      setSpecialists([]);
    }
  }, [formData.companyId]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select(`
          id,
          name,
          name_en,
          price,
          sub_services (
            id,
            name,
            name_en,
            price
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

  const fetchSpecialistsForCompany = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from("specialists")
        .select("id, name, specialty, phone, image_url")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSpecialists(data || []);
    } catch (error) {
      console.error("Error fetching specialists:", error);
      setSpecialists([]);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        // Validate phone number
        if (!formData.phoneNumber || formData.phoneNumber.length < 7) {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى إدخال رقم واتساب صحيح / Please enter a valid WhatsApp number",
            variant: "destructive",
          });
          return false;
        }
        // Validate customer name
        if (!formData.customerName || formData.customerName.trim() === '') {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى إدخال اسم العميل / Please enter customer name",
            variant: "destructive",
          });
          return false;
        }
        // Validate area
        if (!formData.area || formData.area.trim() === '') {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار المنطقة / Please select area",
            variant: "destructive",
          });
          return false;
        }
        // Validate budget - both fields must be filled or both empty
        if ((formData.budget && !formData.budgetType) || (!formData.budget && formData.budgetType)) {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى إدخال الميزانية ونوع السعر معاً / Please enter both budget and price type",
            variant: "destructive",
          });
          return false;
        }
        // Validate budget is a number if provided
        if (formData.budget && isNaN(Number(formData.budget))) {
          toast({
            title: "بيانات خاطئة / Invalid Data",
            description: "يرجى إدخال رقم صحيح للميزانية / Please enter a valid budget number",
            variant: "destructive",
          });
          return false;
        }
        return true;

      case 2:
        // Validate service
        if (!formData.serviceId) {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار نوع الخدمة / Please select service type",
            variant: "destructive",
          });
          return false;
        }
        // Verify sub-service selection if available
        if (selectedService && selectedService.sub_services.length > 0 && !formData.subServiceId) {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار الخدمة الفرعية / Please select a sub-service",
            variant: "destructive",
          });
          return false;
        }
        return true;

      case 3:
        // Verify company selection if not sending to all
        if (!formData.sendToAll && !formData.companyId) {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار شركة محددة أو تفعيل الإرسال لجميع الشركات / Please select a specific company or enable send to all companies",
            variant: "destructive",
          });
          return false;
        }
        return true;

      case 4:
        return true;

      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) {
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
      area: formData.area,
      budget: formData.budget,
      budgetType: formData.budgetType,
      serviceType,
      hoursCount: formData.hoursCount,
      sendToAll: formData.sendToAll,
      companyId: formData.sendToAll ? undefined : formData.companyId,
      specialistIds: formData.specialistIds.length > 0 ? formData.specialistIds : undefined,
      notes: formData.notes
    };
    
    onSubmit(submittedData);
    
    setFormData({
      customerName: '',
      countryCode: 'QA',
      phoneNumber: '',
      area: '',
      budget: '',
      budgetType: '',
      serviceId: '',
      subServiceId: '',
      hoursCount: '',
      sendToAll: true,
      companyId: '',
      specialistIds: [],
      notes: '',
    });
    setSelectedService(null);
    setCurrentStep(1);
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, title: 'بيانات العميل', titleEn: 'Customer Info' },
      { number: 2, title: 'الخدمة', titleEn: 'Service' },
      { number: 3, title: 'الشركة', titleEn: 'Company' },
      { number: 4, title: 'ملاحظات', titleEn: 'Notes' }
    ];

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all",
                    currentStep >= step.number
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.number}
                </div>
                <div className="mt-2 text-center">
                  <div className={cn(
                    "text-sm font-medium",
                    currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{step.titleEn}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-1 mx-2 transition-all",
                    currentStep > step.number ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Check for existing customer when phone number is entered
  const checkExistingCustomer = async (phoneNumber: string, countryCode: string) => {
    if (!phoneNumber || phoneNumber.length < 7) return;
    
    setIsCheckingCustomer(true);
    try {
      const selectedCountry = countries.find(c => c.code === countryCode);
      const fullWhatsappNumber = `${selectedCountry?.dialCode}${phoneNumber}`;
      
      const { data, error } = await supabase
        .from('customers')
        .select('name, area, budget, budget_type')
        .eq('whatsapp_number', fullWhatsappNumber)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        // Customer found - auto-fill the name and other data
        setFormData(prev => ({
          ...prev,
          customerName: data.name,
          area: data.area || prev.area,
          budget: data.budget || prev.budget,
          budgetType: data.budget_type || prev.budgetType,
        }));
        
        toast({
          title: "عميل موجود / Existing Customer",
          description: `تم تعبئة بيانات العميل: ${data.name}`,
        });
      } else {
        // New customer - clear the name field for admin to enter
        setFormData(prev => ({
          ...prev,
          customerName: '',
        }));
      }
    } catch (error) {
      console.error('Error checking customer:', error);
    } finally {
      setIsCheckingCustomer(false);
    }
  };

  const handleInputChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => {
      if (field === 'serviceId') {
        return { ...prev, serviceId: value, subServiceId: '', companyId: '', specialistIds: [] };
      }
      if (field === 'subServiceId') {
        return { ...prev, subServiceId: value, companyId: '', specialistIds: [] };
      }
      if (field === 'companyId') {
        return { ...prev, companyId: value, specialistIds: [] };
      }
      // When phone number changes, check for existing customer
      if (field === 'phoneNumber' && value.length >= 7) {
        checkExistingCustomer(value, prev.countryCode);
      }
      // When country code changes and phone is already entered, recheck
      if (field === 'countryCode' && prev.phoneNumber.length >= 7) {
        setTimeout(() => checkExistingCustomer(prev.phoneNumber, value), 100);
      }
      return { ...prev, [field]: value };
    });
  };

  const toggleSpecialist = (specialistId: string) => {
    setFormData(prev => ({
      ...prev,
      specialistIds: prev.specialistIds.includes(specialistId)
        ? prev.specialistIds.filter(id => id !== specialistId)
        : [...prev.specialistIds, specialistId]
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          إنشاء طلب جديد / Create New Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderStepIndicator()}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Customer Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">بيانات العميل / Customer Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.phoneNumber && formData.phoneNumber.length >= 7 && (
                <div className="space-y-2">
                  <Label htmlFor="customerName">
                    اسم العميل / Customer Name *
                    {isCheckingCustomer && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (جاري البحث... / Checking...)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                    placeholder={isCheckingCustomer ? "جاري البحث عن العميل..." : "أدخل اسم العميل / Enter customer name"}
                    required
                    disabled={isCheckingCustomer}
                    dir="auto"
                  />
                  {formData.customerName && !isCheckingCustomer && (
                    <p className="text-xs text-muted-foreground">
                      تم العثور على العميل / Customer found
                    </p>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">WhatsApp Number *</Label>
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
                          ) : 'Select';
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
                      // Allow numbers only
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
                  Enter number without country code
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="area">المنطقة / Area *</Label>
                <Popover open={areaOpen} onOpenChange={setAreaOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={areaOpen}
                      className="w-full justify-between bg-background"
                    >
                      {formData.area || "اختر المنطقة / Select Area"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-background z-50">
                    <Command className="bg-background">
                      <CommandInput placeholder="ابحث عن المنطقة..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>لا توجد نتائج</CommandEmpty>
                        <CommandGroup>
                          {qatarAreas.map((area) => (
                            <CommandItem
                              key={area.id}
                              value={`${area.name} ${area.nameEn}`}
                              onSelect={() => {
                                handleInputChange('area', area.name);
                                setAreaOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.area === area.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-medium">{area.name}</span>
                              <span className="text-muted-foreground text-sm ml-2">({area.nameEn})</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="budget">الميزانية / Budget</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={formData.budgetType} onValueChange={(value) => handleInputChange('budgetType', value)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="نوع السعر / Price Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="hourly">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">بالساعة</span>
                          <span className="text-xs text-muted-foreground">Hourly</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="task">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">بالمهمة</span>
                          <span className="text-xs text-muted-foreground">Per Task</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="weekly">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">أسبوعي</span>
                          <span className="text-xs text-muted-foreground">Weekly</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="monthly">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">شهري</span>
                          <span className="text-xs text-muted-foreground">Monthly</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="service">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">للخدمة</span>
                          <span className="text-xs text-muted-foreground">Per Service</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="budget"
                    type="number"
                    min="0"
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
                    placeholder="المبلغ / Amount"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Step 2: Service Information */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">بيانات الخدمة / Service Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceId">Main Service *</Label>
                <Select value={formData.serviceId} onValueChange={(value) => handleInputChange('serviceId', value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Choose main service" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{service.name}</span>
                            {service.price && (
                              <Badge variant="secondary" className="text-xs">
                                {service.price} {countries.find(c => c.code === formData.countryCode)?.currencySymbol || 'SAR'}
                              </Badge>
                            )}
                          </div>
                          {service.name_en && (
                            <span className="text-xs text-muted-foreground">{service.name_en}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedService && selectedService.sub_services.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subServiceId">Sub-Service *</Label>
                  <Select value={formData.subServiceId} onValueChange={(value) => handleInputChange('subServiceId', value)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Choose sub-service" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {selectedService.sub_services.map((subService) => (
                        <SelectItem key={subService.id} value={subService.id}>
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{subService.name}</span>
                              {subService.price && (
                                <Badge variant="outline" className="text-xs">
                                  {subService.price} {countries.find(c => c.code === formData.countryCode)?.currencySymbol || 'SAR'}
                                </Badge>
                              )}
                            </div>
                            {subService.name_en && (
                              <span className="text-xs text-muted-foreground">{subService.name_en}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Display price if service has fixed price */}
            {formData.serviceId && selectedService && (
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">السعر / Price:</span>
                  <span className="text-lg font-bold text-primary">
                    {(() => {
                      const country = countries.find(c => c.code === formData.countryCode);
                      const currencySymbol = country?.currencySymbol || 'SAR';
                      
                      // Check if sub-service is selected and has a price
                      if (formData.subServiceId) {
                        const subService = selectedService.sub_services.find(
                          ss => ss.id === formData.subServiceId
                        );
                        if (subService?.price) {
                          return `${subService.price} ${currencySymbol}`;
                        }
                      }
                      // Otherwise, check if main service has a price
                      if (selectedService.price) {
                        return `${selectedService.price} ${currencySymbol}`;
                      }
                      // No fixed price
                      return 'سعر غير ثابت / Not Fixed';
                    })()}
                  </span>
                </div>
                {!(() => {
                  if (formData.subServiceId) {
                    const subService = selectedService.sub_services.find(
                      ss => ss.id === formData.subServiceId
                    );
                    return subService?.price;
                  }
                  return selectedService.price;
                })() && (
                  <p className="text-xs text-muted-foreground mt-1">
                    سيتم تحديد السعر من قبل المختصين / Price will be quoted by specialists
                  </p>
                )}
              </div>
            )}

            {formData.serviceId && (
              <div className="space-y-2">
                <Label htmlFor="hoursCount">عدد الساعات / Hours</Label>
                <Input
                  id="hoursCount"
                  type="number"
                  min="1"
                  value={formData.hoursCount}
                  onChange={(e) => handleInputChange('hoursCount', e.target.value)}
                  placeholder="مثال: 8"
                />
              </div>
            )}
            </div>
          )}

          {/* Step 3: Company Selection */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">اختيار الشركة / Company Selection</h3>
              
              <div className="space-y-2">
                <Label>إرسال الطلب إلى / Send Order To</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sendToAll"
                    checked={formData.sendToAll}
                    onChange={() => {
                      setFormData(prev => ({ ...prev, sendToAll: true, companyId: '', specialistIds: [] }));
                    }}
                    className="w-4 h-4 text-primary"
                    disabled={!formData.serviceId}
                  />
                  <span className={`text-sm ${!formData.serviceId ? 'text-muted-foreground' : ''}`}>
                    All Companies
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
                    Specific Company {companies.length > 0 && `(${companies.length})`}
                  </span>
                </label>
              </div>
              {!formData.serviceId && (
                <p className="text-xs text-muted-foreground">
                  Choose service first
                </p>
              )}
              {formData.serviceId && !formData.sendToAll && companies.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No companies offer this service currently
                </p>
              )}
            </div>

            {!formData.sendToAll && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyId">Choose Company *</Label>
                  <Select value={formData.companyId} onValueChange={(value) => handleInputChange('companyId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose company" />
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

                {formData.companyId && specialists.length > 0 && (
                  <div className="space-y-3">
                    <Label>Choose Specialists (Optional)</Label>
                    <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto space-y-3">
                      {specialists.map((specialist) => (
                        <label
                          key={specialist.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.specialistIds.includes(specialist.id)}
                            onChange={() => toggleSpecialist(specialist.id)}
                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                          />
                          {specialist.image_url ? (
                            <img 
                              src={specialist.image_url} 
                              alt={specialist.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex flex-col flex-1">
                            <span className="font-medium">{specialist.name}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span dir="ltr">{specialist.phone}</span>
                              {specialist.specialty && (
                                <>
                                  <span>•</span>
                                  <span>{specialist.specialty}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                    {formData.specialistIds.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {formData.specialistIds.length} specialist(s) selected
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Leave empty to send to all specialists in this company
                    </p>
                  </div>
                )}
              </>
            )}
            </div>
          )}

          {/* Step 4: Notes */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">ملاحظات إضافية / Additional Notes</h3>
              
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات / Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="أدخل أي ملاحظات إضافية... / Enter any additional notes..."
                  rows={5}
                  dir="auto"
                />
                <p className="text-xs text-muted-foreground">
                  اختياري - يمكنك ترك هذا الحقل فارغاً / Optional - you can leave this field empty
                </p>
              </div>
            </div>
          )}

          {/* Navigation Actions */}
          <div className="flex gap-3 pt-6 border-t">
            {currentStep > 1 && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={handlePrevious}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                السابق / Previous
              </Button>
            )}
            
            {currentStep < totalSteps ? (
              <Button 
                type="button" 
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2"
              >
                متابعة / Next
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                className="flex-1 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                تأكيد إنشاء الطلب / Create Order
              </Button>
            )}

            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                إلغاء / Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}