import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Eye, Edit, Plus, Trash } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ActivityLog {
  id: string;
  user_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  created_at: string;
  profile?: {
    full_name: string;
  };
}

export default function ActivityLogs() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole(user?.id);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    actionType: "all",
    searchTerm: ""
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (!roleLoading && role !== 'admin' && role !== 'admin_full' && role !== 'admin_viewer') {
      toast.error("Access denied");
      navigate("/");
      return;
    }

    if (user && role) {
      fetchActivityLogs();
    }
  }, [user, role, authLoading, roleLoading, navigate]);

  const fetchActivityLogs = async () => {
    try {
      let query = supabase
        .from('activity_logs')
        .select(`
          *,
          profiles(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter.actionType !== "all") {
        query = query.eq('action_type', filter.actionType);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData = data.map((log: any) => ({
        ...log,
        profile: log.profiles
      }));

      setLogs(formattedData);
    } catch (error: any) {
      toast.error("Failed to load activity logs");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && role) {
      fetchActivityLogs();
    }
  }, [filter.actionType]);

  const getActionIcon = (actionType: string) => {
    if (actionType.includes('create')) return <Plus className="h-4 w-4" />;
    if (actionType.includes('update')) return <Edit className="h-4 w-4" />;
    if (actionType.includes('delete')) return <Trash className="h-4 w-4" />;
    if (actionType.includes('view')) return <Eye className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getActionBadge = (actionType: string) => {
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
    
    if (actionType.includes('create')) variant = "default";
    else if (actionType.includes('update')) variant = "secondary";
    else if (actionType.includes('delete')) variant = "destructive";
    else variant = "outline";

    return (
      <Badge variant={variant} className="gap-1">
        {getActionIcon(actionType)}
        {actionType.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const filteredLogs = logs.filter(log => {
    if (!filter.searchTerm) return true;
    const searchLower = filter.searchTerm.toLowerCase();
    return (
      log.action_type.toLowerCase().includes(searchLower) ||
      log.resource_type.toLowerCase().includes(searchLower) ||
      log.profile?.full_name?.toLowerCase().includes(searchLower)
    );
  });

  if (authLoading || roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <p className="text-muted-foreground">Track all system activities and changes</p>
      </div>

      <Card className="p-4">
        <div className="flex gap-4">
          <Input
            placeholder="Search logs..."
            value={filter.searchTerm}
            onChange={(e) => setFilter({ ...filter, searchTerm: e.target.value })}
            className="max-w-sm"
          />
          <Select value={filter.actionType} onValueChange={(value) => setFilter({ ...filter, actionType: value })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="order_created">Order Created</SelectItem>
              <SelectItem value="order_updated">Order Updated</SelectItem>
              <SelectItem value="order_deleted">Order Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{getActionBadge(log.action_type)}</TableCell>
                <TableCell className="font-medium">{log.resource_type}</TableCell>
                <TableCell>{log.profile?.full_name || "System"}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {log.details?.old_status && (
                    <span className="text-sm text-muted-foreground">
                      {log.details.old_status} → {log.details.new_status}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
