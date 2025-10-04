import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { countries } from "@/data/countries";
import { useNavigate } from "react-router-dom";
import { Building2, Phone, Shield } from "lucide-react";

export default function CompanyAuth() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [countryCode, setCountryCode] = useState("QA");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getFullPhoneNumber = () => {
    const selectedCountry = countries.find(c => c.code === countryCode);
    return `${selectedCountry?.dialCode}${phoneNumber}`;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const fullPhone = getFullPhoneNumber();
      
      // تنظيف الرقم من أي مسافات أو أحرف غير مرغوبة
      const cleanPhone = fullPhone.replace(/\s+/g, '');
      
      console.log("البحث عن الشركة برقم:", cleanPhone);

      // التحقق من أن رقم الهاتف ينتمي لشركة مسجلة
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id, name, phone")
        .eq("phone", cleanPhone)
        .eq("is_active", true)
        .maybeSingle();

      console.log("نتيجة البحث:", company);

      if (companyError) {
        console.error("خطأ في البحث:", companyError);
        throw companyError;
      }

      if (!company) {
        // محاولة البحث بدون كود الدولة في حال كان الرقم مخزن بصيغة مختلفة
        const { data: allCompanies } = await supabase
          .from("companies")
          .select("id, name, phone")
          .eq("is_active", true);
        
        console.log("جميع الشركات النشطة:", allCompanies);
        
        toast({
          title: "خطأ",
          description: `رقم الهاتف غير مسجل لأي شركة. الرقم المدخل: ${cleanPhone}`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // إرسال كود التفعيل
      const { error } = await supabase.functions.invoke("request-verification-code", {
        body: { phone: cleanPhone },
      });

      if (error) throw error;

      toast({
        title: "تم إرسال الكود",
        description: "تم إرسال كود التفعيل إلى رقم الواتساب الخاص بك",
      });

      setStep("code");
    } catch (error: any) {
      console.error("Error sending code:", error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء إرسال كود التفعيل",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const fullPhone = getFullPhoneNumber();

      // التحقق من الكود
      const { data: verification, error: verifyError } = await supabase
        .from("verification_codes")
        .select("*")
        .eq("phone", fullPhone)
        .eq("code", verificationCode)
        .eq("verified", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (verifyError) throw verifyError;

      if (!verification) {
        toast({
          title: "خطأ",
          description: "كود التفعيل غير صحيح أو منتهي الصلاحية",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // تحديث حالة التفعيل
      await supabase
        .from("verification_codes")
        .update({ verified: true })
        .eq("id", verification.id);

      // الحصول على معلومات الشركة
      const { data: company } = await supabase
        .from("companies")
        .select("id, name")
        .eq("phone", fullPhone)
        .single();

      if (!company) throw new Error("الشركة غير موجودة");

      // التحقق من وجود مستخدم مرتبط بهذه الشركة
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("company_id", company.id)
        .eq("phone", fullPhone)
        .maybeSingle();

      if (!profile) {
        // إنشاء مستخدم جديد للشركة
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          phone: fullPhone,
          password: `${fullPhone}_${Date.now()}`, // كلمة مرور مؤقتة
          options: {
            data: {
              full_name: company.name,
              phone: fullPhone,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          // تحديث البروفايل لربطه بالشركة
          await supabase
            .from("profiles")
            .update({ company_id: company.id })
            .eq("user_id", authData.user.id);
        }
      } else {
        // تسجيل دخول المستخدم الموجود
        const { error: signInError } = await supabase.auth.signInWithPassword({
          phone: fullPhone,
          password: `${fullPhone}_${Date.now()}`,
        });

        // إذا فشل تسجيل الدخول، نستخدم OTP
        if (signInError) {
          const { error: otpError } = await supabase.auth.signInWithOtp({
            phone: fullPhone,
          });
          if (otpError) throw otpError;
        }
      }

      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: `مرحباً بك في صفحة ${company.name}`,
      });

      // توجيه المستخدم إلى صفحة الشركة
      navigate("/company-portal");
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء التحقق من الكود",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Building2 className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">تسجيل دخول الشركة</CardTitle>
          <CardDescription>
            {step === "phone"
              ? "أدخل رقم هاتف الشركة المسجل"
              : "أدخل كود التفعيل المرسل إلى واتساب"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="countryCode">الدولة</Label>
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger>
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
                      <SelectItem key={country.code} value={country.code}>
                        <span className="flex items-center gap-2">
                          <span className="text-xl">{country.flag}</span>
                          <span className="font-medium">{country.nameAr}</span>
                          <span className="text-muted-foreground text-sm">{country.dialCode}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">رقم الهاتف</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="501234567"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "جاري الإرسال..." : "إرسال كود التفعيل"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">كود التفعيل</Label>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <Input
                    id="verificationCode"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "جاري التحقق..." : "تحقق وتسجيل الدخول"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("phone")}
                >
                  رجوع
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
