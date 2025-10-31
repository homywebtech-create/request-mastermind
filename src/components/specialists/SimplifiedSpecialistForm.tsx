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
import { Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

const simplifiedSchema = z.object({
  countryCode: z.string().min(1, "يجب اختيار كود الدولة / Country code required"),
  phone: z.string().min(7, "رقم الهاتف غير صحيح / Invalid phone number").max(15),
});

type SimplifiedFormValues = z.infer<typeof simplifiedSchema>;

interface SimplifiedSpecialistFormProps {
  companyId: string;
  companyCountryCode: string;
  onSuccess: () => void;
}

export function SimplifiedSpecialistForm({ companyId, companyCountryCode, onSuccess }: SimplifiedSpecialistFormProps) {
  const { language } = useLanguage();
  const t = useTranslation(language).specialists;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationLink, setRegistrationLink] = useState<string>("");
  const [showLink, setShowLink] = useState(false);

  const form = useForm<SimplifiedFormValues>({
    resolver: zodResolver(simplifiedSchema),
    defaultValues: {
      countryCode: companyCountryCode || "+966",
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
        
        // If registration not completed, show success message
        toast({
          title: language === 'ar' ? "تنبيه" : "Notice",
          description: language === 'ar' 
            ? "الرابط موجود بالفعل، يمكن نسخه من جدول المحترفين" 
            : "Link already exists, you can copy it from the specialists table",
        });
        onSuccess();
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
          is_active: true,
        })
        .select()
        .single();

      if (specialistError) throw specialistError;

      // Generate registration link
      const link = `${window.location.origin}/specialist-registration?token=${token}`;
      setRegistrationLink(link);
      setShowLink(true);

      toast({
        title: language === 'ar' ? "نجح" : "Success",
        description: language === 'ar' 
          ? "تم إنشاء رابط التسجيل بنجاح. يمكنك نسخه وإرساله للمحترف" 
          : "Registration link created successfully. You can copy and send it to the specialist",
      });

      form.reset();
      onSuccess();

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
    try {
      await navigator.clipboard.writeText(registrationLink);
      toast({
        title: language === 'ar' ? "تم النسخ" : "Copied",
        description: language === 'ar' ? "تم نسخ رابط التسجيل" : "Registration link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: language === 'ar' ? "فشل النسخ" : "Failed to copy",
        variant: "destructive",
      });
    }
  };

  const openLink = () => {
    window.open(registrationLink, '_blank');
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mb-4 border-l-4 border-blue-500">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
            {language === 'ar' ? '📱 إضافة محترف جديد' : '📱 Add New Specialist'}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {language === 'ar' 
              ? `رقم الهاتف يجب أن يكون برمز الدولة ${companyCountryCode}. سيتم إنشاء رابط تسجيل خاص به لإكمال باقي البيانات.`
              : `Phone number must use country code ${companyCountryCode}. A registration link will be created for them to complete the rest of the information.`}
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
                <Select onValueChange={field.onChange} value={field.value} disabled>
                  <FormControl>
                    <SelectTrigger className="bg-muted">
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

        {showLink && registrationLink && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium text-green-800 dark:text-green-200">
                  {language === 'ar' ? '✅ تم إنشاء رابط التسجيل!' : '✅ Registration link created!'}
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border text-sm break-all">
                    <code className="flex-1 text-xs">{registrationLink}</code>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={copyToClipboard}
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      {language === 'ar' ? 'نسخ الرابط' : 'Copy Link'}
                    </Button>
                    <Button
                      type="button"
                      onClick={openLink}
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {language === 'ar' ? 'فتح الرابط' : 'Open Link'}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {language === 'ar' 
                    ? 'قم بنسخ هذا الرابط وإرساله للمحترف عبر الواتساب أو أي وسيلة أخرى لإكمال التسجيل'
                    : 'Copy this link and send it to the specialist via WhatsApp or any other method to complete registration'}
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

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
