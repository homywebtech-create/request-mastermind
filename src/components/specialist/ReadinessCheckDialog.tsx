import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { useTranslation } from '@/i18n';

interface ReadinessCheckDialogProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReadinessCheckDialog({ orderId, isOpen, onClose }: ReadinessCheckDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notReadyReason, setNotReadyReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const handleResponse = async (isReady: boolean) => {
    if (!isReady && !notReadyReason.trim() && !showReasonInput) {
      setShowReasonInput(true);
      return;
    }

    if (!isReady && !notReadyReason.trim()) {
      toast({
        title: isAr ? 'خطأ' : 'Error',
        description: isAr ? 'يرجى توضيح السبب' : 'Please provide a reason',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          specialist_readiness_status: isReady ? 'ready' : 'not_ready',
          specialist_readiness_response_at: new Date().toISOString(),
          specialist_not_ready_reason: isReady ? null : notReadyReason,
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: isAr ? 'نجح' : 'Success',
        description: isReady 
          ? (isAr ? 'تم تأكيد جاهزيتك للطلب' : 'Your readiness has been confirmed')
          : (isAr ? 'تم تسجيل ردك' : 'Your response has been recorded'),
      });

      onClose();
      setNotReadyReason('');
      setShowReasonInput(false);
    } catch (error) {
      console.error('Error updating readiness:', error);
      toast({
        title: isAr ? 'خطأ' : 'Error',
        description: isAr ? 'فشل في تحديث حالة الجاهزية' : 'Failed to update readiness status',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isAr ? 'تأكيد الجاهزية' : 'Readiness Check'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isAr ? 'لديك طلب قادم خلال ساعة. هل أنت جاهز؟' : 'You have an upcoming order in one hour. Are you ready?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!showReasonInput ? (
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => handleResponse(true)}
                disabled={isSubmitting}
                className="w-full h-12 text-lg"
                variant="default"
              >
                ✓ {isAr ? 'نعم، أنا جاهز' : 'Yes, I\'m Ready'}
              </Button>
              <Button
                onClick={() => handleResponse(false)}
                disabled={isSubmitting}
                className="w-full h-12 text-lg"
                variant="destructive"
              >
                ✗ {isAr ? 'لا، لست جاهزاً' : 'No, I\'m Not Ready'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason" className="text-base font-semibold">
                  {isAr ? 'سبب عدم الجاهزية' : 'Reason for Not Ready'}
                </Label>
                <Textarea
                  id="reason"
                  value={notReadyReason}
                  onChange={(e) => setNotReadyReason(e.target.value)}
                  placeholder={isAr ? 'يرجى توضيح سبب عدم الجاهزية...' : 'Please explain why you\'re not ready...'}
                  className="mt-2 min-h-[100px]"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowReasonInput(false);
                    setNotReadyReason('');
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={() => handleResponse(false)}
                  disabled={isSubmitting || !notReadyReason.trim()}
                  className="flex-1"
                  variant="destructive"
                >
                  {isAr ? 'إرسال' : 'Submit'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
