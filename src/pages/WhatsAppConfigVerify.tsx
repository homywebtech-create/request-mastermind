import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function WhatsAppConfigVerify() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleVerify = async () => {
    try {
      setLoading(true);
      setResult(null);

      const response = await supabase.functions.invoke('verify-whatsapp-config');

      // Edge function returns detailed info in data even on failure (400 status)
      if (response.data) {
        setResult(response.data);
      } else if (response.error) {
        // Try to parse error context if it contains JSON
        try {
          const errorContext = response.error.context;
          if (errorContext && typeof errorContext === 'object') {
            setResult(errorContext);
          } else {
            setResult({ success: false, error: response.error.message });
          }
        } catch {
          setResult({ success: false, error: response.error.message });
        }
      }
    } catch (error: any) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>WhatsApp Configuration Verifier</CardTitle>
          </div>
          <CardDescription>
            Verify your WhatsApp Business API credentials and Phone Number ID
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleVerify} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Verify Configuration
              </>
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-semibold">
                        {result.success ? "✅ Configuration Valid" : "❌ Configuration Invalid"}
                      </div>
                      
                      {result.message && (
                        <div className="text-sm">{result.message}</div>
                      )}

                      {result.phoneNumberId && (
                        <div className="text-sm">
                          <strong>Phone Number ID:</strong> {result.phoneNumberId}
                        </div>
                      )}

                      {result.phoneNumberDetails && (
                        <div className="text-sm">
                          <strong>Details:</strong>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(result.phoneNumberDetails, null, 2)}
                          </pre>
                        </div>
                      )}

                      {result.error && (
                        <div className="text-sm">
                          <strong>Error:</strong> {result.error}
                        </div>
                      )}

                      {result.metaError && (
                        <div className="text-sm">
                          <strong>Meta API Error:</strong>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                            {JSON.stringify(result.metaError, null, 2)}
                          </pre>
                        </div>
                      )}

                      {result.possibleIssues && (
                        <div className="text-sm mt-4">
                          <strong>Possible Issues:</strong>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            {result.possibleIssues.map((issue: string, idx: number) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {!result.success && (
                        <div className="mt-4 p-3 bg-muted rounded text-sm">
                          <strong>How to fix:</strong>
                          <ol className="list-decimal list-inside mt-2 space-y-2">
                            <li>Go to Meta Business Suite → WhatsApp Manager</li>
                            <li>Copy the correct Phone Number ID from your WhatsApp phone number</li>
                            <li>Generate a new Access Token with "whatsapp_business_messaging" permission</li>
                            <li>Make sure both belong to the same WhatsApp Business Account</li>
                            <li>Update your secrets in Lovable Cloud</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="space-y-3 text-sm">
                <div>
                  <strong>What this checks:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 ml-2">
                    <li>Whether your Access Token is valid</li>
                    <li>Whether your Phone Number ID exists</li>
                    <li>Whether your Access Token can access this Phone Number</li>
                    <li>Whether they belong to the same WhatsApp Business Account</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
