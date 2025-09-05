// Simple test script to verify workbook API
const testWorkbookAPI = async () => {
  try {
    console.log('🧪 Testing workbook API...');
    
    const response = await fetch('http://localhost:3000/api/workbooks');
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', JSON.stringify(data, null, 2));
      
      if (data.success) {
        console.log(`📊 Found ${data.workbooks.length} workbooks`);
        data.workbooks.forEach((wb, index) => {
          console.log(`  ${index + 1}. ${wb.name} (${wb.tenantName}) - ID: ${wb.id.slice(-8)}`);
        });
      }
    } else {
      console.error('❌ API failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testWorkbookAPI();
