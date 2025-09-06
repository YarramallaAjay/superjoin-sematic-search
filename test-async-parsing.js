 const { ExcelParser } = require('./apps/embedder/parse.ts');
const XLSX = require('xlsx');

// Create a simple test workbook
function createTestWorkbook() {
  const wb = XLSX.utils.book_new();
  
  // Create test data
  const testData = [
    ['Customer', 'Revenue', 'Profit'],
    ['CUST_001', 1000, 200],
    ['CUST_002', 1500, 300],
    ['CUST_003', 2000, 400]
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(testData);
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  
  // Add another sheet
  const testData2 = [
    ['Product', 'Sales', 'Margin'],
    ['PROD_001', 500, 50],
    ['PROD_002', 750, 75]
  ];
  
  const ws2 = XLSX.utils.aoa_to_sheet(testData2);
  XLSX.utils.book_append_sheet(wb, ws2, 'Products');
  
  return XLSX.write(wb, { type: 'buffer' });
}

async function testAsyncParsing() {
  console.log('🧪 Testing Async Parsing Logic...\n');
  
  const parser = new ExcelParser();
  const buffer = createTestWorkbook();
  
  const startTime = Date.now();
  
  try {
    const cells = await parser.parseAndUploadCells(
      'test-tenant',
      'test-workbook',
      buffer,
      async (cell, cellId) => {
        console.log(`📝 Cell parsed: ${cell.sheetName} - ${cell.rowName} - ${cell.colName}`);
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 10));
      },
      async (sheetName, rowCount, colCount, cellCount) => {
        console.log(`📊 Sheet parsed: ${sheetName} (${rowCount}x${colCount}, ${cellCount} cells)`);
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`\n✅ Async parsing completed successfully!`);
    console.log(`📈 Performance Results:`);
    console.log(`   - Total cells parsed: ${cells.length}`);
    console.log(`   - Total time: ${duration}ms`);
    console.log(`   - Average time per cell: ${(duration / cells.length).toFixed(2)}ms`);
    console.log(`   - Sheets processed: ${new Set(cells.map(c => c.sheetName)).size}`);
    
    // Verify data integrity
    const salesCells = cells.filter(c => c.sheetName === 'Sales');
    const productCells = cells.filter(c => c.sheetName === 'Products');
    
    console.log(`\n🔍 Data Verification:`);
    console.log(`   - Sales sheet cells: ${salesCells.length}`);
    console.log(`   - Products sheet cells: ${productCells.length}`);
    console.log(`   - All cells have embeddings: ${cells.every(c => c.embedding && c.embedding.length > 0)}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Async parsing failed:', error);
    return false;
  }
}

// Run the test
testAsyncParsing().then(success => {
  if (success) {
    console.log('\n🎉 Async parsing test PASSED!');
  } else {
    console.log('\n💥 Async parsing test FAILED!');
  }
  process.exit(success ? 0 : 1);
});
