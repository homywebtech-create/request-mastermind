import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { countries } from "@/data/countries";
import { MultiSelect } from "@/components/ui/multi-select";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

const registrationSchema = z.object({
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

export default function SpecialistRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get("token");

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
    // Initialize without token requirement
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
      // Create a temporary specialist for registration
      const tempSpecialist = {
        id: 'temp-' + Date.now(),
        name: 'New Registration',
        approval_status: 'pending',
        registration_completed_at: null
      };
      setSpecialist(tempSpecialist);
    } catch (error) {
      console.error("Error initializing registration:", error);
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
          title: "خطأ / Error",
          description: "حجم الصورة يجب أن يكون أقل من 5 ميجابايت / Image size must be less than 5MB",
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

  const onSubmit = async (values: RegistrationFormValues) => {
    if (!specialist) return;

    // Validate required images
    if (!facePhotoFile && !specialist.face_photo_url) {
      toast({
        title: "خطأ / Error",
        description: "يجب رفع صورة الوجه / Please upload face photo",
        variant: "destructive",
      });
      return;
    }

    if (!fullBodyPhotoFile && !specialist.full_body_photo_url) {
      toast({
        title: "خطأ / Error",
        description: "يجب رفع صورة كاملة / Please upload full body photo",
        variant: "destructive",
      });
      return;
    }

    if (!idCardFrontFile && !specialist.id_card_front_url) {
      toast({
        title: "خطأ / Error",
        description: "يجب رفع صورة البطاقة الأمامية / Please upload ID card front",
        variant: "destructive",
      });
      return;
    }

    if (!idCardBackFile && !specialist.id_card_back_url) {
      toast({
        title: "خطأ / Error",
        description: "يجب رفع صورة البطاقة الخلفية / Please upload ID card back",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
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

      // Delete existing specialties first (while registration_completed_at is still NULL)
      await supabase
        .from("specialist_specialties")
        .delete()
        .eq("specialist_id", specialist.id);

      // Insert new specialties (while registration_completed_at is still NULL)
      const specialties = values.sub_service_ids.map(subServiceId => ({
        specialist_id: specialist.id,
        sub_service_id: subServiceId,
      }));

      const { error: specialtiesError } = await supabase
        .from("specialist_specialties")
        .insert(specialties);

      if (specialtiesError) throw specialtiesError;

      // Update specialist info and mark registration as completed
      const { error: updateError } = await supabase
        .from("specialists")
        .update({
          experience_years: values.experience_years,
          notes: values.notes,
          face_photo_url: facePhotoUrl,
          full_body_photo_url: fullBodyPhotoUrl,
          id_card_front_url: idCardFrontUrl,
          id_card_back_url: idCardBackUrl,
          id_card_expiry_date: values.id_card_expiry_date,
          countries_worked_in: values.countries_worked_in,
          has_cleaning_allergy: values.has_cleaning_allergy,
          has_pet_allergy: values.has_pet_allergy,
          languages_spoken: values.languages_spoken,
          registration_completed_at: new Date().toISOString(),
        })
        .eq("id", specialist.id)
        .eq("registration_token", token);

      if (updateError) throw updateError;

      setSubmitted(true);
      toast({
        title: "تم بنجاح / Success",
        description: "تم إكمال التسجيل بنجاح. سيتم مراجعة بياناتك قريباً / Registration completed successfully. Your profile will be reviewed soon.",
      });
    } catch (error: any) {
      console.error("Error submitting registration:", error);
      toast({
        title: "خطأ / Error",
        description: error.message || "حدث خطأ أثناء حفظ البيانات / An error occurred while saving data",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>جاري التحميل... / Loading...</p>
      </div>
    );
  }

  // Removed token requirement for testing

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center">
              تم إكمال التسجيل بنجاح!
              <br />
              Registration Completed!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              شكراً لإكمال بياناتك. سيتم مراجعة ملفك الشخصي والموافقة عليه قريباً.
              <br />
              Thank you for completing your registration. Your profile will be reviewed and approved soon.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              تسجيل عامل جديد - New Worker Registration
            </CardTitle>
            <CardDescription className="text-center">
              يرجى إكمال البيانات التالية لإنهاء التسجيل
              <br />
              Please complete the following information to finish registration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>تعليمات مهمة / Important Instructions:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>يجب أن تكون الصورة احترافية وبالزي الموحد / Photo must be professional and in uniform</li>
                  <li>الصور غير المناسبة سيتم رفضها / Inappropriate photos will be rejected</li>
                  <li>حجم الصورة يجب أن يكون أقل من 5 ميجابايت / Image size must be less than 5MB</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Photos Section */}
                <div className="space-y-6 border rounded-lg p-4">
                  <h3 className="font-semibold text-lg">الصور المطلوبة / Required Photos</h3>
                  
                  {/* Face Photo */}
                  <div className="space-y-2">
                    <FormLabel>صورة الوجه / Face Photo *</FormLabel>
                    <div className="flex flex-col items-center gap-4">
                      <Avatar className="h-32 w-32">
                        <AvatarImage src={facePhotoPreview} />
                        <AvatarFallback className="text-2xl">
                          📷
                        </AvatarFallback>
                      </Avatar>
                      <label htmlFor="face-photo-upload" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent">
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">
                            {facePhotoPreview ? "تغيير صورة الوجه" : "رفع صورة الوجه"}
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
                  <div className="space-y-2">
                    <FormLabel>صورة كاملة / Full Body Photo *</FormLabel>
                    <div className="flex flex-col items-center gap-4">
                      {fullBodyPhotoPreview ? (
                        <img src={fullBodyPhotoPreview} alt="Full body" className="w-48 h-64 object-cover rounded-lg" />
                      ) : (
                        <div className="w-48 h-64 border-2 border-dashed rounded-lg flex items-center justify-center">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <label htmlFor="full-body-upload" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent">
                          <Upload className="h-4 w-4" />
                          <span className="text-sm">
                            {fullBodyPhotoPreview ? "تغيير الصورة الكاملة" : "رفع الصورة الكاملة"}
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

                  {/* ID Card Photos */}
                  <div className="space-y-4">
                    <FormLabel>صورة البطاقة الشخصية (الوجهان) / ID Card (Both Sides) *</FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* ID Front */}
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">الوجه الأمامي / Front Side</p>
                        {idCardFrontPreview ? (
                          <img src={idCardFrontPreview} alt="ID Front" className="w-full h-48 object-cover rounded-lg" />
                        ) : (
                          <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <label htmlFor="id-front-upload" className="cursor-pointer block">
                          <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent w-full justify-center">
                            <Upload className="h-4 w-4" />
                            <span className="text-sm">
                              {idCardFrontPreview ? "تغيير" : "رفع"}
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
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">الوجه الخلفي / Back Side</p>
                        {idCardBackPreview ? (
                          <img src={idCardBackPreview} alt="ID Back" className="w-full h-48 object-cover rounded-lg" />
                        ) : (
                          <div className="w-full h-48 border-2 border-dashed rounded-lg flex items-center justify-center">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <label htmlFor="id-back-upload" className="cursor-pointer block">
                          <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent w-full justify-center">
                            <Upload className="h-4 w-4" />
                            <span className="text-sm">
                              {idCardBackPreview ? "تغيير" : "رفع"}
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

                {/* ID Card Expiry Date */}
                <FormField
                  control={form.control}
                  name="id_card_expiry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تاريخ انتهاء البطاقة / ID Card Expiry Date *</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Experience Years */}
                <FormField
                  control={form.control}
                  name="experience_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>سنوات الخبرة / Years of Experience *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="50"
                          placeholder="مثال: 5 / Example: 5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Services Selection */}
                <div className="space-y-4">
                  <FormLabel className="text-base">الخدمات الرئيسية / Main Services *</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox
                          id={service.id}
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedServices([...selectedServices, service.id]);
                            } else {
                              setSelectedServices(selectedServices.filter(id => id !== service.id));
                              // Clear selected sub-services for this service
                              const subServicesToRemove = subServices
                                .filter(ss => ss.service_id === service.id)
                                .map(ss => ss.id);
                              form.setValue(
                                'sub_service_ids',
                                form.getValues('sub_service_ids').filter(id => !subServicesToRemove.includes(id))
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={service.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          <div>{service.name}</div>
                          {service.name_en && (
                            <div className="text-xs text-muted-foreground">{service.name_en}</div>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-Services */}
                {selectedServices.length > 0 && subServices.length > 0 && (
                  <FormField
                    control={form.control}
                    name="sub_service_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الخدمات الفرعية / Sub-Services *</FormLabel>
                        <div className="space-y-4">
                          {selectedServices.map((serviceId) => {
                            const service = services.find(s => s.id === serviceId);
                            const serviceSubServices = subServices.filter(ss => ss.service_id === serviceId);
                            
                            if (serviceSubServices.length === 0) return null;

                            return (
                              <div key={serviceId} className="border rounded-lg p-4">
                                <h4 className="font-medium mb-3">{service?.name}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {serviceSubServices.map((subService) => (
                                    <div key={subService.id} className="flex items-center space-x-2 space-x-reverse">
                                      <Checkbox
                                        id={subService.id}
                                        checked={field.value.includes(subService.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange([...field.value, subService.id]);
                                          } else {
                                            field.onChange(field.value.filter((id) => id !== subService.id));
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={subService.id}
                                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                      >
                                        <div>{subService.name}</div>
                                        {subService.name_en && (
                                          <div className="text-xs text-muted-foreground">{subService.name_en}</div>
                                        )}
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ملاحظات إضافية / Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="أي معلومات إضافية تود إضافتها / Any additional information"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Countries Worked In */}
                <FormField
                  control={form.control}
                  name="countries_worked_in"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>الدول التي عملت فيها من قبل / Countries Worked In *</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={countries.map((country) => ({
                            label: `${country.flag} ${country.name}`,
                            value: country.name,
                          }))}
                          selected={field.value}
                          onChange={field.onChange}
                          placeholder="Select countries..."
                          emptyMessage="No countries found"
                          searchPlaceholder="Search country..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Languages */}
                <FormField
                  control={form.control}
                  name="languages_spoken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اللغات التي تتحدثها / Languages Spoken *</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={['Arabic', 'English', 'Hindi', 'Urdu', 'Tagalog', 'Indonesian', 'Bengali', 'French', 'Other'].map((lang) => ({
                            label: lang,
                            value: lang,
                          }))}
                          selected={field.value}
                          onChange={field.onChange}
                          placeholder="Select languages..."
                          emptyMessage="No languages found"
                          searchPlaceholder="Search language..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Allergies */}
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-semibold">معلومات الحساسية / Allergy Information</h3>
                  
                  <FormField
                    control={form.control}
                    name="has_cleaning_allergy"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            هل تعاني من حساسية ضد مواد التنظيف؟ / Do you have allergy to cleaning products?
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="has_pet_allergy"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-x-reverse space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            هل تعاني من حساسية تجاه الحيوانات (قطط/كلاب)؟ / Do you have allergy to pets (cats/dogs)?
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "جاري الحفظ... / Saving..." : "إكمال التسجيل / Complete Registration"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}