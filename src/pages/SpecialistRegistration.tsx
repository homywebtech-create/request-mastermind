import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, User, Camera, CreditCard, FileCheck, Share2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries } from "@/data/countries";
import { nationalities } from "@/data/nationalities";
import { MultiSelect } from "@/components/ui/multi-select";
import { useLanguage } from "@/hooks/useLanguage";
import { Progress } from "@/components/ui/progress";

const registrationSchema = z.object({
  name: z.string().min(2, "يجب إدخال الاسم / Name is required").max(100, "الاسم طويل جداً"),
  countryCode: z.string().min(1, "يجب اختيار كود الدولة / Country code required"),
  phoneNumber: z.string().min(7, "رقم الهاتف غير صحيح / Invalid phone number").max(15),
  nationality: z.string().min(1, "يجب اختيار الجنسية / Nationality is required"),
  birth_date: z.string().min(1, "يجب إدخال تاريخ الميلاد / Birth date is required"),
  experience_years: z.coerce.number().min(0, "يجب أن تكون سنوات الخبرة 0 أو أكثر").max(50, "سنوات الخبرة غير صحيحة"),
  sub_service_ids: z.array(z.string()).min(1, "يجب اختيار خدمة واحدة على الأقل"),
  notes: z.string().max(500, "الملاحظات طويلة جداً").optional(),
  countries_worked_in: z.array(z.string()).min(1, "يجب اختيار دولة واحدة على الأقل"),
  id_card_expiry_date: z.string().min(1, "يجب إدخال تاريخ انتهاء البطاقة"),
  has_cleaning_allergy: z.boolean().default(false),
  has_pet_allergy: z.boolean().default(false),
  languages_spoken: z.array(z.string()).min(1, "يجب اختيار لغة واحدة على الأقل"),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

interface Service {
  id: string;
  name: string;
  name_en?: string;
}

interface SubService {
  id: string;
  name: string;
  name_en?: string;
  service_id: string;
}

const STEPS = [
  { id: 1, title: 'المعلومات الأساسية', title_en: 'Basic Information', icon: User },
  { id: 2, title: 'الصور الشخصية', title_en: 'Personal Photos', icon: Camera },
  { id: 3, title: 'صور البطاقة', title_en: 'ID Card Photos', icon: CreditCard },
  { id: 4, title: 'المراجعة والتأكيد', title_en: 'Review & Confirm', icon: FileCheck },
];

export default function SpecialistRegistration() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { language } = useLanguage();
  const token = searchParams.get("token");

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialist, setSpecialist] = useState<any>(null);
  
  // Image states
  const [facePhotoFile, setFacePhotoFile] = useState<File | null>(null);
  const [facePhotoPreview, setFacePhotoPreview] = useState<string>("");
  const [fullBodyPhotoFile, setFullBodyPhotoFile] = useState<File | null>(null);
  const [fullBodyPhotoPreview, setFullBodyPhotoPreview] = useState<string>("");
  const [idCardFrontFile, setIdCardFrontFile] = useState<File | null>(null);
  const [idCardFrontPreview, setIdCardFrontPreview] = useState<string>("");
  const [idCardBackFile, setIdCardBackFile] = useState<File | null>(null);
  const [idCardBackPreview, setIdCardBackPreview] = useState<string>("");
  
  const [services, setServices] = useState<Service[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      countryCode: "+966",
      phoneNumber: "",
      nationality: "",
      birth_date: "",
      experience_years: 0,
      sub_service_ids: [],
      notes: "",
      countries_worked_in: [],
      id_card_expiry_date: "",
      has_cleaning_allergy: false,
      has_pet_allergy: false,
      languages_spoken: [],
    },
  });

  useEffect(() => {
    initializeRegistration();
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedServices.length > 0) {
      fetchSubServicesForMultipleServices(selectedServices);
    } else {
      setSubServices([]);
    }
  }, [selectedServices]);

  const initializeRegistration = async () => {
    setIsLoading(true);
    try {
      if (!token) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' 
            ? "رابط التسجيل غير صحيح" 
            : "Invalid registration link",
          variant: "destructive",
        });
        return;
      }

      // Fetch specialist data with company information
      const { data: specialistData, error: specialistError } = await supabase
        .from("specialists")
        .select(`
          *,
          companies:company_id (
            id,
            name,
            name_en,
            logo_url,
            country_code
          )
        `)
        .eq("registration_token", token)
        .eq("approval_status", "pending")
        .is("registration_completed_at", null)
        .maybeSingle();

      if (specialistError || !specialistData) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' 
            ? "رابط التسجيل غير صحيح أو منتهي الصلاحية" 
            : "Invalid or expired registration link",
          variant: "destructive",
        });
        return;
      }

      setSpecialist(specialistData);

      // Set the country code from the company
      const companyCountryCode = (specialistData.companies as any)?.country_code || "+966";
      form.setValue("countryCode", companyCountryCode);

      // Extract phone number without country code if phone is already set
      if (specialistData.phone && specialistData.phone.startsWith(companyCountryCode)) {
        const phoneWithoutCode = specialistData.phone.substring(companyCountryCode.length);
        form.setValue("phoneNumber", phoneWithoutCode);
      }

    } catch (error) {
      console.error("Error initializing registration:", error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' 
          ? "حدث خطأ أثناء تحميل البيانات" 
          : "An error occurred while loading data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("id, name, name_en")
      .eq("is_active", true)
      .order("name");

    if (data) {
      setServices(data);
    }
  };

  const fetchSubServicesForMultipleServices = async (serviceIds: string[]) => {
    const { data } = await supabase
      .from("sub_services")
      .select("id, name, name_en, service_id")
      .in("service_id", serviceIds)
      .eq("is_active", true)
      .order("name");

    if (data) {
      setSubServices(data);
    }
  };

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'face' | 'fullBody' | 'idFront' | 'idBack'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' 
            ? "حجم الصورة يجب أن يكون أقل من 5 ميجابايت" 
            : "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        switch (type) {
          case 'face':
            setFacePhotoFile(file);
            setFacePhotoPreview(preview);
            break;
          case 'fullBody':
            setFullBodyPhotoFile(file);
            setFullBodyPhotoPreview(preview);
            break;
          case 'idFront':
            setIdCardFrontFile(file);
            setIdCardFrontPreview(preview);
            break;
          case 'idBack':
            setIdCardBackFile(file);
            setIdCardBackPreview(preview);
            break;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (
    file: File,
    bucket: string,
    folderPath: string
  ): Promise<string> => {
    if (!specialist) throw new Error("No specialist data");

    const fileExt = file.name.split(".").pop();
    const fileName = `${specialist.id}-${Date.now()}.${fileExt}`;
    const filePath = `${folderPath}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const validateStep = async (step: number): Promise<boolean> => {
    if (step === 1) {
      const fields = ['name', 'countryCode', 'phoneNumber', 'nationality', 'birth_date', 'experience_years', 'sub_service_ids', 'countries_worked_in', 'languages_spoken', 'id_card_expiry_date'];
      const result = await form.trigger(fields as any);
      return result;
    }
    if (step === 2) {
      if (!facePhotoFile && !specialist?.face_photo_url) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' ? "يجب رفع صورة الوجه" : "Please upload face photo",
          variant: "destructive",
        });
        return false;
      }
      if (!fullBodyPhotoFile && !specialist?.full_body_photo_url) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' ? "يجب رفع صورة كاملة" : "Please upload full body photo",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!idCardFrontFile && !specialist?.id_card_front_url) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' ? "يجب رفع صورة البطاقة الأمامية" : "Please upload ID card front",
          variant: "destructive",
        });
        return false;
      }
      if (!idCardBackFile && !specialist?.id_card_back_url) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' ? "يجب رفع صورة البطاقة الخلفية" : "Please upload ID card back",
          variant: "destructive",
        });
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (values: RegistrationFormValues) => {
    if (!specialist) return;

    setIsSubmitting(true);
    try {
      // Combine country code with phone number
      const fullPhoneNumber = `${values.countryCode}${values.phoneNumber}`;

      // Upload photos
      let facePhotoUrl = specialist.face_photo_url;
      if (facePhotoFile) {
        facePhotoUrl = await uploadImage(facePhotoFile, "specialist-photos", "face");
      }

      let fullBodyPhotoUrl = specialist.full_body_photo_url;
      if (fullBodyPhotoFile) {
        fullBodyPhotoUrl = await uploadImage(fullBodyPhotoFile, "specialist-photos", "full-body");
      }

      let idCardFrontUrl = specialist.id_card_front_url;
      if (idCardFrontFile) {
        idCardFrontUrl = await uploadImage(idCardFrontFile, "id-cards", specialist.id);
      }

      let idCardBackUrl = specialist.id_card_back_url;
      if (idCardBackFile) {
        idCardBackUrl = await uploadImage(idCardBackFile, "id-cards", specialist.id);
      }

      // Complete registration via backend function
      const { data: completeData, error: completeError } = await supabase.functions.invoke(
        'complete-specialist-registration',
        {
          body: {
            specialist_id: specialist.id,
            token,
            name: values.name,
            phone: fullPhoneNumber,
            nationality: values.nationality,
            birth_date: values.birth_date,
            experience_years: values.experience_years,
            notes: values.notes,
            id_card_expiry_date: values.id_card_expiry_date,
            countries_worked_in: values.countries_worked_in,
            has_cleaning_allergy: values.has_cleaning_allergy,
            has_pet_allergy: values.has_pet_allergy,
            languages_spoken: values.languages_spoken,
            sub_service_ids: values.sub_service_ids,
            face_photo_url: facePhotoUrl,
            full_body_photo_url: fullBodyPhotoUrl,
            id_card_front_url: idCardFrontUrl,
            id_card_back_url: idCardBackUrl,
          },
        }
      );

      if (completeError || (completeData && (completeData as any).error)) {
        throw new Error(completeError?.message || (completeData as any).error || 'Registration failed');
      }

      setSubmitted(true);
      toast({
        title: language === 'ar' ? "تم بنجاح" : "Success",
        description: language === 'ar' 
          ? "تم إكمال التسجيل بنجاح. سيتم مراجعة بياناتك قريباً"
          : "Registration completed successfully. Your profile will be reviewed soon.",
      });
    } catch (error: any) {
      console.error("Error submitting registration:", error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message || (language === 'ar' ? "حدث خطأ أثناء حفظ البيانات" : "An error occurred while saving data"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  const shareRegistrationLink = async () => {
    const registrationLink = `${window.location.origin}/specialist-registration`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: language === 'ar' ? 'رابط تسجيل المحترفين' : 'Specialist Registration Link',
          text: language === 'ar' 
            ? 'انضم إلينا كمحترف! سجل الآن عبر هذا الرابط'
            : 'Join us as a specialist! Register now through this link',
          url: registrationLink,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(registrationLink);
        toast({
          title: language === 'ar' ? "تم النسخ" : "Copied",
          description: language === 'ar' 
            ? "تم نسخ رابط التسجيل" 
            : "Registration link copied to clipboard",
        });
      } catch (error) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' ? "فشل النسخ" : "Failed to copy",
          variant: "destructive",
        });
      }
    }
  };

  const companyName = language === 'ar' 
    ? (specialist?.companies as any)?.name 
    : ((specialist?.companies as any)?.name_en || (specialist?.companies as any)?.name);
  const companyLogo = (specialist?.companies as any)?.logo_url;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
        <Card className="max-w-md shadow-2xl animate-scale-in">
          <CardHeader>
            <div className="flex flex-col items-center space-y-4">
              {companyLogo && (
                <Avatar className="h-24 w-24 border-4 border-primary/20">
                  <AvatarImage src={companyLogo} alt={companyName} />
                  <AvatarFallback>{companyName?.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>
            <CardTitle className="text-center text-2xl mt-4">
              {language === 'ar' ? `شركة ${companyName}` : `${companyName} Company`}
            </CardTitle>
            <CardDescription className="text-center text-lg font-semibold text-primary">
              {language === 'ar' ? 'سعيدون بانضمامك إلينا!' : "We're happy to have you!"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium mb-2">
                {language === 'ar' 
                  ? 'تم استلام طلب انضمامك'
                  : 'Your registration request has been received'}
              </p>
              <p className="text-muted-foreground">
                {language === 'ar' 
                  ? 'سيقوم فريق عملنا بمراجعة طلب تسجيلك وسيتم التواصل معك بعد قليل'
                  : 'Our team will review your registration and contact you shortly'}
              </p>
            </div>
            
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                {language === 'ar' 
                  ? 'هل لديك أصدقاء محترفين؟ شارك رابط التسجيل معهم!'
                  : 'Have professional friends? Share the registration link with them!'}
              </p>
              <Button 
                onClick={shareRegistrationLink}
                variant="outline"
                className="w-full gap-2"
              >
                <Share2 className="h-4 w-4" />
                {language === 'ar' ? 'مشاركة رابط التسجيل' : 'Share Registration Link'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercentage = (currentStep / 4) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Company Welcome Header */}
        {companyName && (
          <Card className="mb-6 shadow-lg animate-fade-in border-2 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                {companyLogo && (
                  <Avatar className="h-20 w-20 border-4 border-primary/20">
                    <AvatarImage src={companyLogo} alt={companyName} />
                    <AvatarFallback>{companyName.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-primary mb-2">
                    {language === 'ar' ? 'مرحباً بك في' : 'Welcome to'}
                  </h2>
                  <p className="text-xl font-semibold">
                    {companyName}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {language === 'ar' ? 'تسجيل محترف جديد' : 'New Specialist Registration'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'يرجى إكمال البيانات التالية لإنهاء التسجيل'
              : 'Please complete the following information to finish registration'}
          </p>
        </div>

        {/* Progress Bar */}
        <Card className="mb-6 shadow-lg animate-fade-in">
          <CardContent className="pt-6">
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'التقدم' : 'Progress'}: {currentStep}/4
                </span>
                <span className="text-sm font-medium">{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
            </div>

            {/* Steps */}
            <div className="grid grid-cols-4 gap-2">
              {STEPS.map((step) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div
                    key={step.id}
                    className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                        : isCompleted
                        ? 'bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <StepIcon className="h-6 w-6 mb-2" />
                    <span className="text-xs font-medium text-center hidden md:block">
                      {language === 'ar' ? step.title : step.title_en}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Form Card */}
        <Card className="shadow-2xl animate-scale-in">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                {/* Step 1: Basic Information */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
                      </h3>

                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'الاسم الكامل *' : 'Full Name *'}</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder={language === 'ar' ? 'أحمد محمد' : 'John Doe'} 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <FormField
                          control={form.control}
                          name="countryCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'كود الدولة *' : 'Country Code *'}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} disabled>
                                <FormControl>
                                  <SelectTrigger className="bg-muted cursor-not-allowed">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-60 bg-background z-50">
                                  {countries.map((country) => (
                                    <SelectItem key={country.code} value={country.dialCode}>
                                      {country.flag} {country.dialCode}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}</FormLabel>
                              <FormControl>
                                <Input 
                                  type="tel"
                                  placeholder={language === 'ar' ? '5xxxxxxxx' : '5xxxxxxxx'} 
                                  {...field} 
                                  dir="ltr"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="nationality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'الجنسية *' : 'Nationality *'}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder={language === 'ar' ? 'اختر الجنسية' : 'Select nationality'} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-60 bg-background z-50">
                                {nationalities
                                  .filter(n => n !== '---')
                                  .map((nationality) => (
                                    <SelectItem key={nationality} value={nationality}>
                                      {nationality}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="birth_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'تاريخ الميلاد *' : 'Birth Date *'}</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground mt-1">
                              {language === 'ar' 
                                ? '📅 للاستفادة من عروض أعياد الميلاد الخاصة'
                                : '📅 To receive special birthday offers'}
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="experience_years"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'سنوات الخبرة *' : 'Years of Experience *'}</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                max="50"
                                placeholder={language === 'ar' ? '5' : '5'} 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Services Selection */}
                      <div className="space-y-2">
                        <FormLabel>{language === 'ar' ? 'الخدمات *' : 'Services *'}</FormLabel>
                        <MultiSelect
                          options={services.map(s => ({
                            label: language === 'ar' ? s.name : (s.name_en || s.name),
                            value: s.id
                          }))}
                          selected={selectedServices}
                          onChange={setSelectedServices}
                          placeholder={language === 'ar' ? "اختر الخدمات" : "Select services"}
                        />
                      </div>

                      {/* Sub-services Selection */}
                      {subServices.length > 0 && (
                        <FormField
                          control={form.control}
                          name="sub_service_ids"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'التخصصات *' : 'Specialties *'}</FormLabel>
                              <FormControl>
                                <MultiSelect
                                  options={subServices.map(ss => ({
                                    label: language === 'ar' ? ss.name : (ss.name_en || ss.name),
                                    value: ss.id
                                  }))}
                                  selected={field.value}
                                  onChange={field.onChange}
                                  placeholder={language === 'ar' ? "اختر التخصصات" : "Select specialties"}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="countries_worked_in"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'الدول التي عملت فيها *' : 'Countries Worked In *'}</FormLabel>
                            <MultiSelect
                              options={countries.map(c => ({
                                label: `${c.flag} ${language === 'ar' ? c.nameAr : c.name}`,
                                value: language === 'ar' ? c.nameAr : c.name
                              }))}
                              selected={field.value}
                              onChange={field.onChange}
                              placeholder={language === 'ar' ? "اختر الدول" : "Select countries"}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="languages_spoken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'اللغات المتحدثة *' : 'Languages Spoken *'}</FormLabel>
                            <MultiSelect
                              options={[
                                { label: language === 'ar' ? 'العربية' : 'Arabic', value: 'Arabic' },
                                { label: language === 'ar' ? 'الإنجليزية' : 'English', value: 'English' },
                                { label: language === 'ar' ? 'الأوردو' : 'Urdu', value: 'Urdu' },
                                { label: language === 'ar' ? 'الهندية' : 'Hindi', value: 'Hindi' },
                                { label: language === 'ar' ? 'التاغالوغ' : 'Tagalog', value: 'Tagalog' },
                                { label: language === 'ar' ? 'البنغالية' : 'Bengali', value: 'Bengali' },
                              ]}
                              selected={field.value}
                              onChange={field.onChange}
                              placeholder={language === 'ar' ? "اختر اللغات" : "Select languages"}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="id_card_expiry_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'تاريخ انتهاء البطاقة *' : 'ID Card Expiry Date *'}</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3 border-t pt-4">
                        <FormLabel>{language === 'ar' ? 'الحساسية' : 'Allergies'}</FormLabel>
                        <FormField
                          control={form.control}
                          name="has_pet_allergy"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-x-reverse">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="!mt-0 cursor-pointer">
                                {language === 'ar' ? 'حساسية من الحيوانات' : 'Pet Allergy'}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="has_cleaning_allergy"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-x-reverse">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="!mt-0 cursor-pointer">
                                {language === 'ar' ? 'حساسية من مواد التنظيف' : 'Cleaning Products Allergy'}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'ملاحظات إضافية' : 'Additional Notes'}</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder={language === 'ar' ? "أي معلومات إضافية..." : "Any additional information..."}
                                className="min-h-[100px]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Personal Photos */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        {language === 'ar' ? 'الصور الشخصية' : 'Personal Photos'}
                      </h3>

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>{language === 'ar' ? 'يجب أن تكون الصورة احترافية وبالزي الموحد' : 'Photo must be professional and in uniform'}</li>
                            <li>{language === 'ar' ? 'الصور غير المناسبة سيتم رفضها' : 'Inappropriate photos will be rejected'}</li>
                            <li>{language === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be less than 5MB'}</li>
                          </ul>
                        </AlertDescription>
                      </Alert>

                      {/* Face Photo */}
                      <div className="space-y-3 p-6 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                        <FormLabel className="text-base">
                          {language === 'ar' ? 'صورة الوجه *' : 'Face Photo *'}
                        </FormLabel>
                        <div className="flex flex-col items-center gap-4">
                          <Avatar className="h-40 w-40 border-4 border-background shadow-xl">
                            <AvatarImage src={facePhotoPreview} />
                            <AvatarFallback className="text-4xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                              📷
                            </AvatarFallback>
                          </Avatar>
                          <label htmlFor="face-photo-upload" className="cursor-pointer">
                            <div className="flex items-center gap-2 px-6 py-3 border-2 rounded-lg hover:bg-accent hover:scale-105 transition-all shadow-sm">
                              <Upload className="h-5 w-5" />
                              <span className="font-medium">
                                {facePhotoPreview 
                                  ? (language === 'ar' ? 'تغيير الصورة' : 'Change Photo')
                                  : (language === 'ar' ? 'رفع صورة الوجه' : 'Upload Face Photo')}
                              </span>
                            </div>
                            <input
                              id="face-photo-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageChange(e, 'face')}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Full Body Photo */}
                      <div className="space-y-3 p-6 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                        <FormLabel className="text-base">
                          {language === 'ar' ? 'صورة كاملة *' : 'Full Body Photo *'}
                        </FormLabel>
                        <div className="flex flex-col items-center gap-4">
                          {fullBodyPhotoPreview ? (
                            <img 
                              src={fullBodyPhotoPreview} 
                              alt="Full body" 
                              className="w-56 h-72 object-cover rounded-lg shadow-xl border-4 border-background" 
                            />
                          ) : (
                            <div className="w-56 h-72 border-4 border-dashed rounded-lg flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                              <Upload className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'صورة بالطول الكامل' : 'Full body photo'}</p>
                            </div>
                          )}
                          <label htmlFor="full-body-upload" className="cursor-pointer">
                            <div className="flex items-center gap-2 px-6 py-3 border-2 rounded-lg hover:bg-accent hover:scale-105 transition-all shadow-sm">
                              <Upload className="h-5 w-5" />
                              <span className="font-medium">
                                {fullBodyPhotoPreview 
                                  ? (language === 'ar' ? 'تغيير الصورة' : 'Change Photo')
                                  : (language === 'ar' ? 'رفع صورة كاملة' : 'Upload Full Photo')}
                              </span>
                            </div>
                            <input
                              id="full-body-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageChange(e, 'fullBody')}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: ID Card Photos */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        {language === 'ar' ? 'صور البطاقة الشخصية' : 'ID Card Photos'}
                      </h3>

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <p className="text-sm">
                            {language === 'ar' 
                              ? 'يرجى التأكد من وضوح جميع البيانات في الصور'
                              : 'Please ensure all data is clearly visible in the photos'}
                          </p>
                        </AlertDescription>
                      </Alert>

                      <div className="grid md:grid-cols-2 gap-6">
                        {/* ID Front */}
                        <div className="space-y-3 p-6 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                          <FormLabel className="text-base">
                            {language === 'ar' ? 'الوجه الأمامي *' : 'Front Side *'}
                          </FormLabel>
                          {idCardFrontPreview ? (
                            <img 
                              src={idCardFrontPreview} 
                              alt="ID Front" 
                              className="w-full h-56 object-cover rounded-lg shadow-lg border-2 border-background" 
                            />
                          ) : (
                            <div className="w-full h-56 border-4 border-dashed rounded-lg flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-950">
                              <CreditCard className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground text-center px-4">
                                {language === 'ar' ? 'الوجه الأمامي للبطاقة' : 'Front side of ID'}
                              </p>
                            </div>
                          )}
                          <label htmlFor="id-front-upload" className="cursor-pointer block">
                            <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg hover:bg-accent hover:scale-105 transition-all shadow-sm">
                              <Upload className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {idCardFrontPreview 
                                  ? (language === 'ar' ? 'تغيير' : 'Change')
                                  : (language === 'ar' ? 'رفع' : 'Upload')}
                              </span>
                            </div>
                            <input
                              id="id-front-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageChange(e, 'idFront')}
                            />
                          </label>
                        </div>

                        {/* ID Back */}
                        <div className="space-y-3 p-6 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                          <FormLabel className="text-base">
                            {language === 'ar' ? 'الوجه الخلفي *' : 'Back Side *'}
                          </FormLabel>
                          {idCardBackPreview ? (
                            <img 
                              src={idCardBackPreview} 
                              alt="ID Back" 
                              className="w-full h-56 object-cover rounded-lg shadow-lg border-2 border-background" 
                            />
                          ) : (
                            <div className="w-full h-56 border-4 border-dashed rounded-lg flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-950">
                              <CreditCard className="h-12 w-12 text-muted-foreground mb-2 rotate-180" />
                              <p className="text-sm text-muted-foreground text-center px-4">
                                {language === 'ar' ? 'الوجه الخلفي للبطاقة' : 'Back side of ID'}
                              </p>
                            </div>
                          )}
                          <label htmlFor="id-back-upload" className="cursor-pointer block">
                            <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg hover:bg-accent hover:scale-105 transition-all shadow-sm">
                              <Upload className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {idCardBackPreview 
                                  ? (language === 'ar' ? 'تغيير' : 'Change')
                                  : (language === 'ar' ? 'رفع' : 'Upload')}
                              </span>
                            </div>
                            <input
                              id="id-back-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageChange(e, 'idBack')}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Review */}
                {currentStep === 4 && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        <FileCheck className="h-5 w-5" />
                        {language === 'ar' ? 'مراجعة البيانات' : 'Review Information'}
                      </h3>

                      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertDescription className="text-blue-900 dark:text-blue-100">
                          {language === 'ar' 
                            ? 'يرجى مراجعة جميع البيانات قبل التأكيد. يمكنك العودة لتعديل أي معلومات.'
                            : 'Please review all information before confirming. You can go back to edit any details.'}
                        </AlertDescription>
                      </Alert>

                      <div className="space-y-4 p-6 bg-muted rounded-lg">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'الاسم' : 'Name'}</p>
                            <p className="font-semibold">{form.getValues('name')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</p>
                            <p className="font-semibold">{form.getValues('countryCode')}{form.getValues('phoneNumber')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'الجنسية' : 'Nationality'}</p>
                            <p className="font-semibold">{form.getValues('nationality')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'تاريخ الميلاد' : 'Birth Date'}</p>
                            <p className="font-semibold">{form.getValues('birth_date')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'سنوات الخبرة' : 'Years of Experience'}</p>
                            <p className="font-semibold">{form.getValues('experience_years')} {language === 'ar' ? 'سنوات' : 'years'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'تاريخ انتهاء البطاقة' : 'ID Card Expiry Date'}</p>
                            <p className="font-semibold">{form.getValues('id_card_expiry_date')}</p>
                          </div>
                        </div>

                        <div className="pt-4 border-t">
                          <div className="mb-4">
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'التخصصات' : 'Specialties'}</p>
                            <p className="font-semibold">{form.getValues('sub_service_ids').length} {language === 'ar' ? 'تخصص' : 'specialties'}</p>
                          </div>
                          
                          <div className="mb-4">
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'الدول التي عملت فيها' : 'Countries Worked In'}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {form.getValues('countries_worked_in').map((country: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                                  {country}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="mb-4">
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'اللغات المتحدثة' : 'Languages Spoken'}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {form.getValues('languages_spoken').map((lang: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm">
                                  {lang}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="mb-4">
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'الحساسية من الحيوانات' : 'Pet Allergy'}</p>
                            <p className="font-semibold">{form.getValues('has_pet_allergy') ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}</p>
                          </div>

                          <div className="mb-4">
                            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'الحساسية من مواد التنظيف' : 'Cleaning Materials Allergy'}</p>
                            <p className="font-semibold">{form.getValues('has_cleaning_allergy') ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}</p>
                          </div>

                          {form.getValues('notes') && (
                            <div className="mb-4">
                              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'ملاحظات' : 'Notes'}</p>
                              <p className="font-semibold whitespace-pre-wrap">{form.getValues('notes')}</p>
                            </div>
                          )}

                          <div>
                            <p className="text-sm text-muted-foreground mb-3">{language === 'ar' ? 'الصور المرفوعة' : 'Uploaded Photos'}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {/* Face Photo */}
                              {facePhotoPreview && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    {language === 'ar' ? 'صورة الوجه' : 'Face Photo'}
                                  </p>
                                  <div className="relative rounded-lg overflow-hidden border-2 border-green-500 shadow-md">
                                    <img 
                                      src={facePhotoPreview} 
                                      alt="Face" 
                                      className="w-full h-32 object-cover" 
                                    />
                                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                                      <CheckCircle2 className="h-4 w-4 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Full Body Photo */}
                              {fullBodyPhotoPreview && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    {language === 'ar' ? 'صورة كاملة' : 'Full Body'}
                                  </p>
                                  <div className="relative rounded-lg overflow-hidden border-2 border-green-500 shadow-md">
                                    <img 
                                      src={fullBodyPhotoPreview} 
                                      alt="Full Body" 
                                      className="w-full h-32 object-cover" 
                                    />
                                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                                      <CheckCircle2 className="h-4 w-4 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* ID Card Front */}
                              {idCardFrontPreview && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    {language === 'ar' ? 'البطاقة - أمامي' : 'ID Card - Front'}
                                  </p>
                                  <div className="relative rounded-lg overflow-hidden border-2 border-green-500 shadow-md">
                                    <img 
                                      src={idCardFrontPreview} 
                                      alt="ID Front" 
                                      className="w-full h-32 object-cover" 
                                    />
                                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                                      <CheckCircle2 className="h-4 w-4 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* ID Card Back */}
                              {idCardBackPreview && (
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">
                                    {language === 'ar' ? 'البطاقة - خلفي' : 'ID Card - Back'}
                                  </p>
                                  <div className="relative rounded-lg overflow-hidden border-2 border-green-500 shadow-md">
                                    <img 
                                      src={idCardBackPreview} 
                                      alt="ID Back" 
                                      className="w-full h-32 object-cover" 
                                    />
                                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                                      <CheckCircle2 className="h-4 w-4 text-white" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between mt-8 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1 || isSubmitting}
                    className="gap-2"
                  >
                    {language === 'ar' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    {language === 'ar' ? 'السابق' : 'Back'}
                  </Button>

                  {currentStep < 4 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="gap-2"
                    >
                      {language === 'ar' ? 'التالي' : 'Next'}
                      {language === 'ar' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="gap-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isSubmitting 
                        ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') 
                        : (language === 'ar' ? 'تأكيد التسجيل' : 'Confirm Registration')}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
