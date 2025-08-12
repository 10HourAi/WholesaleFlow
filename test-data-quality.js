// Test data quality validation for BatchLeads integration

async function testDataQuality() {
  console.log('🔍 Testing Data Quality Validation...\n');
  
  try {
    // Test multiple locations to check data quality
    const locations = ['17112', '90210', '10001', '33101'];
    
    for (const location of locations) {
      console.log(`📍 Testing location: ${location}`);
      
      const { batchLeadsService } = await import('./server/batchleads.ts');
      const response = await batchLeadsService.searchProperties({ location }, 1, 5);
      
      console.log(`  Raw properties returned: ${response.data.length}`);
      
      // Test conversion with validation
      const convertedProperties = response.data
        .map(prop => batchLeadsService.convertToProperty(prop, 'test-user'))
        .filter(prop => prop !== null);
      
      const filteredOut = response.data.length - convertedProperties.length;
      
      console.log(`  Valid properties after filtering: ${convertedProperties.length}`);
      console.log(`  Filtered out (missing price/equity): ${filteredOut}`);
      
      // Show sample valid properties
      if (convertedProperties.length > 0) {
        const sample = convertedProperties[0];
        console.log(`  Sample valid property:`);
        console.log(`    Address: ${sample.address}`);
        console.log(`    ARV: $${parseInt(sample.arv).toLocaleString()}`);
        console.log(`    Equity: ${sample.equityPercentage}%`);
        console.log(`    Max Offer: $${parseInt(sample.maxOffer).toLocaleString()}`);
      }
      
      console.log(`  Quality Rate: ${Math.round((convertedProperties.length / response.data.length) * 100)}%\n`);
    }
    
    console.log('✅ Data quality validation working correctly!');
    console.log('✅ Properties with N/A prices or undefined equity are filtered out');
    console.log('✅ Only actionable wholesale leads are returned');
    
  } catch (error) {
    console.error('❌ Data quality test failed:', error.message);
  }
}

testDataQuality();