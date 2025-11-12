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
import { useCustomerHistory } from "@/hooks/useCustomerHistory";
import { CustomerHistoryCard } from "./CustomerHistoryCard";

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
  preferredLanguage: 'ar' | 'en';
  cleaningEquipmentRequired: boolean | null;
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
  preferredLanguage: 'ar' | 'en';
  cleaningEquipmentRequired: boolean | null;
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
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  
  // Load saved form data from localStorage
  const loadSavedFormData = (): OrderFormData => {
    const saved = localStorage.getItem('orderFormData');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved form data:', e);
      }
    }
    return {
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
      preferredLanguage: 'ar',
      cleaningEquipmentRequired: null,
    };
  };
  
  const [formData, setFormData] = useState<OrderFormData>(loadSavedFormData());
  
  // Save form data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('orderFormData', JSON.stringify(formData));
  }, [formData]);

  // Get customer history when phone number is entered
  const selectedCountry = countries.find(c => c.code === formData.countryCode);
  const fullWhatsappNumber = formData.phoneNumber && formData.phoneNumber.length >= 7 
    ? `${selectedCountry?.dialCode}${formData.phoneNumber}` 
    : '';
  const { data: customerHistory, isLoading: isLoadingHistory } = useCustomerHistory(fullWhatsappNumber);

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
    // Clear previous errors
    setValidationErrors({});
    
    switch (step) {
      case 1:
        // Validate phone number
        if (!formData.phoneNumber || formData.phoneNumber.length < 7) {
          setValidationErrors({ phoneNumber: true });
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى إدخال رقم واتساب صحيح / Please enter a valid WhatsApp number",
            variant: "destructive",
          });
          return false;
        }
        // Validate customer name
        if (!formData.customerName || formData.customerName.trim() === '') {
          setValidationErrors({ customerName: true });
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى إدخال اسم العميل / Please enter customer name",
            variant: "destructive",
          });
          return false;
        }
        // Validate area
        if (!formData.area || formData.area.trim() === '') {
          setValidationErrors({ area: true });
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار المنطقة / Please select area",
            variant: "destructive",
          });
          return false;
        }
        // Validate preferred language
        if (!formData.preferredLanguage) {
          setValidationErrors({ preferredLanguage: true });
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار لغة التواصل / Please select communication language",
            variant: "destructive",
          });
          return false;
        }
        return true;

      case 2:
        // Validate service
        if (!formData.serviceId) {
          setValidationErrors({ serviceId: true });
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار نوع الخدمة / Please select service type",
            variant: "destructive",
          });
          return false;
        }
        // Verify sub-service selection if available
        if (selectedService && selectedService.sub_services.length > 0 && !formData.subServiceId) {
          setValidationErrors({ subServiceId: true });
          toast({
            title: "بيانات ناقصة / Missing Data",
            description: "يرجى اختيار الخدمة الفرعية / Please select a sub-service",
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
            setValidationErrors({ hoursCount: true });
            toast({
              title: "بيانات ناقصة / Missing Data",
              description: "يرجى اختيار عدد الساعات / Please select hours count",
              variant: "destructive",
            });
            return false;
          }
          
          // Validate cleaning equipment for any cleaning service
          if ((selectedService.name.includes('نظافة') || selectedService.name.includes('تنظيف') || (selectedService.name_en && selectedService.name_en.toLowerCase().includes('clean'))) && formData.cleaningEquipmentRequired === null) {
            setValidationErrors({ cleaningEquipmentRequired: true });
            toast({
              title: "بيانات ناقصة / Missing Data",
              description: "يرجى تحديد ما إذا كانت الخدمة تتطلب معدات تنظيف / Please specify if cleaning equipment is required",
              variant: "destructive",
            });
            return false;
          }
        }
        
        return true;

      case 3:
        console.log('🔍 Validating step 3:', { 
          isCompanyView, 
          sendToAll: formData.sendToAll, 
          companyId: formData.companyId,
          specialistIds: formData.specialistIds 
        });
        
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
        console.log('✅ Step 3 validation passed');
        return true;

      case 4:
        // Final confirmation step - no validation needed
        return true;

      default:
        return false;
    }
  };

  const handleNext = () => {
    console.log('📍 handleNext called, currentStep:', currentStep);
    const isValid = validateStep(currentStep);
    console.log('✅ validateStep result:', isValid);
    if (isValid) {
      const nextStep = Math.min(currentStep + 1, totalSteps);
      console.log('➡️ Moving to step:', nextStep);
      setCurrentStep(nextStep);
    } else {
      console.log('❌ Validation failed for step:', currentStep);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If not on final step, just move to next step
    if (currentStep < totalSteps) {
      handleNext();
      return;
    }
    
    // Only submit when on final step (step 4)
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
      // For company view, always pass companyId to ensure order is linked to the company
      companyId: isCompanyView ? companyId : (formData.sendToAll ? undefined : formData.companyId),
      specialistIds: formData.specialistIds.length > 0 ? formData.specialistIds : undefined,
      notes: formData.notes,
      preferredLanguage: formData.preferredLanguage,
      cleaningEquipmentRequired: formData.cleaningEquipmentRequired,
    };
    
    onSubmit(submittedData);
    
    // Clear saved form data from localStorage after successful submission
    localStorage.removeItem('orderFormData');
    
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
      preferredLanguage: 'ar',
      cleaningEquipmentRequired: null,
    });
    setSelectedService(null);
    setCurrentStep(1);
    
    // Close dialog after successful submission
    if (onCancel) {
      onCancel();
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, title: 'بيانات العميل', titleEn: 'Customer Info' },
      { number: 2, title: 'الخدمة', titleEn: 'Service' },
      { number: 3, title: 'الشركة', titleEn: 'Company' },
      { number: 4, title: 'تأكيد', titleEn: 'Confirm' },
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

  const handleInputChange = (field: keyof OrderFormData, value: string | boolean | null) => {
    setFormData(prev => {
      if (field === 'serviceId') {
        return { ...prev, serviceId: value as string, subServiceId: '', companyId: '', specialistIds: [], cleaningEquipmentRequired: null };
      }
      if (field === 'subServiceId') {
        return { ...prev, subServiceId: value as string, companyId: '', specialistIds: [] };
      }
      if (field === 'companyId') {
        return { ...prev, companyId: value as string, specialistIds: [] };
      }
      // When phone number changes, check for existing customer
      if (field === 'phoneNumber' && typeof value === 'string' && value.length >= 7) {
        checkExistingCustomer(value, prev.countryCode);
      }
      // When country code changes and phone is already entered, recheck
      if (field === 'countryCode' && typeof value === 'string' && prev.phoneNumber.length >= 7) {
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
              
              <div className="space-y-2">
                <Label htmlFor="preferredLanguage">لغة التواصل / Communication Language *</Label>
                <Select 
                  value={formData.preferredLanguage} 
                  onValueChange={(value: 'ar' | 'en') => handleInputChange('preferredLanguage', value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="ar">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">🇸🇦 العربية</span>
                        <span className="text-xs text-muted-foreground">Arabic</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="en">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">🇬🇧 English</span>
                        <span className="text-xs text-muted-foreground">الإنجليزية</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  سيتم إرسال رسائل WhatsApp بهذه اللغة / WhatsApp messages will be sent in this language
                </p>
              </div>
            </div>

            {/* Customer History Card */}
            {customerHistory && customerHistory.customer && (
              <div className="mt-6">
                <CustomerHistoryCard 
                  history={customerHistory} 
                  language={formData.preferredLanguage}
                />
              </div>
            )}
            
            {isLoadingHistory && formData.phoneNumber && formData.phoneNumber.length >= 7 && (
              <div className="mt-6 p-4 border border-dashed border-primary/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>{formData.preferredLanguage === 'ar' ? 'جاري تحميل سجل العميل...' : 'Loading customer history...'}</span>
                </div>
              </div>
            )}
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
                  <SelectTrigger className={cn("bg-background", validationErrors.serviceId && "border-destructive border-2 animate-pulse")}>
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
                  <Label htmlFor="subServiceId" className={cn(validationErrors.subServiceId && "text-destructive")}>
                    الخدمة الفرعية / Sub-Service *
                  </Label>
                  <Select value={formData.subServiceId} onValueChange={(value) => handleInputChange('subServiceId', value)}>
                    <SelectTrigger className={cn("bg-background", validationErrors.subServiceId && "border-destructive border-2 animate-pulse")}>
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
                  {validationErrors.subServiceId && (
                    <p className="text-xs text-destructive font-medium animate-pulse">
                      ⚠️ يرجى اختيار الخدمة الفرعية / Please select a sub-service
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Budget field - always show for customer's proposed budget */}
            {formData.serviceId && selectedService && (
              <div className="space-y-2">
                <Label htmlFor="budget">ميزانية العميل المقترحة / Customer's Proposed Budget (اختياري / Optional)</Label>
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
                  ميزانية العميل المقترحة - سيقوم المحترفون باختيار السعر المناسب / Customer's proposed budget - specialists will choose the appropriate price
                </p>
              </div>
            )}

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
                      <SelectItem value="0.5">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">30 دقيقة (الحد الأدنى)</span>
                          <span className="text-xs text-muted-foreground">30 Minutes (Minimum)</span>
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

            {/* Cleaning Equipment Field - Show for any cleaning service */}
            {formData.serviceId && selectedService && (
              selectedService.name.includes('نظافة') || 
              selectedService.name.includes('تنظيف') || 
              (selectedService.name_en && (selectedService.name_en.toLowerCase().includes('clean')))
            ) && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="cleaningEquipment" className={cn(validationErrors.cleaningEquipmentRequired && "text-destructive")}>
                  معدات التنظيف / Cleaning Equipment *
                </Label>
                <Select 
                  value={formData.cleaningEquipmentRequired === null ? '' : formData.cleaningEquipmentRequired ? 'yes' : 'no'} 
                  onValueChange={(value) => handleInputChange('cleaningEquipmentRequired', value === 'yes' ? true : value === 'no' ? false : null)}
                >
                  <SelectTrigger className={cn("bg-background", validationErrors.cleaningEquipmentRequired && "border-destructive border-2 animate-pulse")}>
                    <SelectValue placeholder="هل الخدمة تتطلب معدات؟ / Does service require equipment?" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="yes">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">✅ بمعدات التنظيف</span>
                        <span className="text-xs text-muted-foreground">With Cleaning Equipment</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="no">
                      <div className="flex flex-col items-start">
                        <span className="font-medium">❌ بدون معدات</span>
                        <span className="text-xs text-muted-foreground">Without Equipment</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {validationErrors.cleaningEquipmentRequired ? (
                  <p className="text-xs text-destructive font-medium animate-pulse">
                    ⚠️ يرجى تحديد ما إذا كانت الخدمة تتطلب معدات / Please specify if equipment is required
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    ⚠️ سيتم تنبيه المحترفين إذا كانت الخدمة تتطلب معدات تنظيف / Specialists will be notified if equipment is required
                  </p>
                )}
              </div>
            )}

            {/* Customer Notes Field */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="customerNotes">ملاحظات العميل / Customer Notes</Label>
              <Textarea
                id="customerNotes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="أدخل أي ملاحظات أو تفاصيل إضافية للعميل... / Enter any additional customer notes or details..."
                rows={4}
                dir="auto"
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                تفاصيل إضافية يريد العميل توضيحها (اختياري) / Additional details the customer wants to clarify (optional)
              </p>
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

                {!formData.sendToAll && companies.length > 0 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="companyId">اختر الشركة / Choose Company *</Label>
                      <Select 
                        value={formData.companyId} 
                        onValueChange={(value) => {
                          setFormData(prev => ({ ...prev, companyId: value, specialistIds: [] }));
                        }}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="اختر الشركة / Choose company" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
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

          {/* Step 4: Confirmation Summary */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">تأكيد الطلب / Order Confirmation</h3>
              
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                {/* Customer Info */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">بيانات العميل / Customer Information</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">الاسم / Name:</span> {formData.customerName}</p>
                    <p><span className="font-medium">الواتساب / WhatsApp:</span> {countries.find(c => c.code === formData.countryCode)?.dialCode}{formData.phoneNumber}</p>
                    <p><span className="font-medium">المنطقة / Area:</span> {formData.area}</p>
                  </div>
                </div>

                {/* Service Info */}
                <div className="space-y-2 pt-3 border-t">
                  <h4 className="font-semibold text-sm text-muted-foreground">معلومات الخدمة / Service Information</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">الخدمة / Service:</span> {services.find(s => s.id === formData.serviceId)?.name}</p>
                    {formData.subServiceId && (
                      <p><span className="font-medium">الخدمة الفرعية / Sub-Service:</span> {selectedService?.sub_services.find(ss => ss.id === formData.subServiceId)?.name}</p>
                    )}
                    {formData.hoursCount && (
                      <p><span className="font-medium">العدد / Count:</span> {formData.hoursCount}</p>
                    )}
                    {formData.budget && formData.budgetType && (
                      <p><span className="font-medium">الميزانية المقترحة / Proposed Budget:</span> {formData.budget} ({formData.budgetType})</p>
                    )}
                    {formData.notes && (
                      <p><span className="font-medium">ملاحظات / Notes:</span> {formData.notes}</p>
                    )}
                  </div>
                </div>

                {/* Company/Specialist Selection */}
                <div className="space-y-2 pt-3 border-t">
                  <h4 className="font-semibold text-sm text-muted-foreground">إرسال الطلب / Send Order To</h4>
                  <div className="space-y-1 text-sm">
                    {formData.sendToAll ? (
                      <p className="font-medium text-primary">✓ سيتم إرسال الطلب لجميع {isCompanyView ? 'المحترفين' : 'الشركات'} / Will be sent to all {isCompanyView ? 'specialists' : 'companies'}</p>
                    ) : (
                      <>
                        {!isCompanyView && formData.companyId && (
                          <p><span className="font-medium">الشركة / Company:</span> {companies.find(c => c.id === formData.companyId)?.name}</p>
                        )}
                        {formData.specialistIds.length > 0 && (
                          <p><span className="font-medium">محترفين محددين / Specific Specialists:</span> {formData.specialistIds.length} محترف</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-center">
                  ⚠️ تأكد من صحة البيانات قبل الإرسال / Please verify all information before submitting
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔵 Next button clicked in step:', currentStep);
                  handleNext();
                }}
                className="flex-1 flex items-center justify-center gap-2"
              >
                متابعة / Next
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                className="flex-1 flex items-center justify-center gap-2"
                onClick={() => console.log('🟢 Submit button clicked')}
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