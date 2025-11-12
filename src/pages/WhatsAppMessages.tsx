import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ArrowRight, ArrowLeft, MessageSquare } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

interface MessageTemplate {
  id: string;
  message_key: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  template_ar: string;
  template_en: string;
  category: string;
  is_active: boolean;
}

export default function WhatsAppMessages() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_message_templates")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async (template: MessageTemplate) => {
      const { error } = await supabase
        .from("whatsapp_message_templates")
        .update({
          template_ar: template.template_ar,
          template_en: template.template_en,
        })
        .eq("id", template.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({
        title: language === "ar" ? "تم التحديث بنجاح" : "Updated successfully",
        description: language === "ar" ? "تم حفظ التعديلات" : "Changes saved",
      });
      setShowEditDialog(false);
    },
    onError: (error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setShowEditDialog(true);
  };

  const handleSave = () => {
    if (!selectedTemplate) return;
    updateMutation.mutate(selectedTemplate);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          {language === "ar" ? (
            <>
              <ArrowRight className="h-4 w-4 ml-2" />
              رجوع
            </>
          ) : (
            <>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </>
          )}
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "قوالب رسائل واتساب" : "WhatsApp Message Templates"}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {language === "ar"
            ? "إدارة وتخصيص رسائل واتساب التي يتم إرسالها للعملاء"
            : "Manage and customize WhatsApp messages sent to customers"}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {templates?.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{language === "ar" ? template.name_ar : template.name_en}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(template)}
                >
                  {language === "ar" ? "تعديل" : "Edit"}
                </Button>
              </CardTitle>
              <CardDescription>
                {language === "ar" ? template.description_ar : template.description_en}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-mono whitespace-pre-wrap">
                  {language === "ar" ? template.template_ar : template.template_en}
                </p>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {language === "ar" ? "المتغيرات المتاحة:" : "Available variables:"} {"{{"}{template.message_key === "order_created" && "customer_name, order_number, service_type, booking_date"}
                  {template.message_key === "specialist_offers" && "customer_name, order_number, offers_list"}
                  {template.message_key === "booking_confirmed" && "customer_name, order_number, specialist_name, booking_date, booking_time, agreed_amount"}
                  {template.message_key === "booking_reminder" && "customer_name, order_number, specialist_name, booking_time"}
                  {template.message_key === "specialist_arrived" && "customer_name, specialist_name"}
                  {template.message_key === "waiting_for_customer" && "customer_name, specialist_name"}
                  {template.message_key === "work_started" && "customer_name, specialist_name, order_number, start_time"}
                  {template.message_key === "work_completed" && "customer_name, order_number, specialist_name, work_duration, total_amount"}
                  {template.message_key === "work_extended" && "customer_name, order_number, extension_duration, extension_cost"}
                  {template.message_key === "request_review" && "customer_name, specialist_name"}
                {"}}"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تعديل قالب الرسالة" : "Edit Message Template"}
            </DialogTitle>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <Label>{language === "ar" ? "اسم القالب" : "Template Name"}</Label>
                <Input
                  value={language === "ar" ? selectedTemplate.name_ar : selectedTemplate.name_en}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
                <Input
                  value={language === "ar" ? selectedTemplate.description_ar : selectedTemplate.description_en}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label>{language === "ar" ? "الرسالة بالعربية" : "Arabic Message"}</Label>
                <Textarea
                  value={selectedTemplate.template_ar}
                  onChange={(e) =>
                    setSelectedTemplate({
                      ...selectedTemplate,
                      template_ar: e.target.value,
                    })
                  }
                  rows={8}
                  className="font-mono"
                />
              </div>

              <div>
                <Label>{language === "ar" ? "الرسالة بالإنجليزية" : "English Message"}</Label>
                <Textarea
                  value={selectedTemplate.template_en}
                  onChange={(e) =>
                    setSelectedTemplate({
                      ...selectedTemplate,
                      template_en: e.target.value,
                    })
                  }
                  rows={8}
                  className="font-mono"
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-semibold mb-2">
                  {language === "ar" ? "ملاحظة:" : "Note:"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "ar"
                    ? "استخدم المتغيرات مثل {{customer_name}} في الرسالة وسيتم استبدالها تلقائياً بالقيم الفعلية عند الإرسال"
                    : "Use variables like {{customer_name}} in the message and they will be automatically replaced with actual values when sent"}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={updateMutation.isPending}
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  )}
                  <Save className="h-4 w-4 ml-2" />
                  {language === "ar" ? "حفظ" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
