import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Building2, ArrowRight, Settings, Wrench, Edit, Send, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { countries } from "@/data/countries";

interface Service {
  id: string;
  name: string;
  sub_services?: SubService[];
}

interface SubService {
  id: string;
  name: string;
}

interface CompanyService {
  service_id: string;
  sub_service_id?: string;
  service_name: string;
  sub_service_name?: string;
}

interface Company {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  company_services?: CompanyService[];
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<{serviceId: string, subServiceIds: string[]}[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryCode, setCountryCode] = useState("QA");
  const [editCountryCode, setEditCountryCode] = useState("QA");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // جلب الشركات والخدمات عند تحميل الصفحة
  useEffect(() => {
    fetchCompanies();
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (servicesError) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الخدمات",
        variant: "destructive",
      });
      return;
    }

    const { data: subServicesData } = await supabase
      .from("sub_services")
      .select("*")
      .eq("is_active", true);

    const servicesWithSubs = (servicesData || []).map(service => ({
      ...service,
      sub_services: (subServicesData || []).filter(sub => sub.service_id === service.id)
    }));

    setServices(servicesWithSubs);
  };

  const fetchCompanies = async () => {
    setLoading(true);
    const { data: companiesData, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الشركات",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // جلب الخدمات لكل شركة مع أسماء الخدمات
    const { data: companyServicesData } = await supabase
      .from("company_services")
      .select(`
        company_id,
        service_id,
        sub_service_id,
        services(name),
        sub_services(name)
      `);

    const companiesWithServices = (companiesData || []).map(company => ({
      ...company,
      company_services: (companyServicesData || [])
        .filter((cs: any) => cs.company_id === company.id)
        .map((cs: any) => ({
          service_id: cs.service_id,
          sub_service_id: cs.sub_service_id,
          service_name: cs.services?.name,
          sub_service_name: cs.sub_services?.name
        }))
    }));

    setCompanies(companiesWithServices);
    setLoading(false);
  };

  const handleManageServices = (company: Company) => {
    setSelectedCompany(company);
    
    // تحويل الخدمات الحالية للشركة إلى الصيغة المطلوبة
    const currentServices: {serviceId: string, subServiceIds: string[]}[] = [];
    
    (company.company_services || []).forEach(cs => {
      const existingService = currentServices.find(s => s.serviceId === cs.service_id);
      if (existingService && cs.sub_service_id) {
        existingService.subServiceIds.push(cs.sub_service_id);
      } else if (!existingService) {
        currentServices.push({
          serviceId: cs.service_id,
          subServiceIds: cs.sub_service_id ? [cs.sub_service_id] : []
        });
      }
    });
    
    setSelectedServiceIds(currentServices);
    setIsServicesDialogOpen(true);
  };

  const handleSaveServices = async () => {
    if (!selectedCompany) return;

    // التحقق من أن كل خدمة محددة لديها خدمات فرعية
    const servicesWithoutSubs: string[] = [];
    
    selectedServiceIds.forEach(selectedService => {
      const service = services.find(s => s.id === selectedService.serviceId);
      
      // إذا كانت الخدمة لديها خدمات فرعية ولكن لم يتم اختيار أي منها
      if (service?.sub_services && service.sub_services.length > 0 && selectedService.subServiceIds.length === 0) {
        servicesWithoutSubs.push(service.name);
      }
    });

    // إذا كانت هناك خدمات بدون خدمات فرعية محددة
    if (servicesWithoutSubs.length > 0) {
      toast({
        title: "خطأ في التحديد",
        description: `يجب اختيار خدمات فرعية لـ: ${servicesWithoutSubs.join('، ')}`,
        variant: "destructive",
      });
      return;
    }

    try {
      // حذف جميع الخدمات الحالية للشركة
      await supabase
        .from("company_services")
        .delete()
        .eq("company_id", selectedCompany.id);

      // إضافة الخدمات والخدمات الفرعية المحددة
      const servicesToInsert: any[] = [];
      
      selectedServiceIds.forEach(service => {
        if (service.subServiceIds.length > 0) {
          // إضافة كل خدمة فرعية محددة
          service.subServiceIds.forEach(subServiceId => {
            servicesToInsert.push({
              company_id: selectedCompany.id,
              service_id: service.serviceId,
              sub_service_id: subServiceId
            });
          });
        } else {
          // إذا لم تكن هناك خدمات فرعية للخدمة أصلاً (الخدمة الرئيسية فقط)
          const service_obj = services.find(s => s.id === service.serviceId);
          if (!service_obj?.sub_services || service_obj.sub_services.length === 0) {
            servicesToInsert.push({
              company_id: selectedCompany.id,
              service_id: service.serviceId,
              sub_service_id: null
            });
          }
        }
      });

      if (servicesToInsert.length > 0) {
        const { error } = await supabase
          .from("company_services")
          .insert(servicesToInsert);

        if (error) throw error;
      }

      toast({
        title: "نجح",
        description: "تم تحديث الخدمات بنجاح",
      });

      setIsServicesDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev => {
      const exists = prev.find(s => s.serviceId === serviceId);
      if (exists) {
        return prev.filter(s => s.serviceId !== serviceId);
      } else {
        return [...prev, { serviceId, subServiceIds: [] }];
      }
    });
  };

  const toggleSubService = (serviceId: string, subServiceId: string) => {
    setSelectedServiceIds(prev => {
      return prev.map(service => {
        if (service.serviceId === serviceId) {
          const hasSubService = service.subServiceIds.includes(subServiceId);
          return {
            ...service,
            subServiceIds: hasSubService
              ? service.subServiceIds.filter(id => id !== subServiceId)
              : [...service.subServiceIds, subServiceId]
          };
        }
        return service;
      });
    });
  };

  const isServiceSelected = (serviceId: string) => {
    return selectedServiceIds.some(s => s.serviceId === serviceId);
  };

  const isSubServiceSelected = (serviceId: string, subServiceId: string) => {
    const service = selectedServiceIds.find(s => s.serviceId === serviceId);
    return service?.subServiceIds.includes(subServiceId) || false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // دمج كود الدولة مع رقم الهاتف
    const selectedCountry = countries.find(c => c.code === countryCode);
    const fullPhone = formData.phone ? `${selectedCountry?.dialCode}${formData.phone}` : "";

    const { data, error } = await supabase
      .from("companies")
      .insert([{
        ...formData,
        phone: fullPhone
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "نجح",
        description: "تم إضافة الشركة بنجاح",
      });

      // إرسال رابط تسجيل الدخول
      sendLoginLink(formData.name, fullPhone);

      setIsFormOpen(false);
      setFormData({ name: "", phone: "", email: "", address: "" });
      setCountryCode("QA");
      fetchCompanies();
    }
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    
    // استخراج كود الدولة من رقم الهاتف
    let phoneWithoutCode = company.phone || "";
    let detectedCountryCode = "QA";
    
    if (company.phone) {
      // البحث عن كود الدولة في بداية الرقم
      for (const country of countries) {
        if (company.phone.startsWith(country.dialCode)) {
          detectedCountryCode = country.code;
          phoneWithoutCode = company.phone.substring(country.dialCode.length);
          break;
        }
      }
    }
    
    setEditCountryCode(detectedCountryCode);
    setEditFormData({
      name: company.name,
      phone: phoneWithoutCode,
      email: company.email || "",
      address: company.address || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    // دمج كود الدولة مع رقم الهاتف
    const selectedCountry = countries.find(c => c.code === editCountryCode);
    const fullPhone = editFormData.phone ? `${selectedCountry?.dialCode}${editFormData.phone}` : "";

    const { error } = await supabase
      .from("companies")
      .update({
        ...editFormData,
        phone: fullPhone
      })
      .eq("id", selectedCompany.id);

    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "نجح",
        description: "تم تحديث معلومات الشركة بنجاح",
      });
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
      setEditCountryCode("QA");
      fetchCompanies();
    }
  };

  const sendLoginLink = (companyName: string, phone: string) => {
    if (!phone) {
      toast({
        title: "خطأ",
        description: "رقم الهاتف غير متوفر",
        variant: "destructive",
      });
      return;
    }

    const companyLoginUrl = `${window.location.origin}/company-auth`;
    const message = `مرحباً ${companyName}،\n\nتم تسجيل شركتكم في نظامنا.\nللدخول إلى صفحة الشركة، يرجى الضغط على الرابط التالي:\n${companyLoginUrl}\n\nسيطلب منك إدخال رقم الهاتف: ${phone}\nثم سيتم إرسال كود التفعيل عبر الواتساب.`;

    const whatsappUrl = `https://wa.me/${phone.replace(/\+/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');

    toast({
      title: "تم فتح واتساب",
      description: "يمكنك الآن إرسال رابط تسجيل الدخول",
    });
  };

  const handleResendLoginLink = (company: Company) => {
    sendLoginLink(company.name, company.phone || "");
  };

  const handleCopyLoginLink = (company: Company) => {
    const companyLoginUrl = `${window.location.origin}/company-auth`;
    
    navigator.clipboard.writeText(companyLoginUrl).then(() => {
      toast({
        title: "تم النسخ",
        description: "تم نسخ رابط صفحة تسجيل الدخول",
      });
    }).catch(() => {
      toast({
        title: "خطأ",
        description: "فشل نسخ الرابط",
        variant: "destructive",
      });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground font-cairo">
                إدارة الشركات
              </h1>
              <p className="text-muted-foreground mt-1">
                إدارة الشركات والمختصين
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/services")}
                className="flex items-center gap-2"
              >
                <Wrench className="h-4 w-4" />
                إدارة الخدمات
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                العودة للرئيسية
              </Button>

              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    شركة جديدة
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-cairo">إضافة شركة جديدة</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">اسم الشركة *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        placeholder="أدخل اسم الشركة"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">رقم الهاتف</Label>
                      <div className="flex gap-2">
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue>
                              {(() => {
                                const country = countries.find(c => c.code === countryCode);
                                return country ? (
                                  <span className="flex items-center gap-2">
                                    <span className="text-xl">{country.flag}</span>
                                    <span className="text-sm">{country.dialCode}</span>
                                  </span>
                                ) : 'اختر';
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
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            setFormData({ ...formData, phone: value });
                          }}
                          placeholder="501234567"
                          dir="ltr"
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        أدخل الرقم بدون كود الدولة
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="example@email.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">العنوان</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        placeholder="أدخل العنوان"
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsFormOpen(false)}
                      >
                        إلغاء
                      </Button>
                      <Button type="submit">حفظ</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="font-cairo">{company.name}</CardTitle>
                      <CardDescription>
                        {company.is_active ? "نشط" : "غير نشط"}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleManageServices(company)}
                    title="إدارة الخدمات"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {company.phone && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">الهاتف:</span> {company.phone}
                  </p>
                )}
                {company.email && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">البريد:</span> {company.email}
                  </p>
                )}
                {company.address && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">العنوان:</span> {company.address}
                  </p>
                )}
                
                {company.company_services && company.company_services.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium mb-2">الخدمات:</p>
                    <div className="space-y-1">
                      {Object.entries(
                        company.company_services.reduce((acc: any, cs) => {
                          if (!acc[cs.service_name]) {
                            acc[cs.service_name] = [];
                          }
                          if (cs.sub_service_name) {
                            acc[cs.service_name].push(cs.sub_service_name);
                          }
                          return acc;
                        }, {})
                      ).map(([serviceName, subServices]: [string, any]) => (
                        <div key={serviceName} className="text-xs">
                          <Badge variant="secondary" className="mb-1">
                            {serviceName}
                          </Badge>
                          {subServices.length > 0 && (
                            <div className="mr-4 flex flex-wrap gap-1 mt-1">
                              {subServices.map((sub: string) => (
                                <Badge key={sub} variant="outline" className="text-xs">
                                  {sub}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {(!company.company_services || company.company_services.length === 0) && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">لم يتم تحديد خدمات بعد</p>
                  </div>
                )}
                
                {/* أزرار الإجراءات */}
                <div className="pt-3 border-t flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditCompany(company)}
                    >
                      <Edit className="h-4 w-4 ml-2" />
                      تعديل
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCopyLoginLink(company)}
                    >
                      <Copy className="h-4 w-4 ml-2" />
                      نسخ الرابط
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleResendLoginLink(company)}
                    disabled={!company.phone}
                  >
                    <Send className="h-4 w-4 ml-2" />
                    إرسال عبر واتساب
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              لا توجد شركات بعد
            </h3>
            <p className="text-muted-foreground mb-4">
              ابدأ بإضافة أول شركة لك
            </p>
          </div>
        )}
      </main>

      {/* حوار إدارة الخدمات */}
      <Dialog open={isServicesDialogOpen} onOpenChange={setIsServicesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cairo">
              إدارة خدمات {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              اختر الخدمات والخدمات الفرعية التي تقدمها هذه الشركة:
            </p>
            
            {services.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-2">
                  لا توجد خدمات متاحة
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsServicesDialogOpen(false);
                    navigate("/services");
                  }}
                >
                  إضافة خدمات
                </Button>
              </div>
            ) : (
              <Accordion type="multiple" className="w-full">
                {services.map((service) => (
                  <AccordionItem key={service.id} value={service.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isServiceSelected(service.id)}
                          onCheckedChange={() => toggleService(service.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>{service.name}</span>
                      </div>
                    </AccordionTrigger>
                    {service.sub_services && service.sub_services.length > 0 && (
                      <AccordionContent>
                        <div className="mr-8 space-y-2 pt-2">
                          {service.sub_services.map((subService) => (
                            <div key={subService.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={isSubServiceSelected(service.id, subService.id)}
                                onCheckedChange={() => toggleSubService(service.id, subService.id)}
                                disabled={!isServiceSelected(service.id)}
                              />
                              <Label className="text-sm cursor-pointer">
                                {subService.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    )}
                  </AccordionItem>
                ))}
              </Accordion>
            )}
            
            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsServicesDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button onClick={handleSaveServices}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* حوار تعديل الشركة */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-cairo">تعديل معلومات الشركة</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCompany} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">اسم الشركة *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                required
                placeholder="أدخل اسم الشركة"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">رقم الهاتف</Label>
              <div className="flex gap-2">
                <Select value={editCountryCode} onValueChange={setEditCountryCode}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue>
                      {(() => {
                        const country = countries.find(c => c.code === editCountryCode);
                        return country ? (
                          <span className="flex items-center gap-2">
                            <span className="text-xl">{country.flag}</span>
                            <span className="text-sm">{country.dialCode}</span>
                          </span>
                        ) : 'اختر';
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
                  id="edit-phone"
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setEditFormData({ ...editFormData, phone: value });
                  }}
                  placeholder="501234567"
                  dir="ltr"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                أدخل الرقم بدون كود الدولة
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">البريد الإلكتروني</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, email: e.target.value })
                }
                placeholder="example@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">العنوان</Label>
              <Input
                id="edit-address"
                value={editFormData.address}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, address: e.target.value })
                }
                placeholder="أدخل العنوان"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit">حفظ التعديلات</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
