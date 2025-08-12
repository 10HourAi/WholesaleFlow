// Debug BatchLeads API response to find contact data fields

async function debugContactData() {
  console.log('🔍 Debugging BatchLeads API Contact Data Structure...\n');
  
  try {
    const { batchLeadsService } = await import('./server/batchleads.ts');
    
    // Get raw API response to examine structure
    const response = await batchLeadsService.searchProperties({ location: 'Philadelphia, PA' }, 1, 3);
    
    console.log('📊 Raw API Response Structure:');
    
    response.data.forEach((property, index) => {
      console.log(`\n🏠 Property ${index + 1}:`);
      console.log('  Address:', property.address?.street || 'N/A');
      console.log('  Owner Object:', JSON.stringify(property.owner, null, 2));
      
      // Check different possible contact field names
      console.log('\n📞 Contact Field Analysis:');
      
      if (property.owner) {
        const owner = property.owner;
        console.log('  - owner.fullName:', owner.fullName);
        console.log('  - owner.phoneNumbers:', owner.phoneNumbers);
        console.log('  - owner.emailAddresses:', owner.emailAddresses);
        console.log('  - owner.phone:', owner.phone);
        console.log('  - owner.email:', owner.email);
        console.log('  - owner.phones:', owner.phones);
        console.log('  - owner.emails:', owner.emails);
        console.log('  - owner.contactInfo:', owner.contactInfo);
        console.log('  - owner.mailingAddress:', owner.mailingAddress);
        console.log('  - owner.addresses:', owner.addresses);
      }
      
      // Check top-level contact fields
      console.log('\n📋 Top-level Contact Fields:');
      console.log('  - property.contact:', property.contact);
      console.log('  - property.phoneNumbers:', property.phoneNumbers);
      console.log('  - property.emailAddresses:', property.emailAddresses);
      
      console.log('\n' + '='.repeat(50));
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugContactData();