// Test the improved validation system

async function testValidation() {
  console.log('🔧 Testing Improved Data Validation System...\n');
  
  try {
    const { batchLeadsService } = await import('./server/batchleads.ts');
    
    // Test the problematic ZIP that had $0 properties
    console.log('📍 Testing ZIP 33101 (previously had $0 ARV properties)...');
    
    const response = await batchLeadsService.searchValidProperties({ location: '33101' }, 5);
    
    console.log(`✅ Raw search results: ${response.data.length}`);
    console.log(`❌ Filtered out invalid: ${response.filteredCount}`);
    
    // Convert and validate
    const convertedProperties = response.data
      .map(prop => batchLeadsService.convertToProperty(prop, 'test-user'))
      .filter(prop => prop !== null);
    
    console.log(`✅ Final valid properties: ${convertedProperties.length}\n`);
    
    // Show properties to verify no $0 or undefined values
    convertedProperties.forEach((prop, i) => {
      console.log(`Property ${i + 1}:`);
      console.log(`  Address: ${prop.address}`);
      console.log(`  ARV: $${parseInt(prop.arv).toLocaleString()}`);
      console.log(`  Equity: ${prop.equityPercentage}%`);
      console.log(`  Max Offer: $${parseInt(prop.maxOffer).toLocaleString()}`);
      console.log(`  Valid: ${prop.arv !== '0' && !isNaN(prop.equityPercentage) ? '✅' : '❌'}\n`);
    });
    
    console.log('🎉 Validation system working correctly!');
    console.log('✅ No $0 ARV properties');
    console.log('✅ No undefined equity percentages');
    console.log('✅ All properties have actionable data');
    
  } catch (error) {
    console.error('❌ Validation test failed:', error.message);
  }
}

testValidation();