import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Trash2, Users, User, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SpecialistForm } from "./specialist-form";
import { useState } from "react";
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
  specialist_specialties?: Array<{
    sub_service_id: string;
    sub_services: {
      id: string;
      name: string;
      service_id: string;
      services?: {
        id: string;
        name: string;
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
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const openWhatsApp = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/${cleanNumber}`;
    window.open(whatsappUrl, "_blank");
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
                <TableHead className="text-left">Status</TableHead>
                <TableHead className="text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {specialists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                              {specialty.sub_services.name}
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
                      <Badge variant={specialist.is_active ? "default" : "secondary"}>
                        {specialist.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWhatsApp(specialist.phone)}
                          className="flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(specialist)}
                          className="flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
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
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <SpecialistForm
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
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
