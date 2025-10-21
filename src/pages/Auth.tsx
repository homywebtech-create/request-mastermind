import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogIn } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useTranslation } from "@/i18n";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/admin');
      }
    };
    
    checkSession();
  }, [navigate]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke('send-admin-otp', {
        body: { email },
      });

      if (error) throw error;

      setCodeSent(true);
      toast({
        title: language === 'ar' ? "تم إرسال الكود ✉️" : "Code Sent ✉️",
        description: language === 'ar' 
          ? "تحقق من بريدك الإلكتروني للحصول على كود تسجيل الدخول" 
          : "Check your email for the login code",
      });
    } catch (error: any) {
      toast({
        title: t.common.error,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-admin-otp', {
        body: { email, code },
      });

      if (error) throw error;

      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        toast({
          title: language === 'ar' ? "تم تسجيل الدخول بنجاح ✅" : "Successfully signed in ✅",
          description: language === 'ar' ? "جاري التوجيه..." : "Redirecting...",
        });

        navigate('/admin');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      toast({
        title: t.common.error,
        description: error.message || (language === 'ar' ? 'كود غير صحيح' : 'Invalid code'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <LogIn className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-cairo">
            {language === 'ar' ? 'تسجيل دخول الأدمن' : 'Admin Login'}
          </CardTitle>
          <CardDescription>
            {codeSent 
              ? (language === 'ar' 
                  ? '✉️ تم إرسال كود التحقق إلى بريدك الإلكتروني'
                  : '✉️ Verification code sent to your email')
              : (language === 'ar'
                  ? 'أدخل بريدك الإلكتروني للحصول على كود تسجيل الدخول'
                  : 'Enter your email to receive a login code')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codeSent ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === 'ar'
                    ? 'تم إرسال الكود إلى'
                    : 'Code sent to'}
                </p>
                <p className="font-semibold text-primary">{email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">
                  {language === 'ar' ? 'كود التحقق' : 'Verification Code'}
                </Label>
                <Input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading 
                  ? t.common.loading 
                  : (language === 'ar' ? '✓ تحقق من الكود' : '✓ Verify Code')
                }
              </Button>

              <Button 
                variant="outline" 
                type="button"
                className="w-full"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                }}
              >
                {language === 'ar' ? 'إرسال كود جديد' : 'Send New Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t.common.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="alnamilat@gmail.com"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading 
                  ? t.common.loading 
                  : (language === 'ar' ? '📧 إرسال كود الدخول' : '📧 Send Login Code')
                }
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {language === 'ar'
                  ? '💡 سنرسل لك كود مكون من 6 أرقام عبر البريد الإلكتروني'
                  : '💡 We\'ll send you a 6-digit code via email'}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
