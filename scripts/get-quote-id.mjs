#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('📋 Fetching a sample quote...\n');

    const quote = await prisma.quote.findFirst({
      include: {
        lines: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!quote) {
      console.log('❌ No quotes found in database');
      console.log('💡 Create a quote first at http://localhost:3001/quotes/new\n');
      process.exit(1);
    }

    console.log('✅ Found quote:');
    console.log(`   ID: ${quote.id}`);
    console.log(`   Reference: ${quote.reference}`);
    console.log(`   Client: ${quote.clientName}`);
    console.log(`   Lines: ${quote.lines.length}`);
    console.log(`   Created: ${quote.createdAt.toISOString()}`);
    console.log('');
    console.log('🧪 Test Commands:');
    console.log('');
    console.log('1. View print page in browser:');
    console.log(`   http://localhost:3001/quotes/${quote.id}/print`);
    console.log('');
    console.log('2. Test PDF generation + email (replace YOUR_EMAIL and YOUR_COOKIE):');
    console.log(`   curl -X POST http://localhost:3001/api/quotes/${quote.id}/issue \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -H "Cookie: YOUR_SESSION_COOKIE" \\`);
    console.log(`     -d '{"to": "your-email@example.com"}'`);
    console.log('');
    console.log('📝 See TESTING_INSTRUCTIONS.md for detailed steps\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
