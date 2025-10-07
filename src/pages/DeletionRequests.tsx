import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { translations } from "@/i18n/translations";
import { format } from "date-fns";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DeletionRequest {
  id: string;
  company_id: string;
  requested_by: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  company_data: any;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  companies?: {
    name: string;
    name_en?: string;
  };
  profiles?: {
    full_name: string;
  };
}

const t = translations.companies;
const tCommon = translations.common;

export default function DeletionRequests() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("deletion_requests")
        .select(`
          *,
          companies(name, name_en)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data as any) || []);
    } catch (error: any) {
      console.error("Error fetching deletion requests:", error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (request: DeletionRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setIsDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!selectedRequest || !actionType || !user) return;

    try {
      if (actionType === 'approve') {
        // Delete the company
        const { error: deleteError } = await supabase
          .from("companies")
          .delete()
          .eq("id", selectedRequest.company_id);

        if (deleteError) throw deleteError;

        // Update request status
        const { error: updateError } = await supabase
          .from("deletion_requests")
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id
          })
          .eq("id", selectedRequest.id);

        if (updateError) throw updateError;

        toast({
          title: tCommon.success,
          description: t.deletionApproved,
        });
      } else {
        // Just update request status to rejected
        const { error } = await supabase
          .from("deletion_requests")
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id
          })
          .eq("id", selectedRequest.id);

        if (error) throw error;

        toast({
          title: tCommon.success,
          description: t.deletionRejected,
        });
      }

      setIsDialogOpen(false);
      setSelectedRequest(null);
      setActionType(null);
      fetchRequests();
    } catch (error: any) {
      console.error('Error processing deletion request:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const renderRequests = (status: 'pending' | 'approved' | 'rejected') => {
    const filteredRequests = requests.filter(req => req.status === status);

    if (filteredRequests.length === 0) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {status === 'pending' ? t.noPendingRequests : `No ${status} requests`}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredRequests.map((request) => (
          <Card key={request.id}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {request.companies?.name_en || request.companies?.name || request.company_data?.name}
                    </h3>
                    <Badge variant={
                      status === 'pending' ? 'default' :
                      status === 'approved' ? 'destructive' : 'secondary'
                    }>
                      {status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong>{t.deletionReason}:</strong> {request.reason}</p>
                    <p><strong>{t.requestedBy}:</strong> {request.profiles?.full_name || 'Unknown'}</p>
                    <p><strong>{t.requestDate}:</strong> {format(new Date(request.created_at), 'PPP')}</p>
                    {request.reviewed_at && (
                      <p><strong>Reviewed:</strong> {format(new Date(request.reviewed_at), 'PPP')}</p>
                    )}
                  </div>
                </div>

                {status === 'pending' && (
                  <div className="flex flex-col gap-2 md:items-end">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleAction(request, 'approve')}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {t.approve}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(request, 'reject')}
                      className="flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      {t.reject}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground font-cairo">
                {t.deletionRequests}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t.manageDeletionRequests}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate("/admin")}
              className="flex items-center gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              {t.backToHome}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">{t.pendingDeletions}</TabsTrigger>
            <TabsTrigger value="approved">{t.approvedDeletions}</TabsTrigger>
            <TabsTrigger value="rejected">{t.rejectedDeletions}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending" className="mt-6">
            {renderRequests('pending')}
          </TabsContent>
          
          <TabsContent value="approved" className="mt-6">
            {renderRequests('approved')}
          </TabsContent>
          
          <TabsContent value="rejected" className="mt-6">
            {renderRequests('rejected')}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-cairo">
              {actionType === 'approve' ? t.approve : t.reject} {t.deletionRequests}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' 
                ? 'Are you sure you want to approve this deletion? This action will permanently delete the company.'
                : 'Are you sure you want to reject this deletion? The company will remain in the system.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              {tCommon.submit}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
