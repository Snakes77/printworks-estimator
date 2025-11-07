import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { ensurePrismaUser } from '@/lib/app-user';

export const dashboardRouter = createTRPCRouter({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const user = await ensurePrismaUser(ctx.user);

    // Get all quotes for statistics
    const allQuotes = await ctx.prisma.quote.findMany({
      include: {
        lines: true,
        user: true
      }
    });

    // Calculate totals for each quote
    const quotesWithTotals = allQuotes.map(quote => {
      const subtotal = quote.lines.reduce((sum, line) =>
        sum + Number(line.lineTotalExVat), 0
      );
      const discount = subtotal * (Number(quote.discountPercentage) / 100);
      const total = subtotal - discount;

      return {
        ...quote,
        total
      };
    });

    // Overall statistics
    const totalQuotes = quotesWithTotals.length;
    const draftQuotes = quotesWithTotals.filter(q => q.status === 'DRAFT').length;
    const sentQuotes = quotesWithTotals.filter(q => q.status === 'SENT').length;
    const wonQuotes = quotesWithTotals.filter(q => q.status === 'WON').length;
    const lostQuotes = quotesWithTotals.filter(q => q.status === 'LOST').length;

    // Conversion rate (won / (won + lost))
    const closedQuotes = wonQuotes + lostQuotes;
    const conversionRate = closedQuotes > 0 ? (wonQuotes / closedQuotes) * 100 : 0;

    // Total value
    const totalValue = quotesWithTotals
      .filter(q => q.status === 'WON')
      .reduce((sum, q) => sum + q.total, 0);

    // Pipeline value (sent quotes)
    const pipelineValue = quotesWithTotals
      .filter(q => q.status === 'SENT')
      .reduce((sum, q) => sum + q.total, 0);

    // Leaderboard - group by user
    const userStats = quotesWithTotals.reduce((acc, quote) => {
      const userId = quote.userId;
      const userName = quote.user.name || quote.user.email;

      if (!acc[userId]) {
        acc[userId] = {
          userId,
          userName,
          totalQuotes: 0,
          wonQuotes: 0,
          sentQuotes: 0,
          lostQuotes: 0,
          wonValue: 0,
          conversionRate: 0
        };
      }

      acc[userId].totalQuotes++;

      if (quote.status === 'WON') {
        acc[userId].wonQuotes++;
        acc[userId].wonValue += quote.total;
      } else if (quote.status === 'SENT') {
        acc[userId].sentQuotes++;
      } else if (quote.status === 'LOST') {
        acc[userId].lostQuotes++;
      }

      return acc;
    }, {} as Record<string, any>);

    // Calculate conversion rates for each user
    const leaderboard = Object.values(userStats).map((user: any) => {
      const closed = user.wonQuotes + user.lostQuotes;
      const conversionRate = closed > 0 ? (user.wonQuotes / closed) * 100 : 0;

      return {
        ...user,
        conversionRate
      };
    }).sort((a, b) => b.wonValue - a.wonValue); // Sort by won value

    return {
      overview: {
        totalQuotes,
        draftQuotes,
        sentQuotes,
        wonQuotes,
        lostQuotes,
        conversionRate,
        totalValue,
        pipelineValue
      },
      leaderboard
    };
  }),

  recentActivity: protectedProcedure.query(async ({ ctx }) => {
    const user = await ensurePrismaUser(ctx.user);

    // Get recent quote updates
    const recentQuotes = await ctx.prisma.quote.findMany({
      take: 10,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        user: true,
        lines: true
      }
    });

    return recentQuotes.map(quote => {
      const subtotal = quote.lines.reduce((sum, line) =>
        sum + Number(line.lineTotalExVat), 0
      );
      const discount = subtotal * (Number(quote.discountPercentage) / 100);
      const total = subtotal - discount;

      return {
        id: quote.id,
        reference: quote.reference,
        clientName: quote.clientName,
        status: quote.status,
        total,
        updatedAt: quote.updatedAt.toISOString(),
        userName: quote.user.name || quote.user.email
      };
    });
  })
});
