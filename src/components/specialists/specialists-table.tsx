import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Trash2, Users, User, Pencil, Link2, CheckCircle, XCircle, Ban, Clock, FileUser, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpecialistForm } from "./specialist-form";
import { SpecialistProfileDialog } from "./SpecialistProfileDialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { openWhatsApp as openWhatsAppHelper } from "@/lib/externalLinks";

interface Specialist {
  id: string;
  name: string;
  phone: string;
  nationality?: string;
  image_url?: string;
  face_photo_url?: string;
  full_body_photo_url?: string;
  id_card_front_url?: string;
  id_card_back_url?: string;
  id_card_expiry_date?: string;
  experience_years?: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  approval_status?: string;
  registration_token?: string;
  registration_completed_at?: string;
  suspension_type?: string;
  suspension_end_date?: string;
  suspension_reason?: string;
  countries_worked_in?: string[];
  languages_spoken?: string[];
  has_pet_allergy?: boolean;
  has_cleaning_allergy?: boolean;
  specialist_specialties?: Array<{
    sub_service_id: string;
    sub_services: {
      id: string;
      name: string;
      name_en?: string;
      service_id: string;
      services?: {
        id: string;
        name: string;
        name_en?: string;
      };
    };
  }>;
}

interface SpecialistsTableProps {
  specialists: Specialist[];
  companyId: string;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export function SpecialistsTable({ specialists, companyId, onDelete, onUpdate }: SpecialistsTableProps) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  const [suspendingSpecialist, setSuspendingSpecialist] = useState<Specialist | null>(null);
  const [suspensionType, setSuspensionType] = useState<'temporary' | 'permanent'>('temporary');
  const [suspensionEndDate, setSuspensionEndDate] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [showProfile, setShowProfile] = useState<Specialist | null>(null);

  const openWhatsApp = (phoneNumber: string) => {
    openWhatsAppHelper(phoneNumber);
  };

  const copyRegistrationLink = async (specialist: Specialist) => {
    try {
      if (!specialist.registration_token) {
        toast({
          title: language === 'ar' ? "خطأ" : "Error",
          description: language === 'ar' 
            ? "لا يوجد رابط تسجيل" 
            : "No registration link available",
          variant: "destructive",
        });
        return;
      }

      const link = `${window.location.origin}/specialist-registration?token=${specialist.registration_token}`;
      await navigator.clipboard.writeText(link);
      
      toast({
        title: language === 'ar' ? "تم النسخ" : "Copied",
        description: language === 'ar' 
          ? "تم نسخ رابط التسجيل" 
          : "Registration link copied to clipboard",
      });
    } catch (error: any) {
      toast({
        title: language === 'ar' ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRowHighlight = (specialist: Specialist) => {
    // Red: Awaiting registration (link sent but not completed)
    if (!specialist.registration_completed_at && specialist.registration_token) {
      return "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30";
    }
    // Yellow: Completed registration but awaiting approval
    if (specialist.registration_completed_at && specialist.approval_status === 'pending') {
      return "bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-950/30";
    }
    // Green: Approved and active
    if (specialist.approval_status === 'approved' && specialist.is_active) {
      return "bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30";
    }
    return "hover:bg-muted/50";
  };

  const handleGenerateRegistrationLink = async (specialistId: string) => {
    setGeneratingToken(specialistId);
    try {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from("specialists")
        .update({ 
          registration_token: token,
          approval_status: 'pending'
        })
        .eq("id", specialistId);

      if (error) throw error;

      const registrationUrl = `${window.location.origin}/specialist-registration?token=${token}`;
      
      await navigator.clipboard.writeText(registrationUrl);
      
      toast({
        title: "تم إنشاء الرابط / Link Generated",
        description: "تم نسخ رابط التسجيل. يمكنك إرساله للمحترفة / Registration link copied. You can send it to the specialist",
      });
      
      onUpdate();
    } catch (error: any) {
      console.error("Error generating link:", error);
      toast({
        title: "خطأ / Error",
        description: error.message || "فشل إنشاء رابط التسجيل / Failed to generate registration link",
        variant: "destructive",
      });
    } finally {
      setGeneratingToken(null);
    }
  };

  const handleApproval = async (specialistId: string, status: 'approved' | 'rejected' = 'approved') => {
    try {
      const { error } = await supabase
        .from("specialists")
        .update({ 
          approval_status: status,
          is_active: status === 'approved'
        })
        .eq("id", specialistId);

      if (error) throw error;

      toast({
        title: status === 'approved' ? "تمت الموافقة / Approved" : "تم الرفض / Rejected",
        description: status === 'approved' 
          ? "تم قبول المحترفة بنجاح / Specialist approved successfully"
          : "تم رفض المحترفة / Specialist rejected",
      });
      
      onUpdate();
    } catch (error: any) {
      console.error("Error updating approval status:", error);
      toast({
        title: "خطأ / Error",
        description: error.message || "فشل تحديث حالة الموافقة / Failed to update approval status",
        variant: "destructive",
      });
    }
  };

  const getApprovalStatusBadge = (status?: string, registrationCompleted?: string) => {
    if (!status || status === 'pending') {
      if (!registrationCompleted) {
        return <Badge variant="secondary">بانتظار التسجيل / Awaiting Registration</Badge>;
      }
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
        بانتظار الموافقة / Pending Approval
      </Badge>;
    }
    if (status === 'approved') {
      return <Badge variant="default" className="bg-green-600">موافق عليها / Approved</Badge>;
    }
    if (status === 'rejected') {
      return <Badge variant="destructive">مرفوضة / Rejected</Badge>;
    }
    return null;
  };

  const handleEdit = (specialist: Specialist) => {
    setEditingSpecialist(specialist);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setEditingSpecialist(null);
    onUpdate();
  };

  const handleEditCancel = () => {
    setIsEditDialogOpen(false);
    setEditingSpecialist(null);
  };

  const handleSuspension = async () => {
    if (!suspendingSpecialist) return;

    try {
      const updateData: any = {
        suspension_type: suspensionType,
        suspension_reason: suspensionReason,
        is_active: false,
      };

      if (suspensionType === 'temporary' && suspensionEndDate) {
        updateData.suspension_end_date = new Date(suspensionEndDate).toISOString();
      } else {
        updateData.suspension_end_date = null;
      }

      const { error } = await supabase
        .from("specialists")
        .update(updateData)
        .eq("id", suspendingSpecialist.id);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم الإيقاف بنجاح' : 'Suspended Successfully',
        description: suspensionType === 'temporary' 
          ? (language === 'ar' ? 'تم إيقاف المحترفة مؤقتاً' : 'Specialist suspended temporarily')
          : (language === 'ar' ? 'تم إيقاف المحترفة نهائياً' : 'Specialist suspended permanently'),
      });

      setSuspendingSpecialist(null);
      setSuspensionType('temporary');
      setSuspensionEndDate('');
      setSuspensionReason('');
      onUpdate();
    } catch (error: any) {
      console.error("Error suspending specialist:", error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل إيقاف المحترفة' : 'Failed to suspend specialist'),
        variant: "destructive",
      });
    }
  };

  const handleUnsuspend = async (specialistId: string) => {
    try {
      const { error } = await supabase
        .from("specialists")
        .update({
          suspension_type: null,
          suspension_end_date: null,
          suspension_reason: null,
          is_active: true,
        })
        .eq("id", specialistId);

      if (error) throw error;

      toast({
        title: language === 'ar' ? 'تم إلغاء الإيقاف' : 'Unsuspended',
        description: language === 'ar' ? 'تم تفعيل المحترفة بنجاح' : 'Specialist activated successfully',
      });

      onUpdate();
    } catch (error: any) {
      console.error("Error unsuspending specialist:", error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل إلغاء الإيقاف' : 'Failed to unsuspend specialist'),
        variant: "destructive",
      });
    }
  };

  const getSuspensionBadge = (specialist: Specialist) => {
    if (!specialist.suspension_type) return null;
    
    if (specialist.suspension_type === 'permanent') {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <Ban className="h-3 w-3" />
        {language === 'ar' ? 'إيقاف دائم' : 'Permanent'}
      </Badge>;
    }
    
    if (specialist.suspension_type === 'temporary') {
      const endDate = specialist.suspension_end_date ? new Date(specialist.suspension_end_date) : null;
      const isExpired = endDate && endDate < new Date();
      
      return <Badge variant="secondary" className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {isExpired ? 'منتهي / Expired' : `مؤقت / Until ${endDate?.toLocaleDateString()}`}
      </Badge>;
    }
    
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Specialists List ({specialists.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Specialist</TableHead>
                <TableHead className="text-left">Nationality</TableHead>
                <TableHead className="text-left">Specialties</TableHead>
                <TableHead className="text-left">Experience</TableHead>
                <TableHead className="text-left">Phone Number</TableHead>
                <TableHead className="text-left">Approval Status</TableHead>
                <TableHead className="text-left">Suspension</TableHead>
                <TableHead className="text-left">Status</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No specialists registered
                  </TableCell>
                </TableRow>
              ) : (
                specialists.map((specialist) => (
                  <TableRow key={specialist.id} className={getRowHighlight(specialist)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={specialist.image_url} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{specialist.name}</p>
                          {specialist.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {specialist.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {specialist.nationality ? (
                        <span className="text-sm">{specialist.nationality}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {specialist.specialist_specialties && specialist.specialist_specialties.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {specialist.specialist_specialties.map((specialty, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {specialty.sub_services.name_en || specialty.sub_services.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {specialist.experience_years ? (
                        <span className="text-sm">
                          {specialist.experience_years} {specialist.experience_years === 1 ? "year" : "years"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm" dir="ltr">{specialist.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getApprovalStatusBadge(specialist.approval_status, specialist.registration_completed_at)}
                    </TableCell>
                    <TableCell>
                      {getSuspensionBadge(specialist)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={specialist.is_active ? "default" : "secondary"}>
                        {specialist.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setShowProfile(specialist)}>
                            <FileUser className="mr-2 h-4 w-4" />
                            {language === 'ar' ? 'عرض السيرة الذاتية' : 'View Resume'}
                          </DropdownMenuItem>
                          
                          {specialist.registration_token && (
                            <DropdownMenuItem onClick={() => copyRegistrationLink(specialist)}>
                              <Link2 className="mr-2 h-4 w-4" />
                              {language === 'ar' ? 'نسخ رابط التسجيل' : 'Copy Registration Link'}
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem onClick={() => openWhatsApp(specialist.phone)}>
                            <Phone className="mr-2 h-4 w-4" />
                            WhatsApp
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={() => handleEdit(specialist)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            {language === 'ar' ? 'تعديل' : 'Edit'}
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {specialist.suspension_type ? (
                            <DropdownMenuItem 
                              onClick={() => handleUnsuspend(specialist.id)}
                              className="text-green-600"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              {language === 'ar' ? 'تفعيل' : 'Activate'}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setSuspendingSpecialist(specialist)}>
                              <Ban className="mr-2 h-4 w-4" />
                              {language === 'ar' ? 'إيقاف' : 'Suspend'}
                            </DropdownMenuItem>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                onSelect={(e) => e.preventDefault()}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {language === 'ar' ? 'حذف' : 'Delete'}
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {language === 'ar' 
                                    ? `هل أنت متأكد من حذف ${specialist.name}؟ هذا الإجراء لا يمكن التراجع عنه.`
                                    : `Are you sure you want to delete ${specialist.name}? This action cannot be undone.`
                                  }
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                </AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(specialist.id)}>
                                  {language === 'ar' ? 'حذف' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      {editingSpecialist && (
        <Dialog 
          key={editingSpecialist.id} 
          open={isEditDialogOpen} 
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) {
              setTimeout(() => setEditingSpecialist(null), 100);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Specialist</DialogTitle>
            </DialogHeader>
            <SpecialistForm
              key={`edit-${editingSpecialist.id}`}
              companyId={companyId}
              specialist={{
                id: editingSpecialist.id,
                name: editingSpecialist.name,
                phone: editingSpecialist.phone,
                nationality: editingSpecialist.nationality || "",
                experience_years: editingSpecialist.experience_years,
                notes: editingSpecialist.notes,
                image_url: editingSpecialist.image_url,
                specialist_specialties: editingSpecialist.specialist_specialties?.map(s => ({
                  sub_service_id: s.sub_services.id,
                  sub_services: {
                    service_id: s.sub_services.service_id
                  }
                }))
              }}
              onSuccess={handleEditSuccess}
              onCancel={handleEditCancel}
            />
          </DialogContent>
        </Dialog>
      )}

      {suspendingSpecialist && (
        <Dialog open={!!suspendingSpecialist} onOpenChange={() => {
          setSuspendingSpecialist(null);
          setSuspensionType('temporary');
          setSuspensionEndDate('');
          setSuspensionReason('');
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'إيقاف المحترفة' : 'Suspend Specialist'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'نوع الإيقاف' : 'Suspension Type'}</Label>
                <RadioGroup value={suspensionType} onValueChange={(value) => setSuspensionType(value as 'temporary' | 'permanent')}>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="temporary" id="temporary" />
                    <Label htmlFor="temporary" className="cursor-pointer">
                      {language === 'ar' ? 'إيقاف مؤقت' : 'Temporary Suspension'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="permanent" id="permanent" />
                    <Label htmlFor="permanent" className="cursor-pointer">
                      {language === 'ar' ? 'إيقاف دائم' : 'Permanent Suspension'}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {suspensionType === 'temporary' && (
                <div className="space-y-2">
                  <Label htmlFor="endDate">{language === 'ar' ? 'تاريخ انتهاء الإيقاف' : 'End Date'}</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={suspensionEndDate}
                    onChange={(e) => setSuspensionEndDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">{language === 'ar' ? 'سبب الإيقاف (اختياري)' : 'Reason (Optional)'}</Label>
                <Textarea
                  id="reason"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder={language === 'ar' ? 'أدخل سبب الإيقاف...' : 'Enter suspension reason...'}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuspendingSpecialist(null);
                    setSuspensionType('temporary');
                    setSuspensionEndDate('');
                    setSuspensionReason('');
                  }}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSuspension}
                  disabled={suspensionType === 'temporary' && !suspensionEndDate}
                >
                  {language === 'ar' ? 'تأكيد الإيقاف' : 'Confirm Suspension'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Profile Dialog */}
      {showProfile && (
        <SpecialistProfileDialog
          open={!!showProfile}
          onOpenChange={(open) => !open && setShowProfile(null)}
          specialist={{
            id: showProfile.id,
            name: showProfile.name,
            phone: showProfile.phone,
            nationality: showProfile.nationality,
            image_url: showProfile.image_url,
            face_photo_url: showProfile.face_photo_url,
            full_body_photo_url: showProfile.full_body_photo_url,
            id_card_front_url: showProfile.id_card_front_url,
            id_card_back_url: showProfile.id_card_back_url,
            id_card_expiry_date: showProfile.id_card_expiry_date,
            experience_years: showProfile.experience_years,
            rating: 0,
            reviews_count: 0,
            notes: showProfile.notes,
            countries_worked_in: showProfile.countries_worked_in,
            languages_spoken: showProfile.languages_spoken,
            has_pet_allergy: showProfile.has_pet_allergy,
            has_cleaning_allergy: showProfile.has_cleaning_allergy,
            approval_status: showProfile.approval_status,
            registration_completed_at: showProfile.registration_completed_at
          }}
          language={language}
          showApprovalButtons={true}
          onApprove={handleApproval}
          onReject={(id) => handleApproval(id, 'rejected')}
        />
      )}
    </Card>
  );
}
