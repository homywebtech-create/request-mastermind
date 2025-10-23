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
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

export default function CompanyAuth() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = useTranslation(language);
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
      const cleanPhone = fullPhone.replace(/\s+/g, '').trim();
      
      console.log("=== Login Diagnosis ===");
      console.log("1. Selected country code:", countryCode);
      console.log("2. Entered number:", phoneNumber);
      console.log("3. Full number after merge:", cleanPhone);

      // البحث في جدول الشركات أولاً
      const { data: allCompanies, error: fetchError } = await supabase
        .from("companies")
        .select("id, name, phone")
        .eq("is_active", true);

      if (fetchError) {
        console.error("Error fetching companies:", fetchError);
        throw fetchError;
      }

      console.log("4. All registered company numbers:", allCompanies?.map(c => c.phone));

      let company = allCompanies?.find(c => c.phone === cleanPhone);

      if (!company) {
        const phoneWithoutPlus = cleanPhone.replace('+', '');
        company = allCompanies?.find(c => c.phone?.replace('+', '') === phoneWithoutPlus);
        console.log("5. Trying search without + sign:", phoneWithoutPlus);
      }

      // إذا لم يتم العثور على الشركة، ابحث في company_users (الآن يمكن للجميع القراءة)
      if (!company) {
        console.log("6. Not found in companies, searching company_users...");
        
        const { data: allCompanyUsers, error: usersError } = await supabase
          .from("company_users")
          .select(`
            id,
            phone,
            full_name,
            is_active,
            company_id,
            companies (
              id,
              name,
              is_active
            )
          `)
          .eq("is_active", true);

        console.log("7. Query error:", usersError);
        console.log("7. All company users count:", allCompanyUsers?.length);

        if (!usersError && allCompanyUsers) {
          console.log("7. All company user numbers:", allCompanyUsers.map(u => u.phone));
          
          // فلتر الشركات النشطة فقط
          const activeUsers = allCompanyUsers.filter(u => u.companies?.is_active === true);
          console.log("8. Active company users count:", activeUsers.length);
          
          // جرب البحث المباشر أولاً
          let companyUser = activeUsers.find(u => u.phone === cleanPhone);
          
          // إذا لم ينجح، جرب بدون علامة +
          if (!companyUser) {
            const phoneWithoutPlus = cleanPhone.replace('+', '');
            companyUser = activeUsers.find(u => u.phone?.replace(/\+/g, '') === phoneWithoutPlus);
            console.log("9. Trying company user search without + sign:", phoneWithoutPlus);
          }

          if (companyUser && companyUser.companies) {
            company = {
              id: companyUser.companies.id,
              name: companyUser.companies.name,
              phone: cleanPhone
            };
            console.log("10. Company user found:", companyUser.full_name, "for company:", company.name);
          }
        }
      }

      console.log("11. Final company:", company);

      if (!company) {
        toast({
          title: "Login Error",
          description: (
            <div className="space-y-2">
              <p>Phone number is not registered for any company</p>
              <p className="text-xs">Entered number: {cleanPhone}</p>
              <p className="text-xs">Make sure to select the correct country and enter the number as registered</p>
            </div>
          ),
          variant: "destructive",
          duration: 8000,
        });
        setIsLoading(false);
        return;
      }

      console.log("12. Company found:", company.name);


      const { data, error } = await supabase.functions.invoke("request-verification-code", {
        body: { phone: company.phone },
      });

      if (error) throw error;

      if (data?.devMode && data?.code) {
        // AUTO-FILL في بيئة التطوير
        setVerificationCode(data.code);
        
        toast({
          title: language === 'ar' ? "🚀 وضع التطوير - الكود المرسل" : "🚀 Dev Mode - Code Sent",
          description: (
            <div className="space-y-2">
              <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary">
                <p className="text-3xl font-bold text-center tracking-wider">{data.code}</p>
              </div>
              <p className="text-sm font-medium">
                {language === 'ar' 
                  ? `✅ تم إرسال الكود إلى شركة ${company.name}`
                  : `✅ Code sent to company ${company.name}`
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' 
                  ? "الكود تم ملؤه تلقائياً. اضغط 'تحقق وتسجيل الدخول'"
                  : "Code auto-filled. Click 'Verify and Login'"}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'صالح لمدة 10 دقائق' : 'Valid for 10 minutes'}
              </p>
            </div>
          ),
          duration: 8000,
        });
      } else {
        toast({
          title: language === 'ar' ? "✅ تم إرسال الكود" : "✅ Code Sent",
          description: language === 'ar'
            ? `تم إرسال كود التحقق إلى شركة ${company.name}`
            : `Verification code sent to company ${company.name}`,
          duration: 5000,
        });
      }

      setStep("code");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: t.common.error,
        description: error.message || "Error sending verification code",
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

      console.log("=== Calling verification function ===");
      console.log("1. Number:", fullPhone);
      console.log("2. Code:", verificationCode);

      const { data, error } = await supabase.functions.invoke("verify-company-code", {
        body: { 
          phone: fullPhone, 
          code: verificationCode 
        },
      });

      console.log("3. Verification result:", data);
      console.log("4. Verification error:", error);

      if (error) {
        throw new Error(error.message || "Verification failed");
      }

      if (!data || !data.success) {
        throw new Error(data?.error || "Verification code is incorrect");
      }

      console.log("5. Verification successful, logging in...");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.credentials.email,
        password: data.credentials.password,
      });

      if (signInError) {
        console.error("Login error:", signInError);
        throw new Error("Login failed");
      }

      toast({
        title: "Login successful",
        description: `Welcome to ${data.company.name}`,
      });

      navigate("/company-portal");
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast({
        title: t.common.error,
        description: error.message || "Error verifying code",
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
          <CardTitle className="text-2xl">Company Login</CardTitle>
          <CardDescription>
            {step === "phone"
              ? "Enter your registered company phone number"
              : "Enter the verification code sent to WhatsApp"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country</Label>
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
                        ) : "Select";
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <span className="flex items-center gap-2">
                          <span className="text-xl">{country.flag}</span>
                          <span className="font-medium">{country.name}</span>
                          <span className="text-muted-foreground text-sm">{country.dialCode}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
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
                {isLoading ? "Sending..." : "Send Verification Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
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
                  {isLoading ? "Verifying..." : "Verify and Login"}
                </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("phone")}
            >
              Back
            </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
