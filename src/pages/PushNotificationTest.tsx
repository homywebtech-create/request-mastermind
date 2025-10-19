import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Bell } from "lucide-react";
import { firebaseNotifications } from "@/lib/firebaseNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from '@capacitor/core';

interface TestResult {
  step: string;
  status: "success" | "error" | "pending";
  message: string;
  details?: any;
}

const PushNotificationTest = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  const runFullTest = async () => {
    setTesting(true);
    setResults([]);

    try {
      // Step 1: Check if we're on native
      addResult({
        step: "Platform Check",
        status: "pending",
        message: "Checking if running on native platform..."
      });

      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      
      if (!isNative) {
        addResult({
          step: "Platform Check",
          status: "error",
          message: "Not running on native platform. This test requires a native build.",
          details: { platform, isNative }
        });
        setTesting(false);
        return;
      }

      addResult({
        step: "Platform Check",
        status: "success",
        message: `Running on native platform: ${platform} ✓`
      });

      // Step 2: Get current user/specialist
      addResult({
        step: "User Authentication",
        status: "pending",
        message: "Getting authenticated user..."
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        addResult({
          step: "User Authentication",
          status: "error",
          message: "No authenticated user found",
          details: userError
        });
        setTesting(false);
        return;
      }

      addResult({
        step: "User Authentication",
        status: "success",
        message: `User authenticated: ${user.email}`,
        details: { userId: user.id }
      });

      // Step 3: Get specialist profile
      addResult({
        step: "Specialist Profile",
        status: "pending",
        message: "Fetching specialist profile..."
      });

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        addResult({
          step: "Specialist Profile",
          status: "error",
          message: "No profile found for this user",
          details: profileError
        });
        setTesting(false);
        return;
      }

      // Now get the specialist using the phone number
      const { data: specialist, error: specialistError } = await supabase
        .from('specialists')
        .select('id, name, phone')
        .eq('phone', profile.phone)
        .single();

      if (specialistError || !specialist) {
        addResult({
          step: "Specialist Profile",
          status: "error",
          message: "No specialist profile found for this phone number",
          details: specialistError
        });
        setTesting(false);
        return;
      }

      addResult({
        step: "Specialist Profile",
        status: "success",
        message: `Specialist found: ${specialist.name}`,
        details: { specialistId: specialist.id }
      });

      // Step 4: Initialize Firebase
      addResult({
        step: "Firebase Initialization",
        status: "pending",
        message: "Initializing Firebase notifications..."
      });

      try {
        await firebaseNotifications.initialize(specialist.id);
        addResult({
          step: "Firebase Initialization",
          status: "success",
          message: "Firebase initialized successfully ✓"
        });
      } catch (initError: any) {
        addResult({
          step: "Firebase Initialization",
          status: "error",
          message: `Firebase initialization failed: ${initError.message}`,
          details: initError
        });
        setTesting(false);
        return;
      }

      // Step 5: Get device token
      addResult({
        step: "Device Token",
        status: "pending",
        message: "Retrieving device token from database..."
      });

      const { data: deviceToken, error: tokenError } = await supabase
        .from('device_tokens')
        .select('token, platform, created_at, last_used_at')
        .eq('specialist_id', specialist.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (tokenError || !deviceToken) {
        addResult({
          step: "Device Token",
          status: "error",
          message: "No device token found in database",
          details: tokenError
        });
        setTesting(false);
        return;
      }

      addResult({
        step: "Device Token",
        status: "success",
        message: `Token found (${deviceToken.platform})`,
        details: {
          tokenPreview: `${deviceToken.token.substring(0, 30)}...`,
          platform: deviceToken.platform,
          lastUsed: deviceToken.last_used_at
        }
      });

      // Step 6: Send test notification
      addResult({
        step: "Send Test Notification",
        status: "pending",
        message: "Sending test push notification via edge function..."
      });

      const { data: sendResult, error: sendError } = await supabase.functions.invoke(
        'send-push-notification',
        {
          body: {
            specialistIds: [specialist.id],
            title: "🧪 Test Notification",
            body: "This is a test push notification from the debug screen",
            data: {
              type: "test",
              orderId: "test-" + Date.now(),
              timestamp: new Date().toISOString()
            }
          }
        }
      );

      if (sendError) {
        addResult({
          step: "Send Test Notification",
          status: "error",
          message: `Failed to send notification: ${sendError.message}`,
          details: sendError
        });
        setTesting(false);
        return;
      }

      addResult({
        step: "Send Test Notification",
        status: "success",
        message: "Notification sent successfully! Check your device.",
        details: sendResult
      });

      toast({
        title: "✅ Test Complete",
        description: "Push notification sent! Check if you received it on your device.",
      });

    } catch (error: any) {
      addResult({
        step: "Unexpected Error",
        status: "error",
        message: error.message || "An unexpected error occurred",
        details: error
      });
      
      toast({
        title: "❌ Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "pending":
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Push Notification Test Suite
          </CardTitle>
          <CardDescription>
            Test the complete push notification flow from token registration to message delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              This test will verify FCM token registration, database storage, and send a test notification.
              Make sure you're running this on a physical device with the native app.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={runFullTest} 
            disabled={testing}
            className="w-full"
            size="lg"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Run Full Test
              </>
            )}
          </Button>

          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Test Results:</h3>
              {results.map((result, index) => (
                <Card key={index} className={
                  result.status === "error" ? "border-red-300 bg-red-50" :
                  result.status === "success" ? "border-green-300 bg-green-50" :
                  "border-blue-300 bg-blue-50"
                }>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(result.status)}
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold">{result.step}</p>
                        <p className="text-sm">{result.message}</p>
                        {result.details && (
                          <details className="text-xs mt-2">
                            <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                              View Details
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!testing && results.length > 0 && (
            <Alert className={
              results.some(r => r.status === "error") 
                ? "border-red-300 bg-red-50" 
                : "border-green-300 bg-green-50"
            }>
              <AlertDescription>
                {results.some(r => r.status === "error") 
                  ? "❌ Test completed with errors. Review the results above for details."
                  : "✅ All tests passed! If you didn't receive a notification, check device settings (Do Not Disturb, notification permissions, battery optimization)."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PushNotificationTest;
