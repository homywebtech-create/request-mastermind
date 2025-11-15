import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

const WhatsAppCatalogSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  const handleDiagnostic = async () => {
    setDiagnosing(true);
    setDiagnosticResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('diagnose-catalog-permissions', {
        body: {}
      });

      if (error) {
        console.error('Diagnostic error:', error);
        toast.error('Failed to run diagnostics');
        setDiagnosticResult({ error: error.message });
        return;
      }

      console.log('Diagnostic result:', data);
      setDiagnosticResult(data);

      if (data.canAccess) {
        toast.success('Catalog permissions verified!');
      } else {
        toast.error('Permission issues detected');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An unexpected error occurred');
      setDiagnosticResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setDiagnosing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-specialists-to-catalog', {
        body: {}
      });

      if (error) {
        console.error('Sync error:', error);
        toast.error('Failed to sync specialists');
        setResult({ error: error.message });
        return;
      }

      console.log('Sync result:', data);
      setResult(data);

      if (data.success) {
        toast.success(data.message || 'Specialists synced successfully!');
      } else {
        toast.error('Sync completed with errors');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An unexpected error occurred');
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6" />
            WhatsApp Catalog Sync
          </CardTitle>
          <CardDescription>
            Sync your specialists to Meta Catalog for WhatsApp carousel messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              This will sync all active, approved specialists to your Meta Catalog. 
              Each specialist will be added as a product with their details, services, and ratings.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertDescription>
              <strong>Permissions Error Detected</strong><br/>
              Your access token needs <code>catalog_management</code> permission. Follow these steps:
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Go to <strong>Meta Business Settings</strong> → <strong>System Users</strong></li>
                <li>Find your System User and click <strong>Assign Assets</strong></li>
                <li>Under <strong>Catalogs</strong>, select catalog <code>1250616650448589</code></li>
                <li>Enable <strong>Manage Catalog</strong> permission</li>
                <li>Generate a new access token and update <code>WHATSAPP_ACCESS_TOKEN</code> secret</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <Button
              onClick={handleDiagnostic}
              disabled={diagnosing}
              variant="outline"
              className="w-full"
            >
              {diagnosing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Permissions...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verify Catalog Permissions
                </>
              )}
            </Button>

            {diagnosticResult && (
              <Card className="border-2">
                <CardContent className="pt-4">
                  {diagnosticResult.error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{diagnosticResult.error}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 ${diagnosticResult.canAccess ? 'text-green-600' : 'text-red-600'}`}>
                        {diagnosticResult.canAccess ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <XCircle className="h-5 w-5" />
                        )}
                        <span className="font-semibold">
                          {diagnosticResult.canAccess ? 'Permissions OK' : 'Permission Denied'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{diagnosticResult.message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">What gets synced:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Specialist name and photo</li>
                <li>Services and specialties</li>
                <li>Experience years and ratings</li>
                <li>Availability status</li>
              </ul>
            </div>

            <Button
              onClick={handleSync}
              disabled={syncing}
              size="lg"
              className="w-full"
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing Specialists...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Specialists to Catalog
                </>
              )}
            </Button>
          </div>

          {result && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {result.error ? (
                    <>
                      <XCircle className="h-5 w-5 text-destructive" />
                      Sync Failed
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Sync Results
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{result.error}</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {result.results?.success || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Successfully Synced</div>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {result.results?.failed || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Failed</div>
                      </div>
                    </div>

                    {result.results?.errors && result.results.errors.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">Errors:</h4>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {result.results.errors.map((err: any, idx: number) => (
                            <Alert key={idx} variant="destructive" className="py-2">
                              <AlertDescription className="text-xs">
                                <strong>{err.name}:</strong> {err.error}
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Note:</strong> After syncing, it may take a few minutes for products to appear in your catalog.</p>
            <p>You can view and manage products in <a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Commerce Manager</a>.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppCatalogSync;
