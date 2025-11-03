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
import { Calendar } from "@/components/ui/calendar";
import { MapLocationPicker } from "@/components/booking/MapLocationPicker";
import { countries } from "@/data/countries";
import { qatarAreas } from "@/data/areas";
import { Plus, Phone, User, Users, Check, ChevronsUpDown, ArrowRight, ArrowLeft, MapPin, Calendar as CalendarIcon, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Service {
  id: string;
  name: string;
  name_en: string | null;
  price?: number | null;
  pricing_type?: string | null;
  sub_services: SubService[];
}

interface SubService {
  id: string;
  name: string;
  name_en: string | null;
  price?: number | null;
  pricing_type?: string | null;
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
  bookingType: string;
  bookingDate: Date | undefined;
  bookingTime: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  buildingInfo: string;
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
  servicePrice?: number | null;
  pricingType?: string | null;
  bookingType: string;
  bookingDate: string | null;
  bookingTime: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  buildingInfo: string;
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
  isCompanyView?: boolean;
  companyId?: string;
}

export function OrderForm({ onSubmit, onCancel, isCompanyView = false, companyId }: OrderFormProps) {
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
    bookingType: 'once',
    bookingDate: undefined,
    bookingTime: '',
    gpsLatitude: null,
    gpsLongitude: null,
    buildingInfo: '',
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
    if (isCompanyView && companyId) {
      // For company view, fetch specialists directly
      fetchSpecialistsForCompany(companyId);
    } else if (formData.serviceId && !formData.sendToAll) {
      // For admin view, fetch companies for service
      fetchCompaniesForService(formData.serviceId, formData.subServiceId);
    } else {
      setCompanies([]);
    }
  }, [formData.serviceId, formData.subServiceId, formData.sendToAll, isCompanyView, companyId]);

  useEffect(() => {
    if (!isCompanyView && formData.companyId) {
      fetchSpecialistsForCompany(formData.companyId);
    } else if (!isCompanyView) {
      setSpecialists([]);
    }
  }, [formData.companyId, isCompanyView]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select(`
          id,
          name,
          name_en,
          price,
          pricing_type,
          sub_services (
            id,
            name,
            name_en,
            price,
            pricing_type
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
        // Validate hours count if service requires it
        if (selectedService) {
          let pricingType = 'hourly';
          if (formData.subServiceId) {
            const subService = selectedService.sub_services.find(ss => ss.id === formData.subServiceId);
            pricingType = subService?.pricing_type || 'hourly';
          } else {
            pricingType = selectedService.pricing_type || 'hourly';
          }
          
          // Don't validate for 'agreement' pricing type
          if (pricingType !== 'agreement' && !formData.hoursCount) {
            toast({
              title: "بيانات ناقصة / Missing Data",
              description: "يرجى اختيار عدد الساعات / Please select hours count",
              variant: "destructive",
            });
            return false;
          }
        }
        
        // Validate booking type
        if (!formData.bookingType) {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار نوع الحجز / Please select booking type",
            variant: "destructive",
          });
          return false;
        }
        
        // Validate booking date and time
        if (!formData.bookingDate) {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار تاريخ الحجز / Please select booking date",
            variant: "destructive",
          });
          return false;
        }
        
        if (!formData.bookingTime) {
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار وقت الحجز / Please select booking time",
            variant: "destructive",
          });
          return false;
        }
        
        return true;

      case 3:
        // For company view, validate specialist selection if not sending to all
        if (isCompanyView) {
          if (!formData.sendToAll && formData.specialistIds.length === 0) {
            toast({
              title: "بيانات ناقصة / Missing Data",
              description: "يرجى اختيار محترف واحد على الأقل / Please select at least one specialist",
              variant: "destructive",
            });
            return false;
          }
        } else {
          // For admin view, verify company selection if not sending to all
          if (!formData.sendToAll && !formData.companyId) {
            toast({
              title: "بيانات ناقصة / Missing Data",
              description: "يرجى اختيار شركة محددة أو تفعيل الإرسال لجميع الشركات / Please select a specific company or enable send to all companies",
              variant: "destructive",
            });
            return false;
          }
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
    
    // Get pricing info from sub-service or service
    const servicePrice = subService?.price || service?.price;
    const pricingType = subService?.pricing_type || service?.pricing_type;
    
    const submittedData: SubmittedOrderData = {
      customerName: formData.customerName,
      whatsappNumber: fullWhatsappNumber,
      area: formData.area,
      budget: formData.budget,
      budgetType: formData.budgetType,
      serviceType,
      hoursCount: formData.hoursCount,
      sendToAll: formData.sendToAll,
      // For company view, always pass companyId to ensure order is linked to the company
      companyId: isCompanyView ? companyId : (formData.sendToAll ? undefined : formData.companyId),
      specialistIds: formData.specialistIds.length > 0 ? formData.specialistIds : undefined,
      notes: formData.notes,
      servicePrice,
      pricingType,
      bookingType: formData.bookingType,
      bookingDate: formData.bookingDate ? format(formData.bookingDate, 'yyyy-MM-dd') : null,
      bookingTime: formData.bookingTime,
      gpsLatitude: formData.gpsLatitude,
      gpsLongitude: formData.gpsLongitude,
      buildingInfo: formData.buildingInfo,
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
      bookingType: 'once',
      bookingDate: undefined,
      bookingTime: '',
      gpsLatitude: null,
      gpsLongitude: null,
      buildingInfo: '',
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
        // Only fill budget if both budget and budget_type exist to maintain consistency
        const shouldFillBudget = data.budget && data.budget_type;
        setFormData(prev => ({
          ...prev,
          customerName: data.name,
          area: data.area || prev.area,
          budget: shouldFillBudget ? data.budget : prev.budget,
          budgetType: shouldFillBudget ? data.budget_type : prev.budgetType,
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
                  أدخل الرقم بدون كود الدولة / Enter number without country code
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
            </div>
            </div>
          )}

          {/* Step 2: Service Information */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">بيانات الخدمة / Service Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceId">الخدمة الرئيسية / Main Service *</Label>
                <Select value={formData.serviceId} onValueChange={(value) => handleInputChange('serviceId', value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="اختر الخدمة الرئيسية / Choose main service" />
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
                  <Label htmlFor="subServiceId">الخدمة الفرعية / Sub-Service *</Label>
                  <Select value={formData.subServiceId} onValueChange={(value) => handleInputChange('subServiceId', value)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="اختر الخدمة الفرعية / Choose sub-service" />
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

            {/* Budget field - show only if service doesn't have fixed price */}
            {formData.serviceId && selectedService && (() => {
              // Check if selected service or sub-service has a fixed price
              let hasFixedPrice = false;
              
              if (formData.subServiceId) {
                const subService = selectedService.sub_services.find(ss => ss.id === formData.subServiceId);
                hasFixedPrice = subService?.price !== null && subService?.price !== undefined;
              } else {
                hasFixedPrice = selectedService.price !== null && selectedService.price !== undefined;
              }

              // Only show budget field if no fixed price
              if (!hasFixedPrice) {
                return (
                  <div className="space-y-2">
                    <Label htmlFor="budget">ميزانية العميل / Customer Budget</Label>
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
                          <SelectItem value="daily">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">يومي</span>
                              <span className="text-xs text-muted-foreground">Daily</span>
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
                    <p className="text-xs text-muted-foreground">
                      ميزانية العميل المقترحة (اختياري) / Customer's proposed budget (optional)
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            {formData.serviceId && (() => {
              // Get the pricing type from sub-service or main service
              let pricingType = 'hourly';
              if (formData.subServiceId && selectedService) {
                const subService = selectedService.sub_services.find(ss => ss.id === formData.subServiceId);
                pricingType = subService?.pricing_type || 'hourly';
              } else if (selectedService) {
                pricingType = selectedService.pricing_type || 'hourly';
              }

              // Don't show input for 'agreement' pricing type
              if (pricingType === 'agreement') {
                return null;
              }

              // Determine label based on pricing type
              const labels = {
                hourly: { ar: 'عدد الساعات', en: 'Hours', placeholder: 'مثال: 8' },
                daily: { ar: 'عدد الأيام', en: 'Days', placeholder: 'مثال: 3' },
                task: { ar: 'عدد المهام', en: 'Tasks', placeholder: 'مثال: 5' },
                monthly: { ar: 'عدد الأشهر', en: 'Months', placeholder: 'مثال: 2' }
              };

              const label = labels[pricingType as keyof typeof labels] || labels.hourly;

              return (
                <div className="space-y-2">
                  <Label htmlFor="hoursCount">{label.ar} / {label.en} *</Label>
                  <Select 
                    value={formData.hoursCount} 
                    onValueChange={(value) => handleInputChange('hoursCount', value)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={label.placeholder} />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="0.0167">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">دقيقة واحدة (اختبار)</span>
                          <span className="text-xs text-muted-foreground">1 Minute (Test)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="1">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">1 {pricingType === 'hourly' ? 'ساعة' : pricingType === 'daily' ? 'يوم' : pricingType === 'monthly' ? 'شهر' : 'مهمة'}</span>
                          <span className="text-xs text-muted-foreground">1 {label.en.slice(0, -1)}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="2">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">2 {pricingType === 'hourly' ? 'ساعات' : pricingType === 'daily' ? 'أيام' : pricingType === 'monthly' ? 'شهور' : 'مهام'}</span>
                          <span className="text-xs text-muted-foreground">2 {label.en}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="3">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">3 {pricingType === 'hourly' ? 'ساعات' : pricingType === 'daily' ? 'أيام' : pricingType === 'monthly' ? 'شهور' : 'مهام'}</span>
                          <span className="text-xs text-muted-foreground">3 {label.en}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="4">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">4 {pricingType === 'hourly' ? 'ساعات' : pricingType === 'daily' ? 'أيام' : pricingType === 'monthly' ? 'شهور' : 'مهام'}</span>
                          <span className="text-xs text-muted-foreground">4 {label.en}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="5">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">5 {pricingType === 'hourly' ? 'ساعات' : pricingType === 'daily' ? 'أيام' : pricingType === 'monthly' ? 'شهور' : 'مهام'}</span>
                          <span className="text-xs text-muted-foreground">5 {label.en}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="6">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">6 {pricingType === 'hourly' ? 'ساعات' : pricingType === 'daily' ? 'أيام' : pricingType === 'monthly' ? 'شهور' : 'مهام'}</span>
                          <span className="text-xs text-muted-foreground">6 {label.en}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="7">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">7 {pricingType === 'hourly' ? 'ساعات' : pricingType === 'daily' ? 'أيام' : pricingType === 'monthly' ? 'شهور' : 'مهام'}</span>
                          <span className="text-xs text-muted-foreground">7 {label.en}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="8">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">8 {pricingType === 'hourly' ? 'ساعات' : pricingType === 'daily' ? 'أيام' : pricingType === 'monthly' ? 'شهور' : 'مهام'}</span>
                          <span className="text-xs text-muted-foreground">8 {label.en}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="12">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">12 {pricingType === 'hourly' ? 'ساعة' : pricingType === 'daily' ? 'يوم' : pricingType === 'monthly' ? 'شهر' : 'مهمة'}</span>
                          <span className="text-xs text-muted-foreground">12 {label.en}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="24">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">24 {pricingType === 'hourly' ? 'ساعة' : pricingType === 'daily' ? 'يوم' : pricingType === 'monthly' ? 'شهر' : 'مهمة'}</span>
                          <span className="text-xs text-muted-foreground">24 {label.en}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}

            {/* Booking Type */}
            <div className="space-y-2">
              <Label htmlFor="bookingType">نوع الحجز / Booking Type *</Label>
              <Select 
                value={formData.bookingType} 
                onValueChange={(value) => handleInputChange('bookingType', value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="اختر نوع الحجز / Select booking type" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="once">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">مرة واحدة</span>
                      <span className="text-xs text-muted-foreground">One Time</span>
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
                </SelectContent>
              </Select>
            </div>

            {/* Booking Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ الحجز / Booking Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-background",
                        !formData.bookingDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.bookingDate ? format(formData.bookingDate, "PPP") : <span>اختر التاريخ / Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.bookingDate}
                      onSelect={(date) => handleInputChange('bookingDate', date as any)}
                      initialFocus
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bookingTime">وقت الحجز / Booking Time *</Label>
                <Select 
                  value={formData.bookingTime} 
                  onValueChange={(value) => handleInputChange('bookingTime', value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="اختر الوقت / Select time" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="morning">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <div className="flex flex-col items-start">
                          <span className="font-medium">صباحاً (8:00 AM)</span>
                          <span className="text-xs text-muted-foreground">Morning</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="afternoon">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <div className="flex flex-col items-start">
                          <span className="font-medium">ظهراً (2:00 PM)</span>
                          <span className="text-xs text-muted-foreground">Afternoon</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="evening">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <div className="flex flex-col items-start">
                          <span className="font-medium">مساءً (6:00 PM)</span>
                          <span className="text-xs text-muted-foreground">Evening</span>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location Picker */}
            <div className="space-y-2">
              <Label>
                <MapPin className="inline h-4 w-4 ml-1" />
                الموقع على الخريطة / Location on Map
              </Label>
              <MapLocationPicker
                onLocationSelect={(lat, lng) => {
                  setFormData(prev => ({
                    ...prev,
                    gpsLatitude: lat,
                    gpsLongitude: lng,
                  }));
                }}
                initialLat={formData.gpsLatitude}
                initialLng={formData.gpsLongitude}
              />
              {formData.gpsLatitude && formData.gpsLongitude && (
                <p className="text-xs text-muted-foreground">
                  تم تحديد الموقع / Location selected
                </p>
              )}
            </div>

            {/* Building Info */}
            <div className="space-y-2">
              <Label htmlFor="buildingInfo">معلومات المبنى / Building Info</Label>
              <Textarea
                id="buildingInfo"
                value={formData.buildingInfo}
                onChange={(e) => handleInputChange('buildingInfo', e.target.value)}
                placeholder="رقم الشقة، الدور، معلومات إضافية... / Apartment number, floor, additional info..."
                rows={3}
                dir="auto"
              />
            </div>
            </div>
          )}

          {/* Step 3: Company/Specialist Selection */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {isCompanyView ? (
                // Company view - select specialists only
                <>
                  <h3 className="text-lg font-semibold text-foreground">اختيار المحترفين / Specialist Selection</h3>
                  
                  <div className="space-y-2">
                    <Label>إرسال الطلب إلى / Send Order To</Label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="sendToAll"
                          checked={formData.sendToAll}
                          onChange={() => {
                            setFormData(prev => ({ ...prev, sendToAll: true, specialistIds: [] }));
                          }}
                          className="w-4 h-4 text-primary"
                        />
                        <span className="text-sm">
                          جميع المحترفين / All Specialists {specialists.length > 0 && `(${specialists.length})`}
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
                        />
                        <span className="text-sm">
                          محترفين محددين / Specific Specialists
                        </span>
                      </label>
                    </div>
                  </div>

                  {!formData.sendToAll && specialists.length > 0 && (
                    <div className="space-y-3">
                      <Label>اختر المحترفين / Choose Specialists *</Label>
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
                          تم اختيار {formData.specialistIds.length} محترف / {formData.specialistIds.length} specialist(s) selected
                        </p>
                      )}
                    </div>
                  )}

                  {specialists.length === 0 && (
                    <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                      لا يوجد محترفون نشطون حالياً / No active specialists available
                    </p>
                  )}
                </>
              ) : (
                // Admin view - select company then specialists
                <>
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
                        جميع الشركات / All Companies
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
                        شركة محددة / Specific Company {companies.length > 0 && `(${companies.length})`}
                      </span>
                    </label>
                  </div>
                  {!formData.serviceId && (
                    <p className="text-xs text-muted-foreground">
                      اختر الخدمة أولاً / Choose service first
                    </p>
                  )}
                  {formData.serviceId && !formData.sendToAll && companies.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      لا توجد شركات تقدم هذه الخدمة حالياً / No companies offer this service currently
                    </p>
                  )}
                </div>

                {!formData.sendToAll && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="companyId">اختر الشركة / Choose Company *</Label>
                      <Select value={formData.companyId} onValueChange={(value) => handleInputChange('companyId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الشركة / Choose company" />
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
                        <Label>اختيار المتخصصين (اختياري) / Choose Specialists (Optional)</Label>
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
                            تم اختيار {formData.specialistIds.length} متخصص / {formData.specialistIds.length} specialist(s) selected
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          اترك فارغاً للإرسال لجميع متخصصي الشركة / Leave empty to send to all specialists in this company
                        </p>
                      </div>
                    )}
                  </>
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