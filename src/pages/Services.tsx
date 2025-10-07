import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Settings, Trash2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { translations } from "@/i18n/translations";

interface Service {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  sub_services?: SubService[];
}

interface SubService {
  id: string;
  service_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

const t = translations.services;
const tCommon = translations.common;

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isSubServiceFormOpen, setIsSubServiceFormOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [serviceFormData, setServiceFormData] = useState({
    name: "",
    description: "",
  });
  const [subServiceFormData, setSubServiceFormData] = useState({
    name: "",
    description: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: false });

    if (servicesError) {
      toast({
        title: tCommon.error,
        description: t.loadError,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { data: subServicesData } = await supabase
      .from("sub_services")
      .select("*");

    const servicesWithSubs = (servicesData || []).map(service => ({
      ...service,
      sub_services: (subServicesData || []).filter(sub => sub.service_id === service.id)
    }));

    setServices(servicesWithSubs);
    setLoading(false);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("services").insert([serviceFormData]);

    if (error) {
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: tCommon.success,
        description: t.serviceAdded,
      });
      setIsServiceFormOpen(false);
      setServiceFormData({ name: "", description: "" });
      fetchServices();
    }
  };

  const handleCreateSubService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    const { error } = await supabase.from("sub_services").insert([{
      ...subServiceFormData,
      service_id: selectedService.id
    }]);

    if (error) {
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: tCommon.success,
        description: t.subServiceAdded,
      });
      setIsSubServiceFormOpen(false);
      setSubServiceFormData({ name: "", description: "" });
      setSelectedService(null);
      fetchServices();
    }
  };

  const handleDeleteSubService = async (subServiceId: string) => {
    if (!confirm(t.confirmDeleteSubService)) return;

    const { error } = await supabase
      .from("sub_services")
      .delete()
      .eq("id", subServiceId);

    if (error) {
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: tCommon.success,
        description: t.subServiceDeleted,
      });
      fetchServices();
    }
  };

  const openSubServiceDialog = (service: Service) => {
    setSelectedService(service);
    setIsSubServiceFormOpen(true);
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
                {t.subtitle}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/admin")}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                {t.backToHome}
              </Button>

              <Dialog open={isServiceFormOpen} onOpenChange={setIsServiceFormOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {t.newService}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-cairo">{t.addService}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateService} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t.serviceName} *</Label>
                      <Input
                        id="name"
                        value={serviceFormData.name}
                        onChange={(e) =>
                          setServiceFormData({ ...serviceFormData, name: e.target.value })
                        }
                        required
                        placeholder={t.enterServiceName}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">{t.description}</Label>
                      <Textarea
                        id="description"
                        value={serviceFormData.description}
                        onChange={(e) =>
                          setServiceFormData({ ...serviceFormData, description: e.target.value })
                        }
                        placeholder={t.enterDescription}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsServiceFormOpen(false)}
                      >
                        {tCommon.cancel}
                      </Button>
                      <Button type="submit">{tCommon.save}</Button>
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
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-cairo">{service.name}</CardTitle>
                    <CardDescription>
                      {service.description || t.noDescription}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openSubServiceDialog(service)}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    {t.sub}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {service.sub_services && service.sub_services.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-2">{t.subServices}:</p>
                    <div className="space-y-2">
                      {service.sub_services.map((subService) => (
                        <div
                          key={subService.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{subService.name}</p>
                            {subService.description && (
                              <p className="text-xs text-muted-foreground">
                                {subService.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteSubService(subService.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.noSubServices}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {services.length === 0 && (
          <div className="text-center py-12">
            <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t.noServicesYet}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t.startAdding}
            </p>
          </div>
        )}
      </main>

      {/* حوار إضافة خدمة فرعية */}
      <Dialog open={isSubServiceFormOpen} onOpenChange={setIsSubServiceFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-cairo">
              {t.addSubServiceFor} {selectedService?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubService} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-name">{t.subServiceName} *</Label>
              <Input
                id="sub-name"
                value={subServiceFormData.name}
                onChange={(e) =>
                  setSubServiceFormData({ ...subServiceFormData, name: e.target.value })
                }
                required
                placeholder={t.enterSubServiceName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-description">{t.description}</Label>
              <Textarea
                id="sub-description"
                value={subServiceFormData.description}
                onChange={(e) =>
                  setSubServiceFormData({ ...subServiceFormData, description: e.target.value })
                }
                placeholder={t.enterSubServiceDescription}
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsSubServiceFormOpen(false);
                  setSelectedService(null);
                }}
              >
                {tCommon.cancel}
              </Button>
              <Button type="submit">{tCommon.save}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
