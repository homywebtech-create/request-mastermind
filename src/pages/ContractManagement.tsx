import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CheckCircle, XCircle, Clock, Building2, Eye, FileText } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { useTranslation } from '@/i18n';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ContractTemplate {
  id: string;
  company_id: string;
  title: string;
  content_ar: string;
  content_en: string;
  terms_ar: string[];
  terms_en: string[];
  is_active: boolean;
  company_logo_url?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  companies?: {
    name: string;
    name_en?: string;
  };
}

export default function ContractManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractTemplate[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractTemplate | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const translations = useTranslation(language);
  const t = translations.contracts;
  const tCommon = translations.common;

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_templates')
        .select(`
          *,
          companies (
            name,
            name_en
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setContracts((data || []) as ContractTemplate[]);
    } catch (error: any) {
      console.error('Error fetching contracts:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (contractId: string) => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من الموافقة على هذا العقد؟' : 'Are you sure you want to approve this contract?')) {
      return;
    }

    try {
      setProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('contract_templates')
        .update({
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq('id', contractId);

      if (error) throw error;

      toast({
        title: tCommon.success,
        description: language === 'ar' ? 'تم اعتماد العقد بنجاح' : 'Contract approved successfully',
      });

      fetchContracts();
    } catch (error: any) {
      console.error('Error approving contract:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const openRejectionDialog = (contract: ContractTemplate) => {
    setSelectedContract(contract);
    setRejectionReason('');
    setRejectionDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedContract) return;

    if (!rejectionReason.trim()) {
      toast({
        title: tCommon.error,
        description: language === 'ar' ? 'يرجى إدخال سبب الرفض' : 'Please enter rejection reason',
        variant: 'destructive',
      });
      return;
    }

    try {
      setProcessing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('contract_templates')
        .update({
          approval_status: 'rejected',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq('id', selectedContract.id);

      if (error) throw error;

      toast({
        title: tCommon.success,
        description: language === 'ar' ? 'تم رفض العقد' : 'Contract rejected',
      });

      setRejectionDialogOpen(false);
      fetchContracts();
    } catch (error: any) {
      console.error('Error rejecting contract:', error);
      toast({
        title: tCommon.error,
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 me-1" />{language === 'ar' ? 'معتمد' : 'Approved'}</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 me-1" />{language === 'ar' ? 'مرفوض' : 'Rejected'}</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 me-1" />{language === 'ar' ? 'قيد المراجعة' : 'Pending'}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {t.title}
              </h1>
              <p className="text-muted-foreground mt-1">
                {language === 'ar' ? 'مراجعة واعتماد عقود الشركات' : 'Review and approve company contracts'}
              </p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <Card className="shadow-xl border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {language === 'ar' ? 'جميع عقود الشركات' : 'All Company Contracts'}
            </CardTitle>
            <CardDescription>
              {contracts.length} {language === 'ar' ? 'عقد' : 'contracts'}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الشركة' : 'Company'}</TableHead>
                  <TableHead>{language === 'ar' ? 'عنوان العقد' : 'Contract Title'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{language === 'ar' ? 'تاريخ الإنشاء' : 'Created At'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {language === 'ar' ? 'لا توجد عقود' : 'No contracts found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {language === 'ar' ? contract.companies?.name : (contract.companies?.name_en || contract.companies?.name)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{contract.title}</TableCell>
                      <TableCell>{getStatusBadge(contract.approval_status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(contract.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedContract(contract);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 me-1" />
                            {language === 'ar' ? 'عرض' : 'View'}
                          </Button>
                          
                          {contract.approval_status === 'pending' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprove(contract.id)}
                                disabled={processing}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="h-4 w-4 me-1" />
                                {language === 'ar' ? 'اعتماد' : 'Approve'}
                              </Button>
                              
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => openRejectionDialog(contract)}
                                disabled={processing}
                              >
                                <XCircle className="h-4 w-4 me-1" />
                                {language === 'ar' ? 'رفض' : 'Reject'}
                              </Button>
                            </>
                          )}
                          
                          {contract.approval_status === 'rejected' && contract.rejection_reason && (
                            <div className="text-xs text-destructive max-w-xs">
                              {contract.rejection_reason}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{selectedContract?.title}</span>
                {selectedContract && getStatusBadge(selectedContract.approval_status)}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'معاينة العقد' : 'Contract Preview'}
              </DialogDescription>
            </DialogHeader>
            
            {selectedContract && (
              <div className="space-y-6">
                {/* Company Logo */}
                {selectedContract.company_logo_url && (
                  <div>
                    <Label className="mb-2 block">{language === 'ar' ? 'شعار الشركة' : 'Company Logo'}</Label>
                    <img
                      src={selectedContract.company_logo_url}
                      alt="Company Logo"
                      className="h-24 w-24 object-contain border rounded-lg p-2"
                    />
                  </div>
                )}

                {/* Arabic Content */}
                <div>
                  <Label className="mb-2 block">{t.arabicContent}</Label>
                  <div className="p-4 bg-muted rounded-lg" dir="rtl">
                    <p className="whitespace-pre-wrap">{selectedContract.content_ar}</p>
                  </div>
                </div>

                {/* English Content */}
                <div>
                  <Label className="mb-2 block">{t.englishContent}</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="whitespace-pre-wrap">{selectedContract.content_en}</p>
                  </div>
                </div>

                {/* Arabic Terms */}
                {selectedContract.terms_ar.length > 0 && (
                  <div>
                    <Label className="mb-2 block">{t.arabicTerms}</Label>
                    <div className="space-y-2">
                      {selectedContract.terms_ar.map((term, index) => (
                        <div key={index} className="p-3 bg-muted rounded-lg" dir="rtl">
                          <p className="text-sm">{index + 1}. {term}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* English Terms */}
                {selectedContract.terms_en.length > 0 && (
                  <div>
                    <Label className="mb-2 block">{t.englishTerms}</Label>
                    <div className="space-y-2">
                      {selectedContract.terms_en.map((term, index) => (
                        <div key={index} className="p-3 bg-muted rounded-lg">
                          <p className="text-sm">{index + 1}. {term}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection Reason if exists */}
                {selectedContract.approval_status === 'rejected' && selectedContract.rejection_reason && (
                  <div>
                    <Label className="mb-2 block text-destructive">{language === 'ar' ? 'سبب الرفض' : 'Rejection Reason'}</Label>
                    <div className="p-4 bg-destructive/10 rounded-lg">
                      <p className="text-destructive">{selectedContract.rejection_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'رفض العقد' : 'Reject Contract'}</DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'يرجى تقديم سبب رفض هذا العقد' : 'Please provide a reason for rejecting this contract'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejection-reason">{language === 'ar' ? 'سبب الرفض' : 'Rejection Reason'}</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder={language === 'ar' ? 'اكتب سبب الرفض...' : 'Enter rejection reason...'}
                  rows={4}
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRejectionDialogOpen(false)}
                  disabled={processing}
                >
                  {tCommon.cancel}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processing || !rejectionReason.trim()}
                >
                  <XCircle className="h-4 w-4 me-2" />
                  {processing ? (language === 'ar' ? 'جاري الرفض...' : 'Rejecting...') : (language === 'ar' ? 'رفض العقد' : 'Reject Contract')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}