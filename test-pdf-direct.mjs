import { generateLocalPdf } from './server/pdf/generateLocal.ts';
import { writeFile } from 'fs/promises';

const quoteId = 'cmhl0sjis0002nriqf5gdd5wt';

console.log('🧪 Testing PDF generation...\n');

try {
  const pdfBuffer = await generateLocalPdf(quoteId);
  
  console.log('\n✅ PDF Generated!');
  console.log('Size:', pdfBuffer.length, 'bytes\n');
  
  await writeFile('test-output.pdf', pdfBuffer);
  console.log('✅ Saved to: test-output.pdf');
  console.log('\nOpen with: open test-output.pdf\n');
} catch (error) {
  console.error('\n❌ Error:', error.message, '\n');
  process.exit(1);
}
