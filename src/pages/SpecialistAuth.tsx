import { useState } from "react";
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
import { translations } from "@/i18n/translations";

const t = translations.auth;

export default function SpecialistAuth() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [countryCode, setCountryCode] = useState('+974');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const getFullPhoneNumber = () => {
    // Normalize to E.164: ensure +CC and strip leading 0s from national number (e.g., PK 03xx -> +923xx)
    const cc = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    const nn = phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
    return `${cc}${nn}`;
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      toast({
        title: t.error,
        description: t.pleaseEnterPhone,
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
          title: t.error,
          description: t.specialistNotFound,
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
          title: t.error,
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
          title: t.error,
          description: data.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: t.codeSent,
        description: `${t.verificationCodeSent} ${fullPhone}`,
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
        title: t.error,
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
        title: t.error,
        description: t.pleaseEnter6Digits,
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
          title: t.error,
          description: data.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!data?.credentials) {
        toast({
          title: t.error,
          description: t.failedToGetCredentials,
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
          title: t.error,
          description: t.loginFailed,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: t.loggedIn,
        description: `${t.welcome} ${data.specialist.name}`,
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

      // Use replace instead of push to prevent back button from returning to auth
      navigate('/specialist-orders', { replace: true });
    } catch (error: any) {
      console.error('Error verifying code:', error);
      toast({
        title: t.error,
        description: error.message || "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">{t.specialistLoginTitle}</h1>
          <p className="text-muted-foreground">
            {step === 'phone' 
              ? t.enterRegisteredPhoneSpecialist
              : t.enterCodeSentSpecialist
            }
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="country">{t.countryLabel}</Label>
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
              <Label htmlFor="phone">{t.phoneNumberLabel}</Label>
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
                t.sendingVerification
              ) : (
                <>
                  {t.sendVerificationCodeButton}
                  <ArrowRight className="mr-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-center block">
                {t.verificationCodeLabel}
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
                t.verifyingCode
              ) : (
                <>
                  {t.loginButtonSpecialist}
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
              {t.backButton}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
