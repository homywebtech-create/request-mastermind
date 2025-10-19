import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Home, FileText, MapPinned, User } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Service icons mapping
const serviceIcons: Record<string, string> = {
  'Cleaning': '🧹',
  'تنظيف': '🧹',
  'Hospitality': '☕',
  'ضيافة': '☕',
  'Home salon': '💇',
  'صالون منزلي': '💇',
  'Home exercise': '🏋️',
  'رياضة منزلية': '🏋️',
  'Caregiver': '👶',
  'رعاية': '👶',
  'Teaching': '👨‍🏫',
  'تعليم': '👨‍🏫',
};

interface CustomerData {
  id: string;
  name: string;
  whatsapp_number: string;
  area: string | null;
}

interface Service {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
}

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const translations = {
    ar: {
      welcome: 'مرحباً',
      howCanWeServe: 'كيف يمكننا خدمتك؟',
      offers: 'العروض',
      bookNow: 'احجز الآن',
      payLater: 'ادفع لاحقاً',
      home: 'الرئيسية',
      orders: 'طلباتي',
      location: 'الموقع',
      profile: 'الحساب',
      perMonth: 'شهرياً',
    },
    en: {
      welcome: 'Welcome',
      howCanWeServe: 'How can we serve you?',
      offers: 'Offers',
      bookNow: 'Book now',
      payLater: 'Pay later',
      home: 'Home',
      orders: 'My Orders',
      location: 'Location',
      profile: 'Profile',
      perMonth: 'Per Month',
    },
  };

  const t = translations[language];

  useEffect(() => {
    fetchCustomerData();
    fetchServices();
  }, []);

  const fetchCustomerData = async () => {
    try {
      // For now, we'll use a placeholder. In production, this would come from authentication
      const phoneNumber = localStorage.getItem('customer_phone');
      
      if (!phoneNumber) {
        // Redirect to login or get phone number
        return;
      }

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('whatsapp_number', phoneNumber)
        .single();

      if (error) throw error;
      setCustomer(data);
    } catch (error) {
      console.error('Error fetching customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, name_en, description')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleServiceClick = (service: Service) => {
    // Navigate to booking page or show service details
    toast({
      title: language === 'ar' ? service.name : (service.name_en || service.name),
      description: language === 'ar' ? 'سيتم إضافة صفحة الحجز قريباً' : 'Booking page coming soon',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 px-6 py-8 border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              {t.welcome} {customer?.name || ''}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{customer?.area || 'doha qatar'}</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-lg font-semibold"
            onClick={() => {/* Language toggle */}}
          >
            {language === 'ar' ? 'English' : 'عربي'}
          </Button>
        </div>
      </div>

      {/* Services Section */}
      <div className="px-6 py-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t.howCanWeServe}
        </h2>
        
        <div className="grid grid-cols-2 gap-3">
          {services.slice(0, 6).map((service) => {
            const serviceName = language === 'ar' ? service.name : (service.name_en || service.name);
            const icon = serviceIcons[serviceName] || serviceIcons[service.name] || '🔧';
            
            return (
              <Card 
                key={service.id}
                className="cursor-pointer hover:shadow-md transition-all hover:scale-105 border-2"
                onClick={() => handleServiceClick(service)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="text-4xl">{icon}</div>
                  <div className="text-sm font-semibold text-foreground">
                    {serviceName}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Offers Section */}
      <div className="px-6 py-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t.offers}
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Offer Card 1 */}
          <Card className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
            <div className="relative h-48 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-blue-900">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-6xl">🧹</div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 to-transparent p-4">
                <div className="text-white text-sm font-semibold mb-1">
                  {language === 'ar' ? '1500 - 2500 ريال شهرياً' : '1500 - 2500 QR Per Month'}
                </div>
              </div>
            </div>
            <CardContent className="p-0">
              <Button className="w-full rounded-none bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-bold">
                {t.bookNow}
                <br />
                {t.payLater}
              </Button>
            </CardContent>
          </Card>

          {/* Offer Card 2 */}
          <Card className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
            <div className="relative h-48 bg-gradient-to-br from-pink-100 to-pink-50 dark:from-pink-950 dark:to-pink-900">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-6xl">💰</div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-pink-600 to-transparent p-4">
                <div className="text-white text-sm font-semibold mb-1">
                  {language === 'ar' ? '1500 - 2500 ريال شهرياً' : '1500 - 2500 QR Per Month'}
                </div>
              </div>
            </div>
            <CardContent className="p-0">
              <Button className="w-full rounded-none bg-pink-600 hover:bg-pink-700 text-white h-14 text-lg font-bold">
                {language === 'ar' ? 'تسعير ثابت' : 'Price starts'}
                <br />
                {language === 'ar' ? '10 الى 20' : '10 To 20'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg">
        <div className="grid grid-cols-4 gap-2 px-4 py-2">
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-3 bg-primary/10 hover:bg-primary/20"
            onClick={() => navigate('/customer-portal')}
          >
            <Home className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium text-primary">{t.home}</span>
          </Button>
          
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-muted"
            onClick={() => {/* Navigate to orders */}}
          >
            <FileText className="h-5 w-5" />
            <span className="text-xs">{t.orders}</span>
          </Button>
          
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-muted"
            onClick={() => {/* Navigate to location */}}
          >
            <MapPinned className="h-5 w-5" />
            <span className="text-xs">{t.location}</span>
          </Button>
          
          <Button
            variant="ghost"
            className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-muted"
            onClick={() => {/* Navigate to profile */}}
          >
            <User className="h-5 w-5" />
            <span className="text-xs">{t.profile}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
