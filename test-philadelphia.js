// Test Philadelphia specifically to check for data quality issues

async function testPhiladelphia() {
  console.log('🏛️ Testing Philadelphia Properties - Data Quality Check...\n');
  
  try {
    const { batchLeadsService } = await import('./server/batchleads.ts');
    
    console.log('📍 Searching Philadelphia, PA for 5 valid distressed properties...');
    
    const response = await batchLeadsService.searchValidProperties({ 
      location: 'Philadelphia, PA',
      distressedOnly: true 
    }, 5);
    
    console.log(`📊 Search Results:`);
    console.log(`   Raw properties found: ${response.data.length}`);
    console.log(`   Properties filtered out: ${response.filteredCount}`);
    console.log(`   Target: 5 valid properties\n`);
    
    // Convert and validate each property
    const convertedProperties = response.data
      .map(prop => batchLeadsService.convertToProperty(prop, 'test-user'))
      .filter(prop => prop !== null);
    
    console.log(`✅ Final valid properties: ${convertedProperties.length}\n`);
    
    // Detailed validation check for each property
    convertedProperties.forEach((prop, i) => {
      const arvValid = prop.arv && parseInt(prop.arv) > 1000;
      const equityValid = prop.equityPercentage !== undefined && prop.equityPercentage !== null && !isNaN(prop.equityPercentage);
      const addressValid = prop.address && prop.address !== '' && prop.address !== 'Address not available';
      
      console.log(`Property ${i + 1}: ${arvValid && equityValid && addressValid ? '✅ VALID' : '❌ INVALID'}`);
      console.log(`   Address: ${prop.address}`);
      console.log(`   ARV: $${parseInt(prop.arv).toLocaleString()} ${arvValid ? '✅' : '❌'}`);
      console.log(`   Equity: ${prop.equityPercentage}% ${equityValid ? '✅' : '❌'}`);
      console.log(`   Max Offer: $${parseInt(prop.maxOffer).toLocaleString()}`);
      console.log(`   Owner: ${prop.ownerName || 'Not available'}`);
      console.log(`   Lead Type: ${prop.leadType}`);
      console.log(`   Distress: ${prop.distressedIndicator}\n`);
    });
    
    // Summary
    const validCount = convertedProperties.filter(p => 
      parseInt(p.arv) > 1000 && 
      !isNaN(p.equityPercentage) && 
      p.address !== 'Address not available'
    ).length;
    
    console.log(`🎯 FINAL VALIDATION RESULTS:`);
    console.log(`   ✅ Valid properties: ${validCount}/${convertedProperties.length}`);
    console.log(`   ❌ Filtered out: ${response.filteredCount}`);
    console.log(`   📈 Data quality rate: ${Math.round((validCount / (validCount + response.filteredCount)) * 100)}%`);
    
    if (validCount === convertedProperties.length) {
      console.log('\n🎉 SUCCESS: All returned properties have complete data!');
    } else {
      console.log('\n⚠️  WARNING: Some properties still have incomplete data');
    }
    
  } catch (error) {
    console.error('❌ Philadelphia test failed:', error.message);
  }
}

testPhiladelphia();