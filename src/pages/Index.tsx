import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, Shield } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            نظام إدارة الطلبات
          </h1>
          <p className="text-muted-foreground">
            اختر النظام المناسب للدخول
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Specialist Portal */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/specialist-auth')}>
            <CardHeader>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-center">للمتخصصين</CardTitle>
              <CardDescription className="text-center">
                تطبيق استلام وإدارة الطلبات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/specialist-auth')}>
                دخول المتخصصين
              </Button>
            </CardContent>
          </Card>

          {/* Company Portal */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/company-auth')}>
            <CardHeader>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
              <CardTitle className="text-center">للشركات</CardTitle>
              <CardDescription className="text-center">
                بوابة الشركات لإدارة الطلبات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={() => navigate('/company-auth')}>
                دخول الشركات
              </Button>
            </CardContent>
          </Card>

          {/* Admin Portal */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/auth')}>
            <CardHeader>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-orange-500" />
              </div>
              <CardTitle className="text-center">لوحة الإدارة</CardTitle>
              <CardDescription className="text-center">
                إدارة النظام الكاملة
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" onClick={() => navigate('/auth')}>
                دخول الإدارة
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
