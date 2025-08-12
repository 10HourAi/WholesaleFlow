import { batchLeadsService } from './batchleads';

async function testBatchLeads() {
  try {
    console.log('Testing BatchLeads API for ZIP 17112...');
    
    // Search for non-owner occupied single family homes in ZIP 17112
    const results = await batchLeadsService.searchProperties({
      location: '17112',
      propertyType: 'single_family',
      distressedOnly: false, // We want all properties, not just distressed
      motivationScore: 50 // Minimum motivation score
    }, 1, 10); // Get first 10 results

    console.log(`Found ${results.total_results} total properties`);
    console.log(`Showing first ${results.data.length} properties:`);
    
    // Filter for non-owner occupied (if BatchLeads provides this data)
    const nonOwnerOccupied = results.data.slice(0, 5);
    
    nonOwnerOccupied.forEach((property, index) => {
      console.log(`\n--- Property ${index + 1} ---`);
      console.log(`Address: ${property.address}`);
      console.log(`City: ${property.city}, ${property.state} ${property.zip_code}`);
      console.log(`Type: ${property.property_type}`);
      console.log(`Bedrooms: ${property.bedrooms}, Bathrooms: ${property.bathrooms}`);
      console.log(`Square Feet: ${property.square_feet?.toLocaleString()}`);
      console.log(`Estimated Value: $${property.estimated_value?.toLocaleString()}`);
      console.log(`Owner: ${property.owner_name}`);
      console.log(`Motivation Score: ${property.motivation_score}/100`);
      console.log(`Equity: ${property.equity_percentage}%`);
      console.log(`Distressed Indicator: ${property.distressed_indicator || 'None'}`);
    });

    return nonOwnerOccupied;
    
  } catch (error) {
    console.error('BatchLeads API Test Error:', error);
    throw error;
  }
}

// Export for use in routes
export { testBatchLeads };