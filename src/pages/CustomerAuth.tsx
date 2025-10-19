import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { Phone, User } from 'lucide-react';

export default function CustomerAuth() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const translations = {
    ar: {
      welcome: 'مرحباً بك',
      subtitle: 'سجل دخولك للاستمتاع بخدماتنا',
      phoneNumber: 'رقم الواتساب',
      phonePlaceholder: '971501234567',
      name: 'الاسم الكامل',
      namePlaceholder: 'محمد إبراهيم',
      continue: 'متابعة',
      enterPhone: 'يرجى إدخال رقم الواتساب',
      enterName: 'يرجى إدخال الاسم',
      invalidPhone: 'رقم الهاتف غير صحيح',
      error: 'خطأ',
      success: 'تم بنجاح',
      loggedIn: 'تم تسجيل الدخول بنجاح',
    },
    en: {
      welcome: 'Welcome',
      subtitle: 'Login to enjoy our services',
      phoneNumber: 'WhatsApp Number',
      phonePlaceholder: '971501234567',
      name: 'Full Name',
      namePlaceholder: 'Mohammed Ibrahim',
      continue: 'Continue',
      enterPhone: 'Please enter WhatsApp number',
      enterName: 'Please enter your name',
      invalidPhone: 'Invalid phone number',
      error: 'Error',
      success: 'Success',
      loggedIn: 'Logged in successfully',
    },
  };

  const t = translations[language];

  useEffect(() => {
    // Check if customer is already logged in
    const savedPhone = localStorage.getItem('customer_phone');
    if (savedPhone) {
      navigate('/customer-portal');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({
        title: t.error,
        description: t.enterPhone,
        variant: 'destructive',
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: t.error,
        description: t.enterName,
        variant: 'destructive',
      });
      return;
    }

    // Basic phone validation
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
      toast({
        title: t.error,
        description: t.invalidPhone,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Check if customer exists
      const { data: existingCustomer, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('whatsapp_number', phoneNumber)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (!existingCustomer) {
        // Create new customer
        const { error: insertError } = await supabase
          .from('customers')
          .insert({
            name: name,
            whatsapp_number: phoneNumber,
          });

        if (insertError) throw insertError;
      } else {
        // Update name if changed
        if (existingCustomer.name !== name) {
          const { error: updateError } = await supabase
            .from('customers')
            .update({ name: name })
            .eq('whatsapp_number', phoneNumber);

          if (updateError) throw updateError;
        }
      }

      // Save to localStorage
      localStorage.setItem('customer_phone', phoneNumber);
      localStorage.setItem('customer_name', name);

      toast({
        title: t.success,
        description: t.loggedIn,
      });

      // Navigate to customer portal
      navigate('/customer-portal');
    } catch (error: any) {
      console.error('Error:', error);
      toast({
        title: t.error,
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <Card className="w-full max-w-md shadow-xl border-2">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <User className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">{t.welcome}</CardTitle>
          <p className="text-muted-foreground">{t.subtitle}</p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base font-semibold">
                {t.phoneNumber}
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  className="pl-10 h-12 text-lg"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">
                {t.name}
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="pl-10 h-12 text-lg"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-semibold"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</span>
                </div>
              ) : (
                t.continue
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
