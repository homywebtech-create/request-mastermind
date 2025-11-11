import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function WhatsAppSetupGuide() {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const steps = [
    {
      title: "Get Your WhatsApp Business Account Details",
      description: "Log into Meta Business Suite and navigate to WhatsApp Manager",
      substeps: [
        "Go to business.facebook.com",
        "Select your Business Account",
        "Click on 'WhatsApp Accounts' in the left menu",
        "Select your WhatsApp Business Account",
      ],
      link: "https://business.facebook.com",
    },
    {
      title: "Find Your Phone Number ID",
      description: "Locate the correct Phone Number ID from your WhatsApp Business Account",
      substeps: [
        "In WhatsApp Manager, click on 'Phone Numbers'",
        "You'll see a list of phone numbers",
        "Click on the phone number you want to use",
        "Copy the 'Phone Number ID' (16 digits)",
        "⚠️ Make sure it's the Phone Number ID, NOT the Business Account ID",
      ],
    },
    {
      title: "Create a System User Access Token",
      description: "Generate a permanent token with the correct permissions",
      substeps: [
        "Go to Meta Business Settings: business.facebook.com/settings",
        "Click 'Users' → 'System Users'",
        "Click 'Add' to create a new System User (or select existing)",
        "Give it a name like 'WhatsApp API Integration'",
        "Set role to 'Admin'",
        "Click 'Add Assets' and add your WhatsApp Business Account",
        "Click 'Generate New Token'",
        "Select these permissions:",
        "  - whatsapp_business_messaging",
        "  - whatsapp_business_management",
        "Set token to 'Never Expire'",
        "Copy the token (starts with EAAQ...)",
        "⚠️ This is your only chance to copy it!",
      ],
      link: "https://business.facebook.com/settings/system-users",
    },
    {
      title: "Update Your Credentials",
      description: "Update the Phone Number ID and Access Token in your backend",
      substeps: [
        "The WHATSAPP_PHONE_NUMBER_ID is already set",
        "Update WHATSAPP_ACCESS_TOKEN with your new System User token",
        "Make sure the token starts with 'EAAQ' for permanent tokens",
      ],
    },
    {
      title: "Verify Your Setup",
      description: "Test that everything is configured correctly",
      substeps: [
        "Click the 'Verify Configuration' button below",
        "This will check if your credentials are valid",
        "If successful, you'll see your phone number details",
      ],
    },
  ];

  const handleVerify = async () => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-whatsapp-config');

      if (error) throw error;

      setVerificationResult(data);
      
      if (data.success) {
        toast.success("✅ WhatsApp configuration is valid!");
      } else {
        toast.error("❌ Configuration verification failed");
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      setVerificationResult({
        success: false,
        error: error.message || 'Failed to verify configuration',
      });
      toast.error("Failed to verify configuration");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">WhatsApp Business API Setup Guide</h1>
        <p className="text-muted-foreground">
          Follow these steps to configure your WhatsApp Business integration
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Current Error:</strong> Your Phone Number ID or Access Token is invalid. 
          This usually means you're using a temporary token or the wrong Phone Number ID.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 ml-11">
                {step.substeps.map((substep, subIndex) => (
                  <li key={subIndex} className="flex items-start gap-2 text-sm">
                    <Circle className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <span className={substep.startsWith("⚠️") ? "text-orange-500 font-medium" : ""}>
                      {substep}
                    </span>
                  </li>
                ))}
              </ul>
              {step.link && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 ml-11"
                  onClick={() => window.open(step.link, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Link
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary">
        <CardHeader>
          <CardTitle>Step 6: Verify Your Configuration</CardTitle>
          <CardDescription>
            Once you've completed the steps above, verify your setup here
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleVerify} 
            disabled={verifying}
            className="w-full"
            size="lg"
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify WhatsApp Configuration"
            )}
          </Button>

          {verificationResult && (
            <Alert variant={verificationResult.success ? "default" : "destructive"}>
              {verificationResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">
                    {verificationResult.success ? "✅ Success!" : "❌ Verification Failed"}
                  </p>
                  {verificationResult.success ? (
                    <div className="space-y-1 text-sm">
                      <p><strong>Phone Number ID:</strong> {verificationResult.phoneNumberId}</p>
                      {verificationResult.phoneNumberDetails && (
                        <>
                          <p><strong>Display Name:</strong> {verificationResult.phoneNumberDetails.display_phone_number}</p>
                          <p><strong>Verified Name:</strong> {verificationResult.phoneNumberDetails.verified_name}</p>
                          <p><strong>Quality Rating:</strong> <Badge variant="outline">{verificationResult.phoneNumberDetails.quality_rating}</Badge></p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <p><strong>Error:</strong> {verificationResult.error}</p>
                      {verificationResult.possibleIssues && (
                        <div>
                          <p className="font-semibold mt-2">Possible Issues:</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            {verificationResult.possibleIssues.map((issue: string, i: number) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted">
        <CardHeader>
          <CardTitle>Common Issues & Solutions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">Issue: "Object with ID does not exist"</p>
            <p className="text-muted-foreground">
              → You're using the wrong Phone Number ID. Make sure you copy the 16-digit Phone Number ID, not the Business Account ID.
            </p>
          </div>
          <div>
            <p className="font-semibold">Issue: "Cannot be loaded due to missing permissions"</p>
            <p className="text-muted-foreground">
              → Your Access Token doesn't have permission to access this phone number. Create a System User token and assign it to your WhatsApp Business Account.
            </p>
          </div>
          <div>
            <p className="font-semibold">Issue: Token expires quickly</p>
            <p className="text-muted-foreground">
              → You're using a temporary token. System User tokens can be set to never expire.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
