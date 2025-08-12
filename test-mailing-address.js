// Test mailing address extraction specifically

async function testMailingAddresses() {
  console.log('📬 Testing Mailing Address Extraction...\n');
  
  try {
    const { batchLeadsService } = await import('./server/batchleads.ts');
    
    const response = await batchLeadsService.searchValidProperties({ location: 'Philadelphia, PA' }, 2);
    
    const convertedProperties = response.data
      .map(prop => batchLeadsService.convertToProperty(prop, 'test-user'))
      .filter(prop => prop !== null);
    
    convertedProperties.forEach((prop, i) => {
      console.log(`🏠 Property ${i + 1}: ${prop.address}`);
      console.log(`   Owner: ${prop.ownerName}`);
      console.log(`   Property Address: ${prop.address}, ${prop.city}, ${prop.state} ${prop.zipCode}`);
      console.log(`   Mailing Address: ${prop.ownerMailingAddress || 'Not available'}`);
      console.log(`   Phone: ${prop.ownerPhone || 'Not available'}`);
      console.log(`   Email: ${prop.ownerEmail || 'Not available'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMailingAddresses();