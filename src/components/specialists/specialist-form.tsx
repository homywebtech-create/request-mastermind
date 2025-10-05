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
import { countries } from "@/data/countries";

const specialistSchema = z.object({
  name: z.string().min(2, "يجب أن يكون الاسم حرفين على الأقل").max(100),
  countryCode: z.string().min(1, "يجب اختيار كود الدولة"),
  phone: z.string().min(7, "رقم الهاتف غير صحيح").max(15),
  nationality: z.string().min(1, "يجب اختيار الجنسية"),
  sub_service_ids: z.array(z.string()).min(1, "يجب اختيار تخصص واحد على الأقل"),
  experience_years: z.coerce.number().min(0).max(50).optional(),
  notes: z.string().max(500).optional(),
});

type SpecialistFormValues = z.infer<typeof specialistSchema>;

interface SpecialistFormProps {
  companyId: string;
  onSuccess: () => void;
  specialist?: {
    id: string;
    name: string;
    phone: string;
    nationality: string;
    experience_years?: number;
    notes?: string;
    image_url?: string;
    specialist_specialties?: Array<{
      sub_service_id: string;
      sub_services: {
        service_id: string;
      };
    }>;
  };
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

export function SpecialistForm({ companyId, onSuccess, specialist }: SpecialistFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");

  // Extract country code and phone number from specialist if editing
  const extractPhoneData = (fullPhone: string) => {
    const country = countries.find(c => fullPhone.startsWith(c.dialCode));
    if (country) {
      return {
        countryCode: country.dialCode,
        phone: fullPhone.slice(country.dialCode.length)
      };
    }
    return { countryCode: "+966", phone: fullPhone };
  };

  const phoneData = specialist ? extractPhoneData(specialist.phone) : { countryCode: "+966", phone: "" };
  
  const form = useForm<SpecialistFormValues>({
    resolver: zodResolver(specialistSchema),
    defaultValues: {
      name: specialist?.name || "",
      countryCode: phoneData.countryCode,
      phone: phoneData.phone,
      nationality: specialist?.nationality || "",
      sub_service_ids: specialist?.specialist_specialties?.map(s => s.sub_service_id) || [],
      experience_years: specialist?.experience_years || 0,
      notes: specialist?.notes || "",
    },
  });

  useEffect(() => {
    fetchServices();
    if (specialist) {
      setImagePreview(specialist.image_url || "");
      // Set the service if editing
      if (specialist.specialist_specialties && specialist.specialist_specialties.length > 0) {
        const firstServiceId = specialist.specialist_specialties[0].sub_services.service_id;
        setSelectedService(firstServiceId);
      }
    }
  }, [specialist]);

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

      const fullPhone = `${data.countryCode}${data.phone}`;
      
      if (specialist) {
        // Update existing specialist
        const { error: specialistError } = await supabase
          .from("specialists")
          .update({
            name: data.name,
            phone: fullPhone,
            nationality: data.nationality,
            experience_years: data.experience_years || null,
            notes: data.notes || null,
            image_url: imageUrl || specialist.image_url,
          })
          .eq("id", specialist.id);

        if (specialistError) throw specialistError;

        // Delete old specialties and insert new ones
        const { error: deleteError } = await supabase
          .from("specialist_specialties")
          .delete()
          .eq("specialist_id", specialist.id);

        if (deleteError) throw deleteError;

        const specialtiesData = data.sub_service_ids.map((subServiceId) => ({
          specialist_id: specialist.id,
          sub_service_id: subServiceId,
        }));

        const { error: specialtiesError } = await supabase
          .from("specialist_specialties")
          .insert(specialtiesData);

        if (specialtiesError) throw specialtiesError;

        toast({
          title: "Success",
          description: "Specialist updated successfully",
        });
      } else {
        // Insert new specialist
        const { data: specialistData, error: specialistError } = await supabase
          .from("specialists")
          .insert({
            company_id: companyId,
            name: data.name,
            phone: fullPhone,
            nationality: data.nationality,
            experience_years: data.experience_years || null,
            notes: data.notes || null,
            image_url: imageUrl,
          })
          .select()
          .single();

        if (specialistError) throw specialistError;

        // Insert the specialties
        const specialtiesData = data.sub_service_ids.map((subServiceId) => ({
          specialist_id: specialistData.id,
          sub_service_id: subServiceId,
        }));

        const { error: specialtiesError } = await supabase
          .from("specialist_specialties")
          .insert(specialtiesData);

        if (specialtiesError) throw specialtiesError;

        toast({
          title: "Success",
          description: "Specialist added successfully",
        });
      }

      form.reset();
      setImageFile(null);
      setImagePreview("");
      setSelectedService("");
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!specialist && (
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Specialist
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{specialist ? "Edit Specialist" : "Add New Specialist"}</DialogTitle>
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
                <FormLabel>Specialist Photo</FormLabel>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Max size: 5 MB (JPG, PNG, WEBP)
                </p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter specialist name" {...field} />
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
                    <FormLabel>Country Code *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="5xxxxxxxx" {...field} />
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
                  <FormLabel>Nationality *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select nationality" />
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

            <FormItem>
              <FormLabel>Main Service</FormLabel>
              <Select onValueChange={setSelectedService} value={selectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service to filter specialties" />
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
              name="sub_service_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialties * (You can select multiple)</FormLabel>
                  <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto">
                    {(selectedService ? subServices : []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {selectedService ? "No specialties available" : "Select the main service first"}
                      </p>
                    ) : (
                      subServices.map((subService) => (
                        <div key={subService.id} className="flex items-center space-x-2 space-x-reverse">
                          <input
                            type="checkbox"
                            id={subService.id}
                            checked={field.value?.includes(subService.id) || false}
                            onChange={(e) => {
                              const newValue = e.target.checked
                                ? [...(field.value || []), subService.id]
                                : (field.value || []).filter((id) => id !== subService.id);
                              field.onChange(newValue);
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label
                            htmlFor={subService.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {subService.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <FormMessage />
                  {field.value && field.value.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {field.value.length} specialties selected
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="experience_years"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of Experience</FormLabel>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes..."
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
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (specialist ? "Updating..." : "Adding...") : (specialist ? "Update" : "Add")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
