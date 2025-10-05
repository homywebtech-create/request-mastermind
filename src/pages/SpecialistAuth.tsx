import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Lock, ArrowRight, CheckCircle } from "lucide-react";
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

export default function SpecialistAuth() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [countryCode, setCountryCode] = useState('+974');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const getFullPhoneNumber = () => {
    return `${countryCode}${phoneNumber}`;
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال رقم الهاتف",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = getFullPhoneNumber();

      // Check if specialist exists and is active
      const { data: specialist, error: specialistError } = await supabase
        .from('specialists')
        .select('id, name, is_active')
        .eq('phone', fullPhone)
        .eq('is_active', true)
        .maybeSingle();

      if (specialistError || !specialist) {
        toast({
          title: "خطأ",
          description: "لم يتم العثور على عامل مسجل بهذا الرقم أو الحساب غير نشط",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Request verification code
      const { data, error } = await supabase.functions.invoke('request-verification-code', {
        body: { phone: fullPhone }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "خطأ",
          description: data.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "تم إرسال الكود",
        description: `تم إرسال كود التحقق إلى ${fullPhone}`,
      });

      // Show code in dev mode
      if (data?.devMode && data?.code) {
        toast({
          title: "كود التحقق (وضع التطوير)",
          description: `الكود: ${data.code}`,
          duration: 10000,
        });
      }

      setStep('code');
    } catch (error: any) {
      console.error('Error sending code:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل إرسال كود التحقق",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال كود التحقق المكون من 6 أرقام",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = getFullPhoneNumber();

      // Verify code and get credentials
      const { data, error } = await supabase.functions.invoke('verify-specialist-code', {
        body: { 
          phone: fullPhone,
          code: verificationCode
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "خطأ",
          description: data.error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!data?.credentials) {
        toast({
          title: "خطأ",
          description: "فشل الحصول على بيانات الدخول",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Sign in with the credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.credentials.email,
        password: data.credentials.password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        toast({
          title: "خطأ",
          description: "فشل تسجيل الدخول",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "تم تسجيل الدخول",
        description: `مرحباً ${data.specialist.name}`,
      });

      navigate('/specialist-orders');
    } catch (error: any) {
      console.error('Error verifying code:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل التحقق من الكود",
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
          <h1 className="text-3xl font-bold">تسجيل دخول العاملات</h1>
          <p className="text-muted-foreground">
            {step === 'phone' 
              ? 'أدخل رقم هاتفك المسجل لدينا'
              : 'أدخل كود التحقق المرسل إلى هاتفك'
            }
          </p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="country">الدولة</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger id="country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.dialCode}>
                      {country.flag} {country.nameAr} ({country.dialCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
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
                "جاري الإرسال..."
              ) : (
                <>
                  إرسال كود التحقق
                  <ArrowRight className="mr-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-center block">
                كود التحقق
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
                "جاري التحقق..."
              ) : (
                <>
                  تسجيل الدخول
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
              رجوع
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
