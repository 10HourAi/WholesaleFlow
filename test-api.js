// Using built-in fetch in Node.js 18+

async function testBatchLeads() {
  const apiKey = process.env.BATCHLEADS_API_KEY;
  console.log('API Key exists:', !!apiKey);
  
  if (!apiKey) {
    console.error('No API key found!');
    return;
  }

  try {
    console.log('Testing BatchLeads API for ZIP 17112...');
    
    const baseUrl = 'https://api.batchdata.com';
    const endpoint = '/api/v1/property/search';
    
    const requestBody = {
      searchCriteria: {
        query: '17112'
      },
      options: {
        skip: 0,
        take: 5,
        skipTrace: false
      }
    };
    
    console.log('Making request to:', baseUrl + endpoint);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(baseUrl + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': '10HourAi/1.0'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`BatchLeads API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✓ Success! Full API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    const properties = data.results?.properties || data.properties || [];
    const totalResults = data.meta?.totalResults || data.total_results || 0;
    
    console.log('\n--- Parsed Results ---');
    console.log('Total results:', totalResults);
    console.log('Properties returned:', properties.length);
    
    if (properties && properties.length > 0) {
      console.log('\n--- Sample Properties ---');
      properties.slice(0, 3).forEach((prop, i) => {
        console.log(`\nProperty ${i+1}:`);
        console.log(`ID: ${prop._id || 'N/A'}`);
        console.log(`Address: ${prop.address?.full || 'N/A'}`);
        console.log(`City: ${prop.address?.city || 'N/A'}, State: ${prop.address?.state || 'N/A'}`);
        console.log(`ZIP: ${prop.address?.zip || 'N/A'}`);
        console.log(`Property Type: ${prop.building?.propertyType || 'N/A'}`);
        console.log(`Bedrooms: ${prop.building?.bedrooms || 'N/A'}`);
        console.log(`Bathrooms: ${prop.building?.bathrooms || 'N/A'}`);
        console.log(`Living Area: ${prop.building?.livingArea?.toLocaleString() || 'N/A'} sq ft`);
        console.log(`Estimated Value: $${prop.valuation?.estimatedValue?.toLocaleString() || 'N/A'}`);
        console.log(`Equity Percent: ${prop.valuation?.equityPercent || 'N/A'}%`);
        console.log(`Owner: ${prop.currentOwner?.name || 'N/A'}`);
        console.log(`Last Sale Price: $${prop.sale?.lastSalePrice?.toLocaleString() || 'N/A'}`);
        console.log(`Last Sale Date: ${prop.sale?.lastSaleDate || 'N/A'}`);
      });
    } else {
      console.log('No properties found in the response');
      console.log('This could mean:');
      console.log('1. No properties exist in ZIP 17112');
      console.log('2. API credentials may not have access to this data');
      console.log('3. Search criteria may be too restrictive');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

testBatchLeads();