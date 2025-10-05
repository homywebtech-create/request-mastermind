import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { nationalities } from "@/data/nationalities";

const specialistSchema = z.object({
  name: z.string().min(2, "يجب أن يكون الاسم حرفين على الأقل").max(100),
  phone: z.string().min(10, "رقم الهاتف غير صحيح").max(20),
  email: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),
  nationality: z.string().min(1, "يجب اختيار الجنسية"),
  sub_service_id: z.string().min(1, "يجب اختيار التخصص"),
  experience_years: z.coerce.number().min(0).max(50).optional(),
  notes: z.string().max(500).optional(),
});

type SpecialistFormValues = z.infer<typeof specialistSchema>;

interface SpecialistFormProps {
  companyId: string;
  onSuccess: () => void;
}

interface Service {
  id: string;
  name: string;
}

interface SubService {
  id: string;
  name: string;
  service_id: string;
}

export function SpecialistForm({ companyId, onSuccess }: SpecialistFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");

  const form = useForm<SpecialistFormValues>({
    resolver: zodResolver(specialistSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      nationality: "",
      sub_service_id: "",
      experience_years: 0,
      notes: "",
    },
  });

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    if (selectedService) {
      fetchSubServices(selectedService);
    } else {
      setSubServices([]);
    }
  }, [selectedService]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error("Error fetching services:", error);
    }
  };

  const fetchSubServices = async (serviceId: string) => {
    try {
      const { data, error } = await supabase
        .from("sub_services")
        .select("id, name, service_id")
        .eq("service_id", serviceId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setSubServices(data || []);
    } catch (error: any) {
      console.error("Error fetching sub services:", error);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "خطأ",
          description: "حجم الصورة يجب أن يكون أقل من 5 ميجابايت",
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

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${companyId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("specialist-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("specialist-photos")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error: any) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const onSubmit = async (data: SpecialistFormValues) => {
    setIsSubmitting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const { error } = await supabase.from("specialists").insert({
        company_id: companyId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        nationality: data.nationality,
        sub_service_id: data.sub_service_id,
        experience_years: data.experience_years || null,
        notes: data.notes || null,
        image_url: imageUrl,
      });

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: "تم إضافة المحترف بنجاح",
      });

      form.reset();
      setImageFile(null);
      setImagePreview("");
      setSelectedService("");
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          إضافة محترف
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة محترف جديد</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={imagePreview} />
                <AvatarFallback>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2 w-full">
                <FormLabel>صورة المحترف</FormLabel>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  الحد الأقصى: 5 ميجابايت (JPG, PNG, WEBP)
                </p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الاسم *</FormLabel>
                  <FormControl>
                    <Input placeholder="أدخل اسم المحترف" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الهاتف *</FormLabel>
                    <FormControl>
                      <Input placeholder="05xxxxxxxx" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="example@email.com" {...field} />
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
                  <FormLabel>الجنسية *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الجنسية" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60">
                      {nationalities.map((nationality) => (
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>الخدمة الرئيسية *</FormLabel>
                <Select onValueChange={setSelectedService} value={selectedService}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الخدمة" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>

              <FormField
                control={form.control}
                name="sub_service_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>التخصص (الخدمة الفرعية) *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!selectedService}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر التخصص" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subServices.map((subService) => (
                          <SelectItem key={subService.id} value={subService.id}>
                            {subService.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="experience_years"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>سنوات الخبرة</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" max="50" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="أي ملاحظات إضافية..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "جاري الإضافة..." : "إضافة"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
