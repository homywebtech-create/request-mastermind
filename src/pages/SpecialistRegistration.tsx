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

const registrationSchema = z.object({
  experience_years: z.coerce.number().min(0, "يجب أن تكون سنوات الخبرة 0 أو أكثر").max(50, "سنوات الخبرة غير صحيحة"),
  sub_service_ids: z.array(z.string()).min(1, "يجب اختيار خدمة واحدة على الأقل"),
  notes: z.string().max(500, "الملاحظات طويلة جداً").optional(),
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
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
    },
  });

  useEffect(() => {
    if (token) {
      validateToken();
      fetchServices();
    } else {
      toast({
        title: "خطأ / Error",
        description: "رابط التسجيل غير صحيح / Invalid registration link",
        variant: "destructive",
      });
    }
  }, [token]);

  useEffect(() => {
    if (selectedServices.length > 0) {
      fetchSubServicesForMultipleServices(selectedServices);
    } else {
      setSubServices([]);
    }
  }, [selectedServices]);

  const validateToken = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("specialists")
        .select("*")
        .eq("registration_token", token)
        .eq("approval_status", "pending")
        .is("registration_completed_at", null)
        .single();

      if (error || !data) {
        toast({
          title: "خطأ / Error",
          description: "رابط التسجيل غير صحيح أو منتهي الصلاحية / Invalid or expired registration link",
          variant: "destructive",
        });
        return;
      }

      setSpecialist(data);
      if (data.image_url) {
        setImagePreview(data.image_url);
      }
    } catch (error) {
      console.error("Error validating token:", error);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile || !specialist) return null;

    const fileExt = imageFile.name.split(".").pop();
    const fileName = `${specialist.id}-${Date.now()}.${fileExt}`;
    const filePath = `specialist-photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("specialist-photos")
      .upload(filePath, imageFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("specialist-photos")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const onSubmit = async (values: RegistrationFormValues) => {
    if (!specialist) return;

    if (!imageFile && !specialist.image_url) {
      toast({
        title: "خطأ / Error",
        description: "يجب رفع صورة شخصية / Please upload a profile picture",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = specialist.image_url;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const { error: updateError } = await supabase
        .from("specialists")
        .update({
          experience_years: values.experience_years,
          notes: values.notes,
          image_url: imageUrl,
          registration_completed_at: new Date().toISOString(),
        })
        .eq("id", specialist.id)
        .eq("registration_token", token);

      if (updateError) throw updateError;

      // Delete existing specialties
      await supabase
        .from("specialist_specialties")
        .delete()
        .eq("specialist_id", specialist.id);

      // Insert new specialties
      const specialties = values.sub_service_ids.map(subServiceId => ({
        specialist_id: specialist.id,
        sub_service_id: subServiceId,
      }));

      const { error: specialtiesError } = await supabase
        .from("specialist_specialties")
        .insert(specialties);

      if (specialtiesError) throw specialtiesError;

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

  if (!specialist) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">
              رابط غير صحيح / Invalid Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">
              رابط التسجيل غير صحيح أو منتهي الصلاحية
              <br />
              Invalid or expired registration link
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              إكمال التسجيل - Complete Registration
            </CardTitle>
            <CardDescription className="text-center">
              مرحباً {specialist.name}، يرجى إكمال البيانات التالية
              <br />
              Welcome {specialist.name}, please complete the following information
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
                {/* Profile Picture */}
                <div className="space-y-2">
                  <FormLabel className="text-base">الصورة الشخصية / Profile Picture *</FormLabel>
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-32 w-32">
                      <AvatarImage src={imagePreview} />
                      <AvatarFallback className="text-2xl">
                        {specialist.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent">
                        <Upload className="h-4 w-4" />
                        <span className="text-sm">
                          {imagePreview ? "تغيير الصورة / Change Photo" : "رفع الصورة / Upload Photo"}
                        </span>
                      </div>
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>

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