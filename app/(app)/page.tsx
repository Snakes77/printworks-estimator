import Link from 'next/link';
import Decimal from 'decimal.js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensurePrismaUser } from '@/lib/app-user';
import { prisma } from '@/lib/prisma';
import { calculateTotals } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatGBP } from '@/lib/pricing';

export default async function DashboardPage() {
  // TEMPORARY: Use seeded demo user
  const demoUser = await prisma.user.findUnique({
    where: { email: 'dave@example.co.uk' }
  });

  if (!demoUser) {
    return <div>Demo user not found. Please run: npx prisma db seed</div>;
  }

  const appUser = demoUser;

  const recentQuotes = await prisma.quote.findMany({
    where: { userId: appUser.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { lines: true }
  });

  const quotesWithTotals = recentQuotes.map((quote) => ({
    ...quote,
    totals: calculateTotals(
      quote.lines.map((line) => ({
        rateCardId: line.rateCardId,
        description: line.description,
        unitPricePerThousand: new Decimal(line.unitPricePerThousand.toString()),
        makeReadyFixed: new Decimal(line.makeReadyFixed.toString()),
        unitsInThousands: new Decimal(line.unitsInThousands.toString()),
        lineTotalExVat: new Decimal(line.lineTotalExVat.toString())
      })),
      Number(quote.vatRate)
    )
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent quotes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Envelope</TableHead>
                  <TableHead className="text-right">Total inc VAT</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotesWithTotals.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>{quote.clientName}</TableCell>
                    <TableCell>{quote.reference}</TableCell>
                    <TableCell className="text-right">{quote.quantity.toLocaleString('en-GB')}</TableCell>
                    <TableCell>{quote.envelopeType}</TableCell>
                    <TableCell className="text-right">{formatGBP(quote.totals.total)}</TableCell>
                    <TableCell>{quote.updatedAt.toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>
                      <Button asChild variant="secondary" className="px-3 py-1 text-xs">
                        <Link href={`/quotes/${quote.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {quotesWithTotals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-slate-500">
                      No quotes yet. Create your first quote to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/quotes/new">Create quote</Link>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/import">Import rate cards</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/rate-cards">Manage rate cards</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
