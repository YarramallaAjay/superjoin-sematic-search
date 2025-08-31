const { readFileSync } = require('fs');
const { ingestWorkbook } = require('../models/db_ingest');

const main = async () => {
    try {
        // Read the Excel file
        const buffer = readFileSync('./Company_Financial_Model_MultiYear.xlsx');
        
        // Create workbook ID from filename
        const workbookId = Buffer.from('Company_Financial_Model_MultiYear.xlsx').toString('base64');
        console.log('Workbook ID:', workbookId);

        // Ingest the workbook
        const result = await ingestWorkbook(
            'tenant_1234',
            buffer,
            'Company_Financial_Model_MultiYear.xlsx'
        );

        console.log('Ingestion result:', result);
    } catch (error) {
        console.error('Error ingesting workbook:', error);
    }
};

main();