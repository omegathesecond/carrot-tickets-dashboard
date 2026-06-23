import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import { resellerHubsApi } from '@/lib/resellerApi';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const HUB_VIEW_ROLES = ['reseller_admin', 'reseller_hub_manager'];

export function ResellerHubsPage() {
  const { operator } = useResellerAuth();
  const { data: hubs = [], isLoading } = useQuery({
    queryKey: ['portal-hubs'],
    queryFn: () => resellerHubsApi.list(),
  });

  if (operator && !HUB_VIEW_ROLES.includes(operator.role)) {
    return <Navigate to="/reseller" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      <Link to="/reseller" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to POS
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Hubs</h1>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-slate-500 text-sm py-4">Loading…</p>
          ) : hubs.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No hubs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hubs.map((hub) => (
                  <TableRow key={hub._id} className="cursor-pointer hover:bg-slate-50">
                    <TableCell className="font-medium">
                      <Link to={`/reseller/hubs/${hub._id}`} className="block">{hub.name}</Link>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <Link to={`/reseller/hubs/${hub._id}`} className="block">
                        {hub.location?.city || hub.location?.region
                          ? [hub.location.city, hub.location.region].filter(Boolean).join(', ')
                          : '—'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={hub.isActive ? 'default' : 'secondary'}>
                        {hub.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
