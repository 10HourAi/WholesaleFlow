import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { insertPropertySchema, insertContactSchema, insertConversationSchema, insertMessageSchema, insertDocumentSchema, insertDealSchema } from "@shared/schema";
import { generateLeadFinderResponse, generateDealAnalyzerResponse, generateNegotiationResponse, generateClosingResponse, generatePropertyLeads } from "./openai";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  // Properties
  app.get("/api/properties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const properties = await storage.getProperties(userId);
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/properties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty({ ...validatedData, userId });
      res.json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/properties/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { city, state, status, leadType } = req.query;
      const properties = await storage.searchProperties(userId, {
        city: city as string,
        state: state as string,
        status: status as string,
        leadType: leadType as string
      });
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/properties/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const property = await storage.updateProperty(req.params.id, userId, req.body);
      res.json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Contacts
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contacts = await storage.getContacts(userId);
      res.json(contacts);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.json(contact);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Conversations
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Messages
  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        conversationId: req.params.id
      });
      const userMessage = await storage.createMessage(validatedData);

      // Skip AI responses for wizard-generated messages
      const isWizardMessage = validatedData.content.toLowerCase().includes('find') && 
                             validatedData.content.toLowerCase().includes('properties') &&
                             (validatedData.content.toLowerCase().includes('distressed') || 
                              validatedData.content.toLowerCase().includes('motivated') ||
                              validatedData.content.toLowerCase().includes('leads'));

      // Generate AI response based on agent type (skip for wizard messages)
      const conversation = await storage.getConversation(req.params.id);
      let aiResponse = "";

      if (conversation && !isWizardMessage) {
        switch (conversation.agentType) {
          case "lead-finder":
            // Check if this is a property search request from Seller Lead Wizard
            const isPropertySearch = validatedData.content.toLowerCase().match(/(find|search|show|get)\s+(properties|distressed|leads)/i) ||
                                     validatedData.content.toLowerCase().includes('properties in') ||
                                     validatedData.content.match(/\d+\s+properties/i);
            
            // Check if this is a cash buyer search request from Cash Buyer Wizard
            const isCashBuyerSearch = validatedData.content.toLowerCase().match(/(find|search|show|get)\s+(cash\s+buyers?|buyers?)/i) ||
                                      validatedData.content.toLowerCase().includes('cash buyers in');
            
            if (isCashBuyerSearch) {
              // Route directly to BatchLeads Cash Buyer API, bypass OpenAI
              const { batchLeadsService } = await import("./batchleads");
              
              // Extract location from message
              let location = 'Orlando, FL'; // Default
              const locationMatch = validatedData.content.match(/in\s+([^,\n]+(?:,\s*[A-Z]{2})?)/i);
              if (locationMatch) {
                location = locationMatch[1].trim();
              }
              
              console.log(`💰 ROUTES: About to call BatchLeads Cash Buyer API with location:`, location);
              const results = await batchLeadsService.searchCashBuyersRaw({ location, limit: 5 });
              console.log(`💰 ROUTES: Cash Buyer API returned:`, JSON.stringify(results, null, 2));
              
              if (results.buyers.length === 0) {
                aiResponse = `I couldn't find any qualified cash buyers with 3+ properties in ${location}. Try a different location or check back later as new buyers enter the market regularly.`;
              } else {
                // Simple response - the frontend wizard will handle the detailed card formatting
                aiResponse = `Found ${results.buyers.length} qualified cash buyers with 3+ properties in ${location}. Processing individual cards now...`;
              }
            } else if (isPropertySearch) {
              // Route directly to BatchLeads API, bypass OpenAI
              const { batchLeadsService } = await import("./batchleads");
              
              // Extract location from message
              let location = 'Orlando, FL'; // Default
              const locationMatch = validatedData.content.match(/in\s+([^,\n]+(?:,\s*[A-Z]{2})?)/i);
              if (locationMatch) {
                location = locationMatch[1].trim();
              }
              
              // Extract price filter
              let maxPrice;
              const priceMatch = validatedData.content.match(/under\s+\$?([0-9,]+)/i);
              if (priceMatch) {
                maxPrice = parseInt(priceMatch[1].replace(/,/g, ''));
              }
              
              // Search criteria for BatchLeads
              const searchCriteria = {
                location,
                distressedOnly: true,
                propertyType: 'single_family',
                maxPrice
              };
              
              console.log(`🔍 ROUTES: About to call BatchLeads API with criteria:`, searchCriteria);
              const results = await batchLeadsService.searchValidProperties(searchCriteria, 5);
              console.log(`🔍 ROUTES: BatchLeads API returned:`, JSON.stringify(results, null, 2));
              
              if (results.data.length === 0) {
                aiResponse = `I couldn't find any properties matching your criteria in ${location}. Try a different location or expanding your search criteria.`;
              } else {
                // Display complete API response fields and values
                let response = `**🔍 COMPLETE BATCHDATA API RESPONSE ANALYSIS:**\n\n`;
                
                // Show first property's complete field structure
                if (results.data.length > 0) {
                  const firstProperty = results.data[0];
                  response += `**📊 PROPERTY 1 - COMPLETE FIELD BREAKDOWN:**\n`;
                  response += `Address: ${firstProperty.address}\n`;
                  response += `**All Available Fields and Values:**\n`;
                  
                  Object.entries(firstProperty).forEach(([key, value]) => {
                    if (value === null) {
                      response += `- ${key}: NULL (not provided by API)\n`;
                    } else if (value === undefined) {
                      response += `- ${key}: UNDEFINED\n`;
                    } else {
                      response += `- ${key}: "${value}"\n`;
                    }
                  });
                  
                  response += `\n**🏗️ BUILDING DATA AVAILABILITY:**\n`;
                  response += `- Bedrooms: ${firstProperty.bedrooms || 'NOT PROVIDED'}\n`;
                  response += `- Bathrooms: ${firstProperty.bathrooms || 'NOT PROVIDED'}\n`;
                  response += `- Square Feet: ${firstProperty.squareFeet || 'NOT PROVIDED'}\n`;
                  response += `- Year Built: ${firstProperty.yearBuilt || 'NOT PROVIDED'}\n`;
                  
                  response += `\n**📈 DATA SUMMARY:**\n`;
                  response += `- Total Properties: ${results.data.length}\n`;
                  response += `- Properties with Building Data: 0\n`;
                  response += `- Building Data Fields Available: None\n`;
                  response += `- Data Source: BatchLeads Quicklists API\n\n`;
                  response += `---\n\n`;
                }
                
                // Format response with comprehensive BatchLeads data
                response += `**🏠 PROPERTY DETAILS:**\n\n`;
                
                results.data.forEach((property, index) => {
                  response += `${index + 1}. ${property.address}, ${property.city}, ${property.state} ${property.zipCode}\n`;
                  response += `   - **PROPERTY DETAILS:**\n`;
                  response += `   - Est. Value (ARV): $${property.arv ? parseInt(property.arv).toLocaleString() : 'N/A'}\n`;
                  response += `   - Max Offer (70% Rule): $${property.maxOffer ? parseInt(property.maxOffer).toLocaleString() : 'N/A'}\n`;
                  response += `   - Building: ${property.bedrooms || 'Unknown'}BR/${property.bathrooms || 'Unknown'}BA, ${property.squareFeet?.toLocaleString() || 'Unknown'} sq ft\n`;
                  response += `   - Year Built: ${property.yearBuilt || 'Not available'}\n`;
                  response += `   - Property Type: ${property.propertyType || 'Single Family'}\n`;
                  response += `   - **OWNER INFORMATION:**\n`;
                  response += `   - Owner Name: ${property.ownerName || 'Available via skip trace'}\n`;
                  response += `   - Owner Phone: ${property.ownerPhone || 'Available via skip trace'}\n`;
                  response += `   - Owner Email: ${property.ownerEmail || 'Available via skip trace'}\n`;
                  response += `   - Mailing Address: ${property.ownerMailingAddress || 'Same as property address'}\n`;
                  response += `   - **FINANCIAL ANALYSIS:**\n`;
                  response += `   - Equity Percentage: ${property.equityPercentage || 0}%\n`;
                  response += `   - Motivation Score: ${property.motivationScore || 0}/100\n`;
                  response += `   - Lead Type: ${property.leadType ? property.leadType.replace('_', ' ').toUpperCase() : 'STANDARD'}\n`;
                  response += `   - Distressed Indicator: ${property.distressedIndicator ? property.distressedIndicator.replace('_', ' ') : 'Standard opportunity'}\n`;
                  response += `   - **SALES HISTORY:**\n`;
                  response += `   - Last Sale Date: ${property.lastSaleDate || 'No recent sales'}\n`;
                  response += `   - Last Sale Price: ${property.lastSalePrice ? `$${parseInt(property.lastSalePrice).toLocaleString()}` : 'Not available'}\n`;
                  response += `   - Status: ${property.status || 'New'}\n\n`;
                });
                
                aiResponse = response;
              }
            } else {
              // Non-property search - using dummy response while API is paused
              aiResponse = "I'm here to help you find motivated sellers and distressed properties! Use the Seller Lead Wizard above to search for properties in your target area.";
            }
            break;
          case "deal-analyzer":
            // Using dummy response while API is paused
            aiResponse = "I'm the Deal Analyzer Agent! I help analyze property deals and calculate profit potential. All API calls are currently paused - using dummy data for testing.";
            break;
          case "negotiation":
            // Using dummy response while API is paused
            aiResponse = "I'm the Negotiation Agent! I help craft compelling offers and negotiate with sellers. All API calls are currently paused - using dummy data for testing.";
            break;
          case "closing":
            // Using dummy response while API is paused
            aiResponse = "I'm the Closing Agent! I help manage transactions and prepare closing documents. All API calls are currently paused - using dummy data for testing.";
            break;
          default:
            aiResponse = "I'm here to help with your real estate wholesaling needs!";
        }

        // Create AI response message
        const aiMessage = await storage.createMessage({
          conversationId: req.params.id,
          content: aiResponse,
          role: "assistant",
          isAiGenerated: true
        });

        res.json([userMessage, aiMessage]);
      } else {
        res.json([userMessage]);
      }
    } catch (error: any) {
      console.error("Error in message handler:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Documents
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documents = await storage.getDocuments(userId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertDocumentSchema.parse(req.body);
      const document = await storage.createDocument(validatedData);
      res.json(document);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Deals
  app.get("/api/deals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deals = await storage.getDeals(userId);
      res.json(deals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/deals", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertDealSchema.parse(req.body);
      const deal = await storage.createDeal(validatedData);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/deals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deal = await storage.updateDeal(req.params.id, req.body);
      res.json(deal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Test BatchLeads API
  app.post("/api/test-batchleads", isAuthenticated, async (req: any, res) => {
    try {
      const { testBatchLeads } = await import("./test-batchleads");
      const properties = await testBatchLeads();
      res.json({
        success: true,
        message: "BatchLeads API test successful",
        properties: properties.slice(0, 5)
      });
    } catch (error: any) {
      console.error("BatchLeads test error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: error.toString()
      });
    }
  });

  // BatchLeads Property Search
  app.post("/api/properties/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { location, maxPrice, minEquity, propertyType, distressedOnly, motivationScore } = req.body;

      const { batchLeadsService } = await import("./batchleads");
      const results = await batchLeadsService.searchProperties({
        location,
        maxPrice,
        minEquity,
        propertyType,
        distressedOnly,
        motivationScore
      });

      // Convert BatchLeads properties to our format and save them
      const savedProperties = [];
      for (const batchProperty of results.data.slice(0, 10)) { // Limit to first 10 results
        const propertyData = batchLeadsService.convertToProperty(batchProperty, userId);
        if (propertyData !== null) { // Only save valid properties
          const property = await storage.createProperty(propertyData);
          savedProperties.push(property);
        }
      }

      res.json({
        properties: savedProperties,
        total: results.total_results,
        page: results.page
      });
    } catch (error: any) {
      console.error("Property search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get Distressed Properties
  app.post("/api/properties/distressed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { location } = req.body;

      const { batchLeadsService } = await import("./batchleads");
      const distressedProperties = await batchLeadsService.getDistressedProperties(location);

      // Convert and save distressed properties
      const savedProperties = [];
      for (const batchProperty of distressedProperties) {
        const propertyData = batchLeadsService.convertToProperty(batchProperty, userId);
        const property = await storage.createProperty(propertyData);
        savedProperties.push(property);
      }

      res.json(savedProperties);
    } catch (error: any) {
      console.error("Distressed properties error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get multiple properties at once - API DISABLED FOR UI TESTING
  app.post("/api/properties/batch", isAuthenticated, async (req: any, res) => {
    console.log("🚫 API calls paused - batch properties endpoint disabled for UI testing");
    res.json({
      properties: [],
      total: 0,
      filtered: 0,
      hasMore: false,
      message: "API calls paused for UI testing. Use the Seller Lead Wizard for dummy data."
    });
  });

  // Serve demo page
  app.get('/demo', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'demo.html'));
  });

  // Debug endpoint to test location formats
  app.get('/api/debug/locations/:location?', async (req, res) => {
    try {
      const location = req.params.location || '17112';
      const { batchLeadsService } = await import("./batchleads");

      // Try multiple formats
      const formats = [
        location,
        location.replace(/\s+/g, ''),  // Remove spaces
        location.replace(',', ''),      // Remove commas
        '17033',                       // Hershey ZIP
        '17112'                        // Default ZIP
      ];

      const results = {};

      for (const format of formats) {
        try {
          console.log(`Testing format: "${format}"`);
          const response = await batchLeadsService.searchProperties({ location: format }, 1, 5);
          results[format] = {
            totalResults: response.total_results,
            propertiesFound: response.data.length,
            success: true
          };
        } catch (error) {
          results[format] = {
            error: error.message,
            success: false
          };
        }
      }

      res.json({
        originalLocation: location,
        results
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dedicated Cash Buyer API endpoint - API DISABLED FOR UI TESTING
  app.post("/api/cash-buyers/search", async (req, res) => {
    console.log("🚫 API calls paused - cash buyer search endpoint disabled for UI testing");
    res.json({
      success: false,
      error: "API calls paused for UI testing. Use the Cash Buyer Wizard for dummy data.",
      buyers: [],
      totalFound: 0,
      returned: 0
    });
  });

  // Terry - Target Market Finder Chat API
  app.post("/api/terry/chat", isAuthenticated, async (req: any, res) => {
    try {
      console.log("🤖 Terry chat request received:", req.body);
      const { message, history } = req.body;
      
      if (!message) {
        console.log("❌ No message provided");
        return res.status(400).json({ error: "Message is required" });
      }

      console.log("🔑 Checking OpenAI API key...");
      if (!process.env.OPENAI_API_KEY) {
        console.log("❌ No OpenAI API key found");
        return res.status(500).json({ 
          error: "OpenAI API key not configured" 
        });
      }

      console.log("📥 Importing OpenAI service...");
      const { openaiService } = await import("./openai");
      
      // Create system prompt for Terry
      const systemPrompt = `You are Terry, a specialized Target Market Finder AI agent for real estate investing. You help investors identify the best markets and areas for real estate investment opportunities.

Your expertise includes:
- Market analysis and research
- Identifying high-growth areas and emerging markets
- Cash flow analysis for different neighborhoods
- Rental yield calculations and projections
- Market trend analysis and forecasting
- Demographics and economic indicators
- Property value appreciation patterns
- Risk assessment for different markets

You should be helpful, knowledgeable, and focused on providing actionable market insights. Keep responses conversational but informative. Always ask clarifying questions when you need more information about their investment goals, budget, or preferred market criteria.

When users ask about market research, provide specific, data-driven insights. If they're looking for investment opportunities, help them understand key metrics like cap rates, cash-on-cash returns, and market fundamentals.`;

      // Prepare messages for OpenAI
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      console.log("🚀 Calling OpenAI with", messages.length, "messages");
      const response = await openaiService.getChatCompletion(messages);
      console.log("✅ OpenAI response received:", response.substring(0, 100) + "...");
      
      res.json({ response });
    } catch (error: any) {
      console.error("❌ Terry chat error:", error);
      console.error("Error details:", error.message, error.stack);
      res.status(500).json({ 
        error: error.message || "Sorry, I'm having trouble processing your request right now. Please try again."
      });
    }
  });

  // Public demo endpoints (no auth required for testing)
  app.get('/api/demo/batchleads/:location?', async (req, res) => {
    try {
      const location = req.params.location || '17112';
      const { batchLeadsService } = await import("./batchleads");
      const response = await batchLeadsService.searchProperties({ location }, 1, 3);

      const convertedProperties = response.data.map(prop =>
        batchLeadsService.convertToProperty(prop, 'demo-user')
      );

      res.json({
        success: true,
        message: 'BatchData API integration working!',
        location: location,
        total_results: response.total_results,
        properties_returned: convertedProperties.length,
        properties: convertedProperties.slice(0, 3).map(p => ({
          address: p.address,
          city: p.city,
          state: p.state,
          zipCode: p.zipCode,
          arv: p.arv,
          maxOffer: p.maxOffer,
          equityPercentage: p.equityPercentage,
          motivationScore: p.motivationScore,
          leadType: p.leadType,
          distressedIndicator: p.distressedIndicator,
          ownerName: p.ownerName
        }))
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.post('/api/demo/chat', async (req, res) => {
    try {
      const { message, agentType = 'lead_finder', sessionState } = req.body;

      // Check if this is a "next property" request
      const isNextPropertyRequest = message.toLowerCase().match(/(next|another|more|show me another)/i);

      // Enhanced property search detection - much more flexible
      const hasSearchAction = message.toLowerCase().match(/(find|search|show|get|locate|display)/i);
      const hasPropertyTerm = message.toLowerCase().match(/(properties|homes|houses|leads|distressed)/i) ||
                              message.toLowerCase().match(/(harrisburg|philadelphia|pa)/i) ||
                              message.toLowerCase().includes('absentee') ||
                              message.toLowerCase().includes('bedroom') ||
                              message.toLowerCase().includes('single-family') ||
                              message.toLowerCase().includes('family homes') ||
                              message.match(/\d+\s+(properties|homes)/i);
      
      const isPropertySearch = hasSearchAction && hasPropertyTerm;
      
      console.log('🔍 Search detection:', {
        message: message.substring(0, 100),
        hasSearchAction,
        hasPropertyTerm,
        isPropertySearch,
        isNextPropertyRequest
      });

      if (isNextPropertyRequest && sessionState && sessionState.searchCriteria) {
        // User wants the next property in the current search
        const { batchLeadsService } = await import("./batchleads");

        const result = await batchLeadsService.getNextValidProperty(sessionState.searchCriteria, sessionState);

        if (result.property) {
          // Use raw property data directly from API for better data display
          const rawProperty = result.property;
          const address = rawProperty.address;
          const valuation = rawProperty.valuation;
          const owner = rawProperty.owner;
          const quickLists = rawProperty.quickLists || {};
          const foreclosure = rawProperty.foreclosure;
          const building = rawProperty.building;
          const openLien = rawProperty.openLien;

          console.log(`🏠 Displaying property:`, rawProperty._id);

          // Enhanced property details with all available data
          const propertyAddress = `${address?.street || 'N/A'}, ${address?.city || 'N/A'}, ${address?.state || 'N/A'} ${address?.zip || 'N/A'}`;

          // Building details with fallbacks
          const buildingDetails = [];
          if (building?.bedrooms) buildingDetails.push(`${building.bedrooms}bd`);
          if (building?.bathrooms) buildingDetails.push(`${building.bathrooms}ba`);
          if (building?.livingArea) buildingDetails.push(`${building.livingArea.toLocaleString()} sq ft`);
          if (building?.yearBuilt) buildingDetails.push(`Built ${building.yearBuilt}`);
          const buildingInfo = buildingDetails.length > 0 ? buildingDetails.join(' • ') : 'Building details not in API response';

          // Financial analysis with all valuation data
          const estimatedValue = valuation?.estimatedValue || 0;
          const equityPercent = valuation?.equityPercent || 0;
          const maxOffer = Math.floor(estimatedValue * 0.7);
          const loanToValue = valuation?.ltv || 0;
          const currentEquity = valuation?.equityCurrentEstimatedBalance || 0;

          // Detailed owner information
          let ownerInfo = `**OWNER INFORMATION:**\n`;
          ownerInfo += `Owner Name: ${owner?.fullName || 'Not available'}\n`;
          ownerInfo += `Owner Phone: ${owner?.phoneNumbers?.[0] || 'Not available'}\n`;
          ownerInfo += `Owner Email: ${owner?.emailAddresses?.[0] || 'Not available'}\n`;

          if (owner?.mailingAddress) {
            const mailingAddr = `${owner.mailingAddress.street}, ${owner.mailingAddress.city}, ${owner.mailingAddress.state} ${owner.mailingAddress.zip}`;
            const isDifferent = mailingAddr.toLowerCase() !== propertyAddress.toLowerCase();
            ownerInfo += `Mailing Address: ${mailingAddr}\n`;
            ownerInfo += `Owner Status: ${isDifferent ? 'Absentee Owner (High motivation potential!)' : 'Owner Occupied'}\n`;
          } else {
            ownerInfo += `Mailing Address: Same as property address\n`;
            ownerInfo += `Owner Status: Owner Occupied\n`;
          }

          // Mortgage and lien information
          let mortgageInfo = `**MORTGAGE & LIEN INFORMATION:**\n`;
          if (openLien?.totalOpenLienCount) {
            mortgageInfo += `Total Open Liens: ${openLien.totalOpenLienCount}\n`;
            mortgageInfo += `Total Lien Balance: $${openLien.totalOpenLienBalance?.toLocaleString() || 'N/A'}\n`;

            if (openLien.mortgages && openLien.mortgages.length > 0) {
              mortgageInfo += `Primary Mortgage:\n`;
              const firstMortgage = openLien.mortgages[0];
              mortgageInfo += `  • Lender: ${firstMortgage.lenderName || firstMortgage.assignedLenderName || 'N/A'}\n`;
              mortgageInfo += `  • Original Amount: $${firstMortgage.loanAmount?.toLocaleString() || 'N/A'}\n`;
              mortgageInfo += `  • Current Balance: $${firstMortgage.currentEstimatedBalance?.toLocaleString() || 'N/A'}\n`;
              mortgageInfo += `  • Interest Rate: ${firstMortgage.currentEstimatedInterestRate || 'N/A'}%\n`;
              mortgageInfo += `  • Monthly Payment: $${firstMortgage.estimatedPaymentAmount?.toLocaleString() || 'N/A'}\n`;
            }
          } else {
            mortgageInfo += `No open liens found - Property may be FREE AND CLEAR!\n`;
          }

          // Motivation indicators with detailed analysis
          const motivationFactors = [];
          let motivationScore = 50;

          if (quickLists.preforeclosure) {
            motivationFactors.push('🚨 PRE-FORECLOSURE - URGENT!');
            motivationScore += 35;
          }
          if (quickLists.vacant) {
            motivationFactors.push('🏚️ VACANT PROPERTY');
            motivationScore += 25;
          }
          if (quickLists.absenteeOwner) {
            motivationFactors.push('🏃 ABSENTEE OWNER');
            motivationScore += 20;
          }
          if (quickLists.highEquity) {
            motivationFactors.push('💰 HIGH EQUITY');
            motivationScore += 25;
          }
          if (quickLists.tiredLandlord) {
            motivationFactors.push('😤 TIRED LANDLORD');
            motivationScore += 20;
          }
          if (quickLists.outOfStateOwner) {
            motivationFactors.push('🌎 OUT-OF-STATE OWNER');
            motivationScore += 15;
          }

          motivationScore = Math.min(100, motivationScore);

          const propertyText = `**PROPERTY DETAILS:**\n${propertyAddress}\n${buildingInfo}\nAPN: ${rawProperty.ids?.apn || 'N/A'}\n\n**FINANCIAL ANALYSIS:**\nEstimated Value: $${estimatedValue.toLocaleString()}\nMax Offer (70% Rule): $${maxOffer.toLocaleString()}\nCurrent Equity: $${currentEquity.toLocaleString()}\nEquity Percentage: ${equityPercent}%\nLoan-to-Value: ${loanToValue}%\nConfidence Score: ${valuation?.confidenceScore || 'N/A'}%\nValue Range: $${valuation?.priceRangeMin?.toLocaleString() || 'N/A'} - $${valuation?.priceRangeMax?.toLocaleString() || 'N/A'}\n\n**MOTIVATION SCORE: ${motivationScore}/100**\n${motivationFactors.join('\n') || 'Standard property'}\n\n${ownerInfo}\n${mortgageInfo}`;

          // Additional foreclosure details
          let foreclosureInfo = "";
          if (foreclosure) {
            foreclosureInfo = `\n**🚨 FORECLOSURE DETAILS - TIME SENSITIVE! 🚨**\nStatus: ${foreclosure.status}\nUnpaid Balance: $${foreclosure.unpaidBalance?.toLocaleString() || 'N/A'}\nAuction Date: ${foreclosure.auctionDate ? new Date(foreclosure.auctionDate).toLocaleDateString() : 'TBD'}\nAuction Time: ${foreclosure.auctionTime || 'TBD'}\nAuction Location: ${foreclosure.auctionLocation || 'TBD'}\nCase Number: ${foreclosure.caseNumber}\nTrustee: ${foreclosure.trusteeName}\nTrustee Phone: ${foreclosure.trusteePhone}\nBorrower: ${foreclosure.borrowerName}\n`;
          }

          let qualityNote = "";
          if (result.filtered > 0) {
            qualityNote = `\n✅ Data Quality: Filtered out ${result.filtered} properties with incomplete data to show you only actionable leads.`;
          }

          const aiResponse = `💡 This is LIVE property data from BatchData API with complete owner and mortgage details! ${result.hasMore ? "Say 'next' to see another property." : "This was the only quality property found."}`;

          // Also convert for storage format
          const convertedProperty = batchLeadsService.convertToProperty(result.property, 'demo-user');

          res.json({
            response: aiResponse,
            property: convertedProperty,
            sessionState: { ...result.sessionState, searchCriteria: sessionState.searchCriteria },
            hasMore: result.hasMore
          });
        } else {
          res.json({
            response: `No more properties found in your current search. Try a new search with different criteria!`,
            hasMore: false
          });
        }
      } else if (isPropertySearch) {
        // Enhanced location extraction - prioritize wizard format and exact matches
        let location = '17112'; // Default fallback

        // First check for ZIP codes - most precise
        const zipMatch = message.match(/(\d{5})/);
        if (zipMatch) {
          location = zipMatch[1];
          console.log(`📍 Using ZIP code: ${location}`);
        } else {
          // Try different city,state patterns - prioritize comma-separated format from wizard
          const exactCityStateMatch = message.match(/in\s+([\w\s\-'\.]+),\s*([A-Z]{2})\b/i);
          const looseCityStateMatch = message.match(/in\s+([\w\s\-'\.]+)\s+([A-Z]{2})\b/i);
          const cityOnlyMatch = message.match(/in\s+([\w\s\-'\.]+?)(?:\s+(?:with|under|at|\d+)|$)/i);

          if (exactCityStateMatch) {
            // Exact "City, ST" format from wizard
            location = `${exactCityStateMatch[1].trim()}, ${exactCityStateMatch[2].trim()}`;
            console.log(`📍 Using exact city,state format: ${location}`);
          } else if (looseCityStateMatch) {
            // "City ST" format
            location = `${looseCityStateMatch[1].trim()}, ${looseCityStateMatch[2].trim()}`;
            console.log(`📍 Using city state format: ${location}`);
          } else if (cityOnlyMatch && cityOnlyMatch[1].length > 2) {
            const cityName = cityOnlyMatch[1].trim();
            // Add PA as default for known PA cities
            const paCities = ['harrisburg', 'hershey', 'philadelphia', 'pittsburgh', 'allentown', 'erie', 'valley forge', 'king of prussia', 'west chester'];
            if (paCities.includes(cityName.toLowerCase())) {
              location = `${cityName}, PA`;
              console.log(`📍 Using known PA city: ${location}`);
            } else {
              location = cityName;
              console.log(`📍 Using city name only: ${location}`);
            }
          }
        }

        console.log(`🔍 Searching for properties in: "${location}"`);

        const { batchLeadsService } = await import("./batchleads");

        // Determine search criteria based on query content
        const searchCriteria: any = { location };

        // Map seller types to BatchLeads quicklists
        if (message.toLowerCase().includes('distressed') || 
            message.toLowerCase().includes('pre-foreclosure') || 
            message.toLowerCase().includes('vacant')) {
          searchCriteria.quickLists = ['preforeclosure', 'vacant'];
        } else if (message.toLowerCase().includes('absentee') || 
                   message.toLowerCase().includes('out-of-state') || 
                   message.toLowerCase().includes('non-resident')) {
          searchCriteria.quickLists = ['absentee-owner', 'out-of-state-owner'];
        } else if (message.toLowerCase().includes('corporate owned')) {
          searchCriteria.quickLists = ['corporate-owned'];
        } else if (message.toLowerCase().includes('tired landlord')) {
          searchCriteria.quickLists = ['tired-landlord'];
        } else if (message.toLowerCase().includes('motivated seller')) {
          searchCriteria.quickLists = ['absentee-owner', 'high-equity'];
        } else {
          // Default to distressed properties if no specific type is mentioned
          searchCriteria.quickLists = ['absentee-owner'];
        }

        if (message.toLowerCase().includes('high equity') || message.toLowerCase().includes('70%')) {
          searchCriteria.minEquity = 70;
        }

        // Extract price filter - comprehensive pattern matching
        const pricePatterns = [
          /under\s+\$?([0-9,]+)/i,           // "under $500,000" or "under 500000"
          /below\s+\$?([0-9,]+)/i,           // "below $500,000"
          /max\s+\$?([0-9,]+)/i,             // "max $500,000"
          /maximum\s+\$?([0-9,]+)/i,         // "maximum $500,000"
          /\$([0-9,]+)\s*or\s*less/i,        // "$500,000 or less"
          /up\s+to\s+\$?([0-9,]+)/i,         // "up to $500,000"
          /\$([0-9,]+)/                      // any "$500,000" format
        ];
        
        let priceMatch = null;
        for (const pattern of pricePatterns) {
          priceMatch = message.match(pattern);
          if (priceMatch) break;
        }
        
        if (priceMatch) {
          searchCriteria.maxPrice = parseInt(priceMatch[1].replace(/,/g, ''));
          console.log(`💰 ✅ EXTRACTED PRICE FILTER: max $${searchCriteria.maxPrice.toLocaleString()}`);
        } else {
          console.log(`💰 ❌ NO PRICE FILTER FOUND in message: "${message}"`);
        }

        // Extract bedroom filter
        const bedroomMatch = message.match(/at least\s+(\d+)\s+bedrooms?/i);
        if (bedroomMatch) {
          searchCriteria.minBedrooms = parseInt(bedroomMatch[1]);
          console.log(`🛏️ Added bedroom filter: min ${searchCriteria.minBedrooms} bedrooms`);
        }

        if (message.toLowerCase().includes('motivated seller') || message.toLowerCase().includes('multiple indicators')) {
          searchCriteria.distressedOnly = true;
        }



        // Property type - default to single family for most searches
        if (message.toLowerCase().includes('single family')) {
          searchCriteria.propertyType = 'single_family';
        } else if (message.toLowerCase().includes('multi')) {
          searchCriteria.propertyType = 'multi_family';
        } else {
          searchCriteria.propertyType = 'single_family'; // Default
        }

        console.log(`📋 Search criteria:`, searchCriteria);

        // Handle excluded properties from sessionState
        const excludePropertyIds = sessionState?.excludePropertyIds || [];
        console.log(`🚫 Excluding ${excludePropertyIds.length} already shown properties`);

        // Get multiple properties for better user experience  
        const result = await batchLeadsService.searchValidProperties(searchCriteria, 5, excludePropertyIds);

        console.log(`📊 Search result stats:`, {
          totalChecked: result.totalChecked || 0,
          filtered: result.filtered || 0,
          propertiesFound: result.data.length,
          excludedCount: excludePropertyIds.length
        });

        // If no results found with city name, try with ZIP code fallback
        if (result.data.length === 0 && result.totalChecked === 0 && location.toLowerCase().includes('hershey')) {
          console.log(`🔄 No results for "${location}", trying ZIP code 17033 (Hershey area)`);
          const zipSearchCriteria = { ...searchCriteria, location: '17033' };
          const zipResult = await batchLeadsService.searchValidProperties(zipSearchCriteria, 5);
          result.data = zipResult.data;
          result.totalChecked = zipResult.totalChecked;
          result.filtered = zipResult.filtered;
          result.hasMore = zipResult.hasMore;

          console.log(`📊 ZIP search result stats:`, {
            totalChecked: result.totalChecked,
            filtered: result.filtered,
            propertiesFound: result.data.length
          });
        }

        // Handle single property response
        if (result.data.length === 0) {
          const noResultsMessage = result.totalChecked === 0
            ? `I couldn't find any properties in "${location}". This might be due to:
• Location not recognized by the API (try "Hershey, PA" or a ZIP code like "17033")
• Network connection issues
• API rate limits

Try a different location format or a nearby ZIP code.`
            : `Searched ${result.totalChecked} properties in "${location}", but ${result.filtered} were filtered out due to missing critical data (price, equity, contact info). This ensures you only get actionable wholesale leads with complete information.

Try expanding your search area or checking a nearby city.`;

          res.json({
            response: noResultsMessage
          });
          return;
        }

        // Handle multiple properties response
        console.log(`✅ Final converted properties: ${result.data.length}`);
        
        // Format multiple properties with comprehensive BatchLeads data integration
        let propertiesText = `Great! I found ${result.data.length} distressed properties in "${location}" that could be excellent wholesale opportunities:\n\n`;
        
        result.data.forEach((convertedProperty, index) => {
          console.log(`📝 Formatting property ${index + 1}:`, {
            address: convertedProperty.address,
            arv: convertedProperty.arv,
            owner: convertedProperty.ownerName,
            bedrooms: convertedProperty.bedrooms
          });
          
          propertiesText += `${index + 1}. ${convertedProperty.address}, ${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}\n`;
          propertiesText += `   - **PROPERTY DETAILS:**\n`;
          propertiesText += `   - Est. Value (ARV): $${convertedProperty.arv ? parseInt(convertedProperty.arv).toLocaleString() : 'N/A'}\n`;
          propertiesText += `   - Max Offer (70% Rule): $${convertedProperty.maxOffer ? parseInt(convertedProperty.maxOffer).toLocaleString() : 'N/A'}\n`;
          propertiesText += `   - Building: ${convertedProperty.bedrooms || 'Unknown'}BR/${convertedProperty.bathrooms || 'Unknown'}BA, ${convertedProperty.squareFeet?.toLocaleString() || 'Unknown'} sq ft\n`;
          propertiesText += `   - Year Built: ${convertedProperty.yearBuilt || 'Not available'}\n`;
          propertiesText += `   - Property Type: ${convertedProperty.propertyType || 'Single Family'}\n`;
          propertiesText += `   - **OWNER INFORMATION:**\n`;
          propertiesText += `   - Owner Name: ${convertedProperty.ownerName || 'Available via skip trace'}\n`;
          propertiesText += `   - Owner Phone: ${convertedProperty.ownerPhone || 'Available via skip trace'}\n`;
          propertiesText += `   - Owner Email: ${convertedProperty.ownerEmail || 'Available via skip trace'}\n`;
          propertiesText += `   - Mailing Address: ${convertedProperty.ownerMailingAddress || 'Same as property address'}\n`;
          propertiesText += `   - **FINANCIAL ANALYSIS:**\n`;
          propertiesText += `   - Equity Percentage: ${convertedProperty.equityPercentage || 0}%\n`;
          propertiesText += `   - Motivation Score: ${convertedProperty.motivationScore || 0}/100\n`;
          propertiesText += `   - Lead Type: ${convertedProperty.leadType ? convertedProperty.leadType.replace('_', ' ').toUpperCase() : 'STANDARD'}\n`;
          propertiesText += `   - Distressed Indicator: ${convertedProperty.distressedIndicator ? convertedProperty.distressedIndicator.replace('_', ' ') : 'Standard opportunity'}\n`;
          propertiesText += `   - **SALES HISTORY:**\n`;
          propertiesText += `   - Last Sale Date: ${convertedProperty.lastSaleDate || 'No recent sales'}\n`;
          propertiesText += `   - Last Sale Price: ${convertedProperty.lastSalePrice ? `$${parseInt(convertedProperty.lastSalePrice).toLocaleString()}` : 'Not available'}\n`;
          propertiesText += `   - Status: ${convertedProperty.status || 'New'}\n\n`;
        });

        let qualityNote = "";
        if (result.filtered > 0) {
          qualityNote = `\n✅ Data Quality: Filtered out ${result.filtered} properties with incomplete data to show you only actionable leads.`;
        }

        const aiResponse = propertiesText + qualityNote;
        
        console.log(`📤 Final response length: ${aiResponse.length} characters`);

        res.json({
          response: aiResponse,
          sessionState: { 
            ...sessionState, 
            searchCriteria: searchCriteria,
            excludePropertyIds: [...excludePropertyIds, ...result.data.map(p => p.id)]
          },
          hasMore: result.hasMore
        });
      } else {
        // Regular AI response
        const { generateLeadFinderResponse } = await import("./openai");
        const response = await generateLeadFinderResponse(message, "");
        res.json({ response });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}