import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  customers: {
    name: string;
  };
}

interface ReviewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviews: Review[];
  specialistName: string;
  language: 'ar' | 'en';
}

export function ReviewsDialog({ open, onOpenChange, reviews, specialistName, language }: ReviewsDialogProps) {
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
        />
      );
    }
    return stars;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'تقييمات ' : 'Reviews for '}{specialistName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{review.customers.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                  {review.review_text && (
                    <p className="text-sm text-foreground mt-2" dir="auto">
                      {review.review_text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>
                {language === 'ar' 
                  ? 'لا توجد تقييمات حتى الآن' 
                  : 'No reviews yet'}
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
