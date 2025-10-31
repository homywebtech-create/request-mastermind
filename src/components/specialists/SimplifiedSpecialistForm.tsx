import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { countries } from "@/data/countries";
import { Copy, Link as LinkIcon } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

const simplifiedSchema = z.object({
  countryCode: z.string().min(1, "يجب اختيار كود الدولة / Country code required"),
  phone: z.string().min(7, "رقم الهاتف غير صحيح / Invalid phone number").max(15),
});

type SimplifiedFormValues = z.infer<typeof simplifiedSchema>;

interface SimplifiedSpecialistFormProps {
  companyId: string;
  onSuccess: () => void;
}

export function SimplifiedSpecialistForm({ companyId, onSuccess }: SimplifiedSpecialistFormProps) {
  const { language } = useLanguage();
  const t = useTranslation(language).specialists;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationLink, setRegistrationLink] = useState<string | null>(null);

  const form = useForm<SimplifiedFormValues>({
    resolver: zodResolver(simplifiedSchema),
    defaultValues: {
      countryCode: "+966",
      phone: "",
    },
  });

  const onSubmit = async (data: SimplifiedFormValues) => {
    setIsSubmitting(true);
    try {
      const fullPhone = `${data.countryCode}${data.phone}`;

      // Check if specialist with this phone already exists
      const { data: existingSpecialist } = await supabase
        .from("specialists")
        .select("id, registration_token, registration_completed_at")
        .eq("phone", fullPhone)
        .eq("company_id", companyId)
        .maybeSingle();

      if (existingSpecialist) {
        if (existingSpecialist.registration_completed_at) {
          toast({
            title: language === 'ar' ? "خطأ" : "Error",
            description: language === 'ar' 
              ? "هذا الرقم مسجل بالفعل" 
              : "This phone number is already registered",
            variant: "destructive",
          });
          return;
        }
        
        // If registration not completed, show the existing link
        const link = `${window.location.origin}/specialist-registration?token=${existingSpecialist.registration_token}`;
        setRegistrationLink(link);
        return;
      }

      // Generate a unique registration token
      const token = `${companyId}_${fullPhone}_${Date.now()}`;

      // Insert new specialist with minimal data
      const { data: specialistData, error: specialistError } = await supabase
        .from("specialists")
        .insert({
          company_id: companyId,
          phone: fullPhone,
          name: fullPhone, // Temporary name, will be updated during registration
          registration_token: token,
          approval_status: 'pending',
          is_active: false,
        })
        .select()
        .single();

      if (specialistError) throw specialistError;

      // Generate registration link
      const link = `${window.location.origin}/specialist-registration?token=${token}`;
      setRegistrationLink(link);

      toast({
        title: language === 'ar' ? "نجح" : "Success",
        description: language === 'ar' 
          ? "تم إنشاء رابط التسجيل بنجاح" 
          : "Registration link created successfully",
      });

    } catch (error: any) {
      console.error("Error creating specialist:", error);
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!registrationLink) return;
    
    try {
      await navigator.clipboard.writeText(registrationLink);
      toast({
        title: language === 'ar' ? "تم النسخ" : "Copied",
        description: language === 'ar' 
          ? "تم نسخ الرابط" 
          : "Link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' 
          ? "فشل نسخ الرابط" 
          : "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setRegistrationLink(null);
    form.reset();
    onSuccess();
  };

  if (registrationLink) {
    return (
      <div className="space-y-4">
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">
              {language === 'ar' ? 'رابط التسجيل' : 'Registration Link'}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {language === 'ar' 
              ? 'قم بنسخ هذا الرابط وإرساله للمحترف لإكمال تسجيله'
              : 'Copy this link and send it to the specialist to complete registration'}
          </p>
          <div className="flex gap-2">
            <Input 
              value={registrationLink} 
              readOnly 
              className="font-mono text-sm"
            />
            <Button 
              onClick={copyToClipboard}
              variant="outline"
              size="icon"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={handleReset}>
            {language === 'ar' ? 'إضافة محترف آخر' : 'Add Another Specialist'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mb-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {language === 'ar' 
              ? 'قم بإدخال رقم هاتف المحترف فقط، وسيتم إنشاء رابط تسجيل خاص به لإكمال باقي البيانات'
              : 'Enter the specialist phone number only, and a registration link will be created for them to complete the rest of the information'}
          </p>
        </div>

        <div className="grid grid-cols-[140px_1fr] gap-2">
          <FormField
            control={form.control}
            name="countryCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {language === 'ar' ? 'كود الدولة *' : 'Country Code *'}
                </FormLabel>
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
                <FormLabel>
                  {language === 'ar' ? 'رقم الهاتف *' : 'Phone Number *'}
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder={language === 'ar' ? '5xxxxxxxx' : '5xxxxxxxx'} 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting 
              ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') 
              : (language === 'ar' ? 'إنشاء رابط التسجيل' : 'Create Registration Link')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
