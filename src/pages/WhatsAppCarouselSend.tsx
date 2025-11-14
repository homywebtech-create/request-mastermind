import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Users } from "lucide-react";

const WhatsAppCarouselSend = () => {
  const [sending, setSending] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [headerText, setHeaderText] = useState("Available Specialists");
  const [bodyText, setBodyText] = useState("Swipe to view our professional specialists and book your service.");
  const [footerText, setFooterText] = useState("Powered by Mobo");
  const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);

  const loadSpecialists = async () => {
    setLoadingSpecialists(true);
    try {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name, specialty')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .limit(10);

      if (error) throw error;
      setSpecialists(data || []);
    } catch (error) {
      console.error('Error loading specialists:', error);
      toast.error('Failed to load specialists');
    } finally {
      setLoadingSpecialists(false);
    }
  };

  const handleSendCarousel = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }

    if (selectedSpecialists.length === 0) {
      toast.error('Please select at least one specialist');
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-carousel', {
        body: {
          to: phoneNumber,
          header_text: headerText,
          body_text: bodyText,
          footer_text: footerText,
          product_retailer_ids: selectedSpecialists,
        }
      });

      if (error) {
        console.error('Send error:', error);
        toast.error('Failed to send carousel message');
        return;
      }

      console.log('Send result:', data);
      toast.success('Carousel message sent successfully!');
      
      // Reset form
      setPhoneNumber('');
      setSelectedSpecialists([]);
    } catch (error) {
      console.error('Error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setSending(false);
    }
  };

  const toggleSpecialist = (id: string) => {
    setSelectedSpecialists(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-6 w-6" />
            Send WhatsApp Carousel
          </CardTitle>
          <CardDescription>
            Send a multi-product carousel message with specialists to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              Send a swipeable specialist carousel to customers. Each card shows specialist photo, info, rating, and a "Book Now" button.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Customer Phone Number (with country code)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="966501234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Format: Country code + phone number (e.g., 966501234567 for Saudi Arabia)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="header">Header Text</Label>
              <Input
                id="header"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="Available Specialists"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body Text</Label>
              <Textarea
                id="body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Choose from our professional specialists:"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer">Footer Text</Label>
              <Input
                id="footer"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="Tap to view details"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Specialists (Max 10)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSpecialists}
                  disabled={loadingSpecialists}
                >
                  {loadingSpecialists ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      Load Specialists
                    </>
                  )}
                </Button>
              </div>

              {specialists.length > 0 && (
                <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                  {specialists.map((specialist) => (
                    <div
                      key={specialist.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedSpecialists.includes(specialist.id)
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-muted hover:bg-muted/70 border-2 border-transparent'
                      }`}
                      onClick={() => toggleSpecialist(specialist.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSpecialists.includes(specialist.id)}
                        onChange={() => {}}
                        className="h-4 w-4"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{specialist.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {specialist.specialty || 'General Service'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedSpecialists.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedSpecialists.length} specialist(s) selected
                </p>
              )}
            </div>

            <Button
              onClick={handleSendCarousel}
              disabled={sending || !phoneNumber || selectedSpecialists.length === 0}
              size="lg"
              className="w-full"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Carousel...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send WhatsApp Carousel
                </>
              )}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Customer receives a swipeable carousel with specialist cards</li>
              <li>Each card displays: photo, name, specialty, rating, experience, nationality</li>
              <li>Customers swipe left/right to browse specialists</li>
              <li>Each card has a "Book Now" button to schedule the service</li>
              <li>Professional, interactive way to showcase your team</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppCarouselSend;
