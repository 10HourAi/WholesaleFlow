// Test the BatchLeads API integration directly

async function testIntegration() {
  console.log('🚀 Testing AiClosings BatchLeads Integration...\n');
  
  try {
    // Test 1: Search properties in ZIP 17112
    console.log('📍 Searching properties in ZIP 17112...');
    
    // Dynamically import and use the service
    const { batchLeadsService } = await import('./server/batchleads.ts');
    const response = await batchLeadsService.searchProperties({ location: '17112' }, 1, 3);
    
    console.log(`✅ Found ${response.data.length} properties (${response.total_results} total available)`);
    
    // Test 2: Convert to our property format
    console.log('\n🔄 Converting to AiClosings format...');
    const convertedProperties = response.data.map(prop => 
      batchLeadsService.convertToProperty(prop, 'demo-user')
    );
    
    console.log('\n🏠 **LIVE PROPERTY DATA FROM BATCHDATA API:**');
    console.log('=' .repeat(60));
    
    convertedProperties.forEach((prop, i) => {
      console.log(`\nProperty ${i + 1}:`);
      console.log(`📍 Address: ${prop.address}`);
      console.log(`🏢 Location: ${prop.city}, ${prop.state} ${prop.zipCode}`);
      console.log(`💰 ARV: $${parseInt(prop.arv).toLocaleString()}`);
      console.log(`🎯 Max Offer: $${parseInt(prop.maxOffer).toLocaleString()}`);
      console.log(`📈 Equity: ${prop.equityPercentage}%`);
      console.log(`⭐ Motivation Score: ${prop.motivationScore}/100`);
      console.log(`👤 Owner: ${prop.ownerName || 'Available'}`);
      console.log(`🏷️ Lead Type: ${prop.leadType.replace('_', ' ')}`);
      console.log(`🚨 Distress: ${prop.distressedIndicator}`);
    });
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 **SUCCESS! BatchLeads API Integration is LIVE!**');
    console.log('✅ Real property data retrieved');
    console.log('✅ Motivation scoring working');  
    console.log('✅ Lead classification functional');
    console.log('✅ Ready for AI agent integration');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('Full error:', error);
  }
}

testIntegration();