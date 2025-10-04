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
      const cleanPhone = fullPhone.replace(/\s+/g, '').trim();
      
      console.log("=== تشخيص مشكلة تسجيل الدخول ===");
      console.log("1. كود الدولة المختار:", countryCode);
      console.log("2. الرقم المدخل:", phoneNumber);
      console.log("3. الرقم الكامل بعد الدمج:", cleanPhone);

      // جلب جميع الشركات النشطة للمقارنة
      const { data: allCompanies, error: fetchError } = await supabase
        .from("companies")
        .select("id, name, phone")
        .eq("is_active", true);

      if (fetchError) {
        console.error("خطأ في جلب الشركات:", fetchError);
        throw fetchError;
      }

      console.log("4. جميع أرقام الشركات المسجلة:", allCompanies?.map(c => c.phone));

      // البحث عن تطابق دقيق
      let company = allCompanies?.find(c => c.phone === cleanPhone);

      // إذا لم يجد تطابق دقيق، حاول البحث بدون علامة +
      if (!company) {
        const phoneWithoutPlus = cleanPhone.replace('+', '');
        company = allCompanies?.find(c => c.phone?.replace('+', '') === phoneWithoutPlus);
        console.log("5. محاولة البحث بدون علامة +:", phoneWithoutPlus);
      }

      // إذا لم يجد تطابق، حاول البحث بالرقم فقط (بدون كود الدولة)
      if (!company) {
        company = allCompanies?.find(c => c.phone?.endsWith(phoneNumber));
        console.log("6. محاولة البحث بالرقم فقط:", phoneNumber);
      }

      console.log("7. الشركة الموجودة:", company);

      if (!company) {
        toast({
          title: "خطأ في تسجيل الدخول",
          description: (
            <div className="space-y-2">
              <p>رقم الهاتف غير مسجل لأي شركة</p>
              <p className="text-xs">الرقم المدخل: {cleanPhone}</p>
              <p className="text-xs">تأكد من اختيار الدولة الصحيحة وإدخال الرقم كما هو مسجل</p>
            </div>
          ),
          variant: "destructive",
          duration: 8000,
        });
        setIsLoading(false);
        return;
      }

      console.log("8. تم العثور على الشركة:", company.name);

      // إرسال كود التفعيل
      const { data, error } = await supabase.functions.invoke("request-verification-code", {
        body: { phone: company.phone },
      });

      if (error) throw error;

      // في وضع التطوير، إذا كان الكود موجود في الاستجابة، نعرضه
      if (data?.devMode && data?.code) {
        const copyCode = () => {
          navigator.clipboard.writeText(data.code);
          toast({
            title: "تم النسخ",
            description: "تم نسخ الكود بنجاح",
            duration: 2000,
          });
        };

        toast({
          title: "كود التفعيل (وضع التطوير)",
          description: (
            <div className="space-y-3">
              <p className="text-2xl font-bold text-center">{data.code}</p>
              <Button 
                onClick={copyCode}
                variant="outline" 
                size="sm" 
                className="w-full"
              >
                نسخ الكود
              </Button>
              <p className="text-xs text-muted-foreground">
                هذا الكود للاختبار فقط - في الإنتاج سيتم إرساله عبر واتساب
              </p>
              <p className="text-xs text-muted-foreground">
                صالح لمدة 10 دقائق
              </p>
            </div>
          ),
          duration: 60000, // دقيقة واحدة
        });
      } else {
        toast({
          title: "تم إرسال الكود",
          description: `تم إرسال كود التفعيل لشركة ${company.name}`,
        });
      }

      setStep("code");
    } catch (error: any) {
      console.error("خطأ في تسجيل الدخول:", error);
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

      console.log("=== استدعاء دالة التحقق ===");
      console.log("1. الرقم:", fullPhone);
      console.log("2. الكود:", verificationCode);

      // استدعاء edge function للتحقق
      const { data, error } = await supabase.functions.invoke("verify-company-code", {
        body: { 
          phone: fullPhone, 
          code: verificationCode 
        },
      });

      console.log("3. نتيجة التحقق:", data);
      console.log("4. خطأ التحقق:", error);

      if (error) {
        throw new Error(error.message || "فشل التحقق من الكود");
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "كود التفعيل غير صحيح");
      }

      console.log("5. تم التحقق بنجاح، تسجيل الدخول...");

      // استخدام بيانات الاعتماد المُرجعة لتسجيل الدخول
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.credentials.email,
        password: data.credentials.password,
      });

      if (signInError) {
        console.error("خطأ في تسجيل الدخول:", signInError);
        throw new Error("فشل تسجيل الدخول");
      }

      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: `مرحباً بك في صفحة ${data.company.name}`,
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
