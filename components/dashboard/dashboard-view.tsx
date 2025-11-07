'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatGBP } from '@/lib/pricing';
import { TrendingUp, TrendingDown, DollarSign, FileText, Send, CheckCircle, XCircle } from 'lucide-react';

export const DashboardView = () => {
  const statsQuery = trpc.dashboard.stats.useQuery();
  const activityQuery = trpc.dashboard.recentActivity.useQuery();

  if (statsQuery.isLoading || activityQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  const stats = statsQuery.data?.overview;
  const leaderboard = statsQuery.data?.leaderboard || [];
  const recentActivity = activityQuery.data || [];

  const getStatusBadge = (status: string) => {
    const styles = {
      DRAFT: 'bg-gray-100 text-gray-800',
      SENT: 'bg-blue-100 text-blue-800',
      WON: 'bg-green-100 text-green-800',
      LOST: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalQuotes || 0}</div>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.draftQuotes || 0} draft · {stats?.sentQuotes || 0} sent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            {(stats?.conversionRate || 0) >= 50 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-orange-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.conversionRate.toFixed(1) || 0}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.wonQuotes || 0} won · {stats?.lostQuotes || 0} lost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won Value</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatGBP(stats?.totalValue || 0)}</div>
            <p className="text-xs text-slate-500 mt-1">From {stats?.wonQuotes || 0} quotes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatGBP(stats?.pipelineValue || 0)}</div>
            <p className="text-xs text-slate-500 mt-1">{stats?.sentQuotes || 0} quotes pending</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leaderboard */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Team Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length > 0 ? (
              <div className="space-y-4">
                {leaderboard.map((user, index) => (
                  <div key={user.userId} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700">
                      #{index + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{user.userName}</p>
                      <p className="text-xs text-slate-500">
                        {user.wonQuotes} won · {user.sentQuotes} sent · {user.lostQuotes} lost
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatGBP(user.wonValue)}</p>
                      <p className="text-xs text-slate-500">{user.conversionRate.toFixed(0)}% conversion</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-slate-500 py-6">No quote activity yet</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/quotes/new">Create quote</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/quotes">View all quotes</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/rate-cards">Manage rate cards</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Updated by</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="font-medium">{activity.reference}</TableCell>
                  <TableCell>{activity.clientName}</TableCell>
                  <TableCell>{getStatusBadge(activity.status)}</TableCell>
                  <TableCell className="text-right">{formatGBP(activity.total)}</TableCell>
                  <TableCell className="text-slate-600">{activity.userName}</TableCell>
                  <TableCell className="text-slate-600">
                    {new Date(activity.updatedAt).toLocaleDateString('en-GB')}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" className="px-3 py-1 text-xs">
                      <Link href={`/quotes/${activity.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {recentActivity.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6">
                    No recent activity
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
