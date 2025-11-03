import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Building2, ArrowRight, Settings, Wrench, Edit, Send, Copy, Upload, Image as ImageIcon, Phone, Mail, MapPin, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { countries } from "@/data/countries";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";
import { openWhatsApp } from "@/lib/externalLinks";
import SpecialistsLivePanel from "@/components/specialists/SpecialistsLivePanel";

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
  name_en?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  logo_url?: string;
  company_services?: CompanyService[];
}

export default function Companies() {
  const { language } = useLanguage();
  const translations = useTranslation(language);
  const t = translations.companies;
  const tCommon = translations.common;
  const tStatus = translations.status;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<{serviceId: string, subServiceIds: string[]}[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryCode, setCountryCode] = useState("QA");
  const [editCountryCode, setEditCountryCode] = useState("QA");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    phone: "",
    email: "",
    address: "",
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    name_en: "",
    phone: "",
    email: "",
    address: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompanies();
    fetchServices();
  }, []);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: tCommon.error,
        description: t.maxLogoSize,
        variant: "destructive",
      });
      return;
    }

    if (isEdit) {
      setEditLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (file: File, companyId: string): Promise<string | null> => {
    try {
      setUploadingLogo(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: tCommon.error,
        description: t.imageUploadFailed,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const fetchServices = async () => {
    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (servicesError) {
      toast({
        title: tCommon.error,
        description: t.loadServicesError,
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
        title: tCommon.error,
        description: t.loadCompaniesError,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

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

    const servicesWithoutSubs: string[] = [];
    
    selectedServiceIds.forEach(selectedService => {
      const service = services.find(s => s.id === selectedService.serviceId);
      
      if (service?.sub_services && service.sub_services.length > 0 && selectedService.subServiceIds.length === 0) {
        servicesWithoutSubs.push(service.name);
      }
    });

    if (servicesWithoutSubs.length > 0) {
      toast({
        title: t.selectionError,
        description: `${t.mustSelectSubServices} ${servicesWithoutSubs.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    try {
      await supabase
        .from("company_services")
        .delete()
        .eq("company_id", selectedCompany.id);

      const servicesToInsert: any[] = [];
      
      selectedServiceIds.forEach(service => {
        if (service.subServiceIds.length > 0) {
          service.subServiceIds.forEach(subServiceId => {
            servicesToInsert.push({
              company_id: selectedCompany.id,
              service_id: service.serviceId,
              sub_service_id: subServiceId
            });
          });
        } else {
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
        title: tCommon.success,
        description: t.companyUpdated,
      });

      setIsServicesDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      toast({
        title: tCommon.error,
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

    const selectedCountry = countries.find(c => c.code === countryCode);
    const fullPhone = formData.phone ? `${selectedCountry?.dialCode}${formData.phone}` : "";

    const { data, error } = await supabase
      .from("companies")
      .insert([{
        ...formData,
        phone: fullPhone,
        country_code: selectedCountry?.dialCode || '+966' // حفظ مفتاح الدولة
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    if (logoFile && data) {
      const logoUrl = await uploadLogo(logoFile, data.id);
      if (logoUrl) {
        await supabase
          .from("companies")
          .update({ logo_url: logoUrl })
          .eq("id", data.id);
      }
    }

    toast({
      title: tCommon.success,
      description: t.companyAdded,
    });

    sendLoginLink(formData.name, fullPhone);

    setIsFormOpen(false);
    setFormData({ name: "", name_en: "", phone: "", email: "", address: "" });
    setLogoFile(null);
    setLogoPreview(null);
    setCountryCode("QA");
    fetchCompanies();
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    
    let phoneWithoutCode = company.phone || "";
    let detectedCountryCode = "QA";
    
    console.log('📝 Opening edit dialog for company:', {
      companyId: company.id,
      companyName: company.name,
      originalPhone: company.phone
    });
    
    if (company.phone) {
      for (const country of countries) {
        if (company.phone.startsWith(country.dialCode)) {
          detectedCountryCode = country.code;
          phoneWithoutCode = company.phone.substring(country.dialCode.length);
          console.log('✂️ Phone extraction:', {
            matchedCountry: country.name,
            dialCode: country.dialCode,
            phoneWithoutCode
          });
          break;
        }
      }
    }
    
    console.log('📋 Final edit form data:', {
      detectedCountryCode,
      phoneWithoutCode,
      fullData: {
        name: company.name,
        name_en: company.name_en || "",
        phone: phoneWithoutCode,
        email: company.email || "",
        address: company.address || "",
      }
    });
    
    setEditCountryCode(detectedCountryCode);
    setEditFormData({
      name: company.name,
      name_en: company.name_en || "",
      phone: phoneWithoutCode,
      email: company.email || "",
      address: company.address || "",
    });
    setEditLogoPreview(company.logo_url || null);
    setEditLogoFile(null);
    setIsEditDialogOpen(true);
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const selectedCountry = countries.find(c => c.code === editCountryCode);
    const fullPhone = editFormData.phone ? `${selectedCountry?.dialCode}${editFormData.phone}` : "";

    console.log('🔍 Update Debug Info:', {
      editCountryCode,
      selectedCountry,
      rawPhone: editFormData.phone,
      fullPhone,
      companyId: selectedCompany.id
    });

    let logoUrl = selectedCompany.logo_url;
    
    if (editLogoFile) {
      const newLogoUrl = await uploadLogo(editLogoFile, selectedCompany.id);
      if (newLogoUrl) {
        logoUrl = newLogoUrl;
      }
    }

    const updateData = {
      name: editFormData.name,
      name_en: editFormData.name_en || null,
      phone: fullPhone,
      email: editFormData.email || null,
      address: editFormData.address || null,
      logo_url: logoUrl,
      country_code: selectedCountry?.dialCode || '+966' // حفظ مفتاح الدولة
    };

    console.log('📤 Sending update with data:', updateData);

    const { data, error } = await supabase
      .from("companies")
      .update(updateData)
      .eq("id", selectedCompany.id)
      .select();

    if (error) {
      console.error('❌ Update error:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Update successful, returned data:', data);

    toast({
      title: tCommon.success,
      description: t.companyUpdated,
    });
    
    setIsEditDialogOpen(false);
    setSelectedCompany(null);
    setEditCountryCode("QA");
    setEditLogoFile(null);
    setEditLogoPreview(null);
    
    // Refresh companies list
    await fetchCompanies();
  };

  const sendLoginLink = (companyName: string, phone: string) => {
    if (!phone) {
      toast({
        title: tCommon.error,
        description: t.phoneNotAvailable,
        variant: "destructive",
      });
      return;
    }

    const companyLoginUrl = `${window.location.origin}/company-auth`;
    const message = `Hello ${companyName},\n\nYour company has been registered in our system.\nTo access the company page, please click on the following link:\n${companyLoginUrl}\n\nYou will be asked to enter your phone number: ${phone}\nThen an activation code will be sent via WhatsApp.`;

    const whatsappUrl = `https://wa.me/${phone.replace(/\+/g, '')}?text=${encodeURIComponent(message)}`;
    openWhatsApp(phone, message);

    toast({
      title: t.whatsappOpened,
      description: t.canSendLoginLink,
    });
  };

  const handleResendLoginLink = (company: Company) => {
    sendLoginLink(company.name, company.phone || "");
  };

  const handleCopyLoginLink = (company: Company) => {
    const companyLoginUrl = `${window.location.origin}/company-auth`;
    
    navigator.clipboard.writeText(companyLoginUrl).then(() => {
      toast({
        title: tCommon.success,
        description: t.linkCopied,
      });
    }).catch(() => {
      toast({
        title: tCommon.error,
        description: t.linkCopyFailed,
        variant: "destructive",
      });
    });
  };

  const handleDeleteRequest = (company: Company) => {
    setCompanyToDelete(company);
    setIsDeleteDialogOpen(true);
  };

  const submitDeletionRequest = async () => {
    if (!deletionReason.trim()) {
      toast({
        title: tCommon.error,
        description: t.reasonRequired,
        variant: "destructive",
      });
      return;
    }

    if (!companyToDelete || !user) return;

    try {
      // Store company data as JSON for potential restoration
      const companyData = {
        id: companyToDelete.id,
        name: companyToDelete.name,
        name_en: companyToDelete.name_en,
        phone: companyToDelete.phone,
        email: companyToDelete.email,
        address: companyToDelete.address,
        logo_url: companyToDelete.logo_url,
        is_active: companyToDelete.is_active,
      };

      const { error } = await supabase
        .from("deletion_requests")
        .insert({
          company_id: companyToDelete.id,
          requested_by: user.id,
          reason: deletionReason,
          company_data: companyData,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: tCommon.success,
        description: t.deletionRequestSent,
      });

      setIsDeleteDialogOpen(false);
      setDeletionReason("");
      setCompanyToDelete(null);
    } catch (error: any) {
      console.error('Error creating deletion request:', error);
      toast({
        title: tCommon.error,
        description: t.deletionRequestFailed,
        variant: "destructive",
      });
    }
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
                {t.title}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t.manageCompaniesSpecialists}
              </p>
            </div>

            <div className="flex gap-2">
              <LanguageSwitcher />
              
              <Button
                variant="outline"
                onClick={() => navigate("/services")}
                className="flex items-center gap-2"
              >
                <Wrench className="h-4 w-4" />
                {t.manageServices}
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                {t.backToHome}
              </Button>

              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {t.newCompany}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-cairo">{t.addCompany}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t.uploadLogo}</Label>
                      <div className="flex items-center gap-4">
                        {logoPreview ? (
                          <img 
                            src={logoPreview} 
                            alt="Logo preview" 
                            className="h-20 w-20 rounded-lg object-cover border border-border"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center border border-dashed border-border">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleLogoSelect(e, false)}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingLogo}
                            className="w-full"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {logoPreview ? t.changeLogo : t.uploadLogo}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t.maxLogoSize}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">{t.companyName} *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        placeholder={t.enterCompanyName}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name_en">{t.companyNameEn} *</Label>
                      <Input
                        id="name_en"
                        value={formData.name_en}
                        onChange={(e) =>
                          setFormData({ ...formData, name_en: e.target.value })
                        }
                        required
                        placeholder={t.enterCompanyNameEn}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">{t.phone} *</Label>
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
                                ) : t.selectCountry;
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
                                  <span className="font-medium">{country.name}</span>
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
                          required
                          placeholder="501234567"
                          dir="ltr"
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.enterWithoutCountryCode}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">{tCommon.email} *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        placeholder="example@email.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">{t.address} *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        required
                        placeholder={t.address}
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsFormOpen(false)}
                      >
                        {tCommon.cancel}
                      </Button>
                      <Button type="submit" disabled={uploadingLogo}>
                        {uploadingLogo ? t.uploadingImage : tCommon.save}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {companies.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto" dir="ltr">
                    <table className="w-full">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          <th className="text-left p-4 font-medium">Logo</th>
                          <th className="text-left p-4 font-medium">Company Name</th>
                          <th className="text-left p-4 font-medium">Phone</th>
                          <th className="text-left p-4 font-medium">Email</th>
                          <th className="text-left p-4 font-medium">Address</th>
                          <th className="text-left p-4 font-medium">Services</th>
                          <th className="text-left p-4 font-medium">Status</th>
                          <th className="text-left p-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((company) => (
                          <tr key={company.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-4">
                              {company.logo_url ? (
                                <img 
                                  src={company.logo_url} 
                                  alt={company.name_en || company.name}
                                  className="h-12 w-12 rounded-lg object-cover border border-border"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Building2 className="h-6 w-6 text-primary" />
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="font-medium">{company.name_en || company.name}</div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-muted-foreground" dir="ltr">
                                {company.phone || '-'}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-muted-foreground">
                                {company.email || '-'}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {company.address || '-'}
                              </div>
                            </td>
                            <td className="p-4">
                              {company.company_services && company.company_services.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
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
                                  ).slice(0, 2).map(([serviceName]: [string, any]) => (
                                    <Badge key={serviceName} variant="secondary" className="text-xs">
                                      {serviceName}
                                    </Badge>
                                  ))}
                                  {Object.keys(
                                    company.company_services.reduce((acc: any, cs) => {
                                      if (!acc[cs.service_name]) acc[cs.service_name] = [];
                                      return acc;
                                    }, {})
                                  ).length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{Object.keys(
                                        company.company_services.reduce((acc: any, cs) => {
                                          if (!acc[cs.service_name]) acc[cs.service_name] = [];
                                          return acc;
                                        }, {})
                                      ).length - 2}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">{t.noServicesYet}</span>
                              )}
                            </td>
                            <td className="p-4">
                              <Badge variant={company.is_active ? "default" : "secondary"}>
                                {company.is_active ? tStatus.active : tStatus.inactive}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleManageServices(company)}
                                  title={t.manageServices}
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditCompany(company)}
                                  title={t.edit}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopyLoginLink(company)}
                                  title={t.copyLink}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleResendLoginLink(company)}
                                  disabled={!company.phone}
                                  title={t.sendViaWhatsApp}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteRequest(company)}
                                  title={t.deleteCompany}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {t.noCompaniesYet}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {t.startAddingCompany}
                </p>
              </div>
            )}
          </div>

          {/* Specialists Live Panel */}
          <div className="w-96 hidden xl:block">
            <div className="sticky top-6">
              <SpecialistsLivePanel 
                companyId={undefined} 
                isAdmin={true}
              />
            </div>
          </div>
        </div>
      </main>

      <Dialog open={isServicesDialogOpen} onOpenChange={setIsServicesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cairo">
              {t.manageCompanyServices} {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.selectServices}
            </p>
            
            {services.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-2">
                  {t.noServicesAvailable}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsServicesDialogOpen(false);
                    navigate("/services");
                  }}
                >
                  {t.addServices}
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
                {tCommon.cancel}
              </Button>
              <Button onClick={handleSaveServices}>{tCommon.save}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cairo">{t.editCompany}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateCompany} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.uploadLogo}</Label>
              <div className="flex items-center gap-4">
                {editLogoPreview ? (
                  <img 
                    src={editLogoPreview} 
                    alt="Logo preview" 
                    className="h-20 w-20 rounded-lg object-cover border border-border"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center border border-dashed border-border">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoSelect(e, true)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {editLogoPreview ? t.changeLogo : t.uploadLogo}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.maxLogoSize}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">{t.companyName} *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                required
                placeholder={t.enterCompanyName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name-en">{t.companyNameEn}</Label>
              <Input
                id="edit-name-en"
                value={editFormData.name_en}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name_en: e.target.value })
                }
                placeholder={t.enterCompanyNameEn}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t.phone}</Label>
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
                        ) : t.selectCountry;
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
                          <span className="font-medium">{country.name}</span>
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
                {t.enterWithoutCountryCode}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">{tCommon.email}</Label>
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
              <Label htmlFor="edit-address">{t.address}</Label>
              <Input
                id="edit-address"
                value={editFormData.address}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, address: e.target.value })
                }
                placeholder={t.address}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                {tCommon.cancel}
              </Button>
              <Button type="submit" disabled={uploadingLogo}>
                {uploadingLogo ? t.uploadingImage : tCommon.save}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cairo">{t.deleteCompany}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.confirmDeletion}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deletionReason">{t.deletionReason} *</Label>
              <Textarea
                id="deletionReason"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder={t.enterDeletionReason}
                rows={4}
                required
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeletionReason("");
              setCompanyToDelete(null);
            }}>
              {tCommon.cancel}
            </AlertDialogCancel>
            <AlertDialogAction onClick={submitDeletionRequest}>
              {t.requestDeletion}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
