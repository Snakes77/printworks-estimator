#!/usr/bin/env node

/**
 * Test PDF generation locally
 * Usage: node scripts/test-pdf.mjs <quote-id>
 */

const quoteId = process.argv[2];

if (!quoteId) {
  console.error('Usage: node scripts/test-pdf.mjs <quote-id>');
  process.exit(1);
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const printUrl = `${baseUrl}/quotes/${quoteId}/print`;

console.log('Testing PDF generation...');
console.log('Quote ID:', quoteId);
console.log('Print URL:', printUrl);
console.log('');

// Test 1: Check if print route is accessible
console.log('1. Testing print route accessibility...');
try {
  const response = await fetch(printUrl);
  const html = await response.text();
  console.log('   Status:', response.status);
  console.log('   HTML length:', html.length);
  console.log('   Has #ready:', html.includes('id="ready"'));
  console.log('   Has quote content:', html.includes('Quote') || html.includes('Client'));
  
  if (response.status !== 200) {
    console.error('   ❌ Print route returned error status');
    process.exit(1);
  }
  
  if (html.length < 500) {
    console.error('   ❌ Print route returned insufficient content');
    process.exit(1);
  }
  
  console.log('   ✅ Print route is working');
} catch (error) {
  console.error('   ❌ Failed to fetch print route:', error.message);
  process.exit(1);
}

console.log('');
console.log('2. Testing PDF generation (requires Puppeteer)...');
try {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  
  const readyExists = await page.evaluate(() => !!document.getElementById('ready'));
  const bodyLength = await page.evaluate(() => document.body.innerHTML.length);
  const hasContent = await page.evaluate(() => document.body.textContent.trim().length > 0);
  
  console.log('   Page loaded');
  console.log('   #ready exists:', readyExists);
  console.log('   Body length:', bodyLength);
  console.log('   Has content:', hasContent);
  
  if (!hasContent || bodyLength < 100) {
    console.error('   ❌ Page appears empty');
    await browser.close();
    process.exit(1);
  }
  
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
  });
  
  console.log('   PDF generated:', pdf.length, 'bytes');
  
  await browser.close();
  console.log('   ✅ PDF generation successful');
} catch (error) {
  console.error('   ❌ PDF generation failed:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}

console.log('');
console.log('✅ All tests passed!');

