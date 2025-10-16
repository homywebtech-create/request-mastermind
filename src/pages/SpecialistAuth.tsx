import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, ArrowRight, CheckCircle } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "@/data/countries";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

export default function SpecialistAuth() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [countryCode, setCountryCode] = useState('+974');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useTranslation(language);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('✅ Existing session found, redirecting to dashboard');
          
          // Verify the user is a specialist
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone')
            .eq('user_id', session.user.id)
            .single();

          if (profile?.phone) {
            const { data: specialist } = await supabase
              .from('specialists')
              .select('id, is_active')
              .eq('phone', profile.phone)
              .single();

            if (specialist?.is_active) {
              // Redirect to specialist dashboard
              navigate('/specialist-orders', { replace: true });
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkExistingSession();
  }, [navigate]);

  const getFullPhoneNumber = () => {
    // Normalize to E.164: ensure +CC and strip leading 0s from national number (e.g., PK 03xx -> +923xx)
    const cc = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    const nn = phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
    return `${cc}${nn}`;
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      toast({
        title: t.common.error,
        description: "Please enter phone number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = getFullPhoneNumber();

      const { data: specialist, error: specialistError } = await supabase
        .from('specialists')
        .select('id, name, is_active, suspension_type, suspension_end_date')
        .eq('phone', fullPhone)
        .maybeSingle();

      if (specialistError || !specialist) {
        toast({
          title: t.common.error,
          description: "No registered worker found with this number or account is inactive",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check if specialist is suspended
      if (specialist.suspension_type === 'permanent') {
        toast({
          title: "حساب موقوف / Account Suspended",
          description: "تم إيقاف حسابك نهائياً. يرجى التواصل مع الإدارة / Your account has been permanently suspended. Please contact administration",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (specialist.suspension_type === 'temporary' && specialist.suspension_end_date) {
        const endDate = new Date(specialist.suspension_end_date);
        if (endDate > new Date()) {
          toast({
            title: "حساب موقوف مؤقتاً / Account Temporarily Suspended",
            description: `حسابك موقوف حتى ${endDate.toLocaleDateString('ar')} / Your account is suspended until ${endDate.toLocaleDateString()}`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      if (!specialist.is_active) {
        toast({
          title: t.common.error,
          description: "حسابك غير نشط. يرجى التواصل مع الإدارة / Your account is inactive. Please contact administration",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('request-verification-code', {
        body: { phone: fullPhone }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: t.common.error,
          description: data.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Code Sent",
        description: `Verification code sent to ${fullPhone}`,
      });

      // AUTO-FILL في بيئة التطوير
      if (data?.devMode && data?.code) {
        // ملء الكود تلقائياً
        setVerificationCode(data.code);
        
        toast({
          title: "🚀 وضع التطوير - الكود تم ملؤه تلقائياً",
          description: (
            <div className="space-y-2">
              <p className="text-2xl font-bold text-center">{data.code}</p>
              <p className="text-xs">✅ تم ملء الكود تلقائياً. اضغط تسجيل الدخول</p>
            </div>
          ),
          duration: 5000,
        });
      }

      setStep('code');
    } catch (error: any) {
      console.error('Error sending code:', error);
      toast({
        title: t.common.error,
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: t.common.error,
        description: "Please enter the 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = getFullPhoneNumber();

      const { data, error } = await supabase.functions.invoke('verify-specialist-code', {
        body: { 
          phone: fullPhone,
          code: verificationCode
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: t.common.error,
          description: data.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!data?.credentials) {
        toast({
          title: t.common.error,
          description: "Failed to get login credentials",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.credentials.email,
        password: data.credentials.password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        toast({
          title: t.common.error,
          description: "Login failed",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Wait for session to be fully established
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No session after login');
        toast({
          title: t.common.error,
          description: "Session initialization failed",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Logged in",
        description: `Welcome ${data.specialist.name}`,
      });

      // Initialize Firebase Push Notifications
      try {
        const { firebaseNotifications } = await import('@/lib/firebaseNotifications');
        await firebaseNotifications.initialize(data.specialist.id);
        console.log('✅ [FCM] Firebase notifications initialized for specialist:', data.specialist.id);
      } catch (fcmError) {
        console.error('⚠️ [FCM] Failed to initialize notifications:', fcmError);
        // Continue anyway - non-critical
      }

      // Check if there's a pending route from notification
      console.log("✅ Login successful - checking for pending route");
      
      const { Preferences } = await import('@capacitor/preferences');
      const { value: postLoginRoute } = await Preferences.get({ key: 'postLoginRoute' });
      
      if (postLoginRoute) {
        console.log("📍 Navigating to pending route:", postLoginRoute);
        await Preferences.remove({ key: 'postLoginRoute' });
        navigate(postLoginRoute, { replace: true });
      } else {
        console.log("📍 Navigating to default orders page");
        navigate('/specialist-orders', { replace: true });
      }
    } catch (error: any) {
      console.error('Error verifying code:', error);
      toast({
        title: t.common.error,
        description: error.message || "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Specialist Login</h1>
          <p className="text-muted-foreground">
            {step === 'phone' 
              ? "Enter your registered phone number"
              : "Enter the verification code sent to your phone"
            }
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.dialCode}>
                      {country.flag} {country.name} ({country.dialCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="5xxxxxxxx"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 text-left"
                  dir="ltr"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              onClick={handleSendCode}
              disabled={isLoading || !phoneNumber}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                "Sending..."
              ) : (
                <>
                  Send Verification Code
                  <ArrowRight className="mr-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-center block">
                Verification Code
              </Label>
              <div className="flex justify-center" dir="ltr">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={setVerificationCode}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button
              onClick={handleVerifyCode}
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                "Verifying..."
              ) : (
                <>
                  Login
                  <CheckCircle className="mr-2 h-5 w-5" />
                </>
              )}
            </Button>

            <Button
              onClick={() => {
                setStep('phone');
                setVerificationCode('');
              }}
              variant="ghost"
              className="w-full"
              disabled={isLoading}
            >
              {t.common.back}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
