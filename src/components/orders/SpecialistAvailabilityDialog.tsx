import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { Building2, Home } from "lucide-react";

interface SpecialistAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unavailableSpecialists: Array<{ id: string; name: string }>;
  onChooseOtherCompany: () => void;
}

export function SpecialistAvailabilityDialog({
  open,
  onOpenChange,
  unavailableSpecialists,
  onChooseOtherCompany,
}: SpecialistAvailabilityDialogProps) {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const handleReturnHome = () => {
    onOpenChange(false);
    navigate("/admin");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {language === "ar"
              ? "⚠️ محترفات غير متوفرات"
              : "⚠️ Specialists Not Available"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div>
              {language === "ar"
                ? "المحترفات التاليات لديهن حجز آخر في نفس الوقت:"
                : "The following specialists have another booking at the same time:"}
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {unavailableSpecialists.map((specialist) => (
                <li key={specialist.id}>{specialist.name}</li>
              ))}
            </ul>
            <div className="font-medium">
              {language === "ar"
                ? "ماذا تريد أن تفعل؟"
                : "What would you like to do?"}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleReturnHome}
            className="w-full sm:w-auto"
          >
            <Home className="ml-2 h-4 w-4" />
            {language === "ar" ? "العودة للرئيسية" : "Return to Home"}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onChooseOtherCompany();
            }}
            className="w-full sm:w-auto"
          >
            <Building2 className="ml-2 h-4 w-4" />
            {language === "ar"
              ? "اختيار محترفة من شركة أخرى"
              : "Choose from Another Company"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
