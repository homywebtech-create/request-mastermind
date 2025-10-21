import { useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = useTranslation(language);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
        },
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: language === 'ar' ? "تم إرسال الرابط ✉️" : "Link Sent ✉️",
        description: language === 'ar' 
          ? "تحقق من بريدك الإلكتروني للحصول على رابط تسجيل الدخول السحري" 
          : "Check your email for the magic link to sign in",
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
            {emailSent 
              ? (language === 'ar' 
                  ? '✉️ تم إرسال رابط تسجيل الدخول إلى بريدك الإلكتروني'
                  : '✉️ Magic link sent to your email')
              : (language === 'ar'
                  ? 'أدخل بريدك الإلكتروني للحصول على رابط تسجيل دخول سحري'
                  : 'Enter your email to receive a magic login link')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === 'ar'
                    ? 'تحقق من صندوق البريد الوارد في'
                    : 'Check your inbox at'}
                </p>
                <p className="font-semibold text-primary">{email}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                {language === 'ar'
                  ? 'انقر على الرابط في البريد الإلكتروني لتسجيل الدخول'
                  : 'Click the link in the email to sign in'}
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setEmailSent(false);
                  setEmail("");
                }}
              >
                {language === 'ar' ? 'إرسال رابط جديد' : 'Send Another Link'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkLogin} className="space-y-4">
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
                  : (language === 'ar' ? '🔗 إرسال رابط الدخول' : '🔗 Send Magic Link')
                }
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {language === 'ar'
                  ? '💡 لا حاجة لكلمة مرور - سنرسل لك رابط تسجيل دخول آمن'
                  : '💡 No password needed - we\'ll send you a secure login link'}
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
