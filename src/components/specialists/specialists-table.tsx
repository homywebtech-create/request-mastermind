import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Trash2, Users, User, Pencil, Link2, CheckCircle, XCircle, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SpecialistForm } from "./specialist-form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

interface Specialist {
  id: string;
  name: string;
  phone: string;
  nationality?: string;
  image_url?: string;
  experience_years?: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  approval_status?: string;
  registration_token?: string;
  registration_completed_at?: string;
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
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);

  const openWhatsApp = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/${cleanNumber}`;
    window.open(whatsappUrl, "_blank");
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

  const handleApproval = async (specialistId: string, status: 'approved' | 'rejected') => {
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
                <TableHead className="text-left">Status</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No specialists registered
                  </TableCell>
                </TableRow>
              ) : (
                specialists.map((specialist) => (
                  <TableRow key={specialist.id}>
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
                      <Badge variant={specialist.is_active ? "default" : "secondary"}>
                        {specialist.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 flex-wrap">
                        {specialist.approval_status === 'pending' && specialist.registration_completed_at && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproval(specialist.id, 'approved')}
                              className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-3 w-3" />
                              قبول
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApproval(specialist.id, 'rejected')}
                              className="flex items-center gap-1"
                            >
                              <XCircle className="h-3 w-3" />
                              رفض
                            </Button>
                          </>
                        )}
                        {(!specialist.registration_completed_at || !specialist.registration_token) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateRegistrationLink(specialist.id)}
                            disabled={generatingToken === specialist.id}
                            className="flex items-center gap-1"
                          >
                            <Link2 className="h-3 w-3" />
                            {generatingToken === specialist.id ? "جاري..." : "إنشاء رابط"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWhatsApp(specialist.phone)}
                          className="flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          WhatsApp
                        </Button>
                        {specialist.approval_status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(specialist)}
                            className="flex items-center gap-1"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="flex items-center gap-1">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {specialist.name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(specialist.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
    </Card>
  );
}
