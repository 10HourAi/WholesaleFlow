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

      // Generate AI response based on agent type
      const conversation = await storage.getConversation(req.params.id);
      let aiResponse = "";

      if (conversation) {
        switch (conversation.agentType) {
          case "lead-finder":
            aiResponse = await generateLeadFinderResponse(validatedData.content, userId);
            break;
          case "deal-analyzer":
            const property = conversation.propertyId ? await storage.getProperty(conversation.propertyId, userId) : undefined;
            aiResponse = await generateDealAnalyzerResponse(validatedData.content, property);
            break;
          case "negotiation":
            const contact = conversation.contactId ? await storage.getContact(conversation.contactId) : undefined;
            const negotiationProperty = conversation.propertyId ? await storage.getProperty(conversation.propertyId, userId) : undefined;
            aiResponse = await generateNegotiationResponse(validatedData.content, contact, negotiationProperty);
            break;
          case "closing":
            const closingProperty = conversation.propertyId ? await storage.getProperty(conversation.propertyId, userId) : undefined;
            aiResponse = await generateClosingResponse(validatedData.content, closingProperty);
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

  // Get next property one at a time
  app.post("/api/properties/next", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { location, maxPrice, minEquity, propertyType, distressedOnly, motivationScore, minBedrooms, sessionState } = req.body;

      const { batchLeadsService } = await import("./batchleads");
      const result = await batchLeadsService.getNextValidProperty({
        location,
        maxPrice,
        minEquity,
        propertyType,
        distressedOnly,
        motivationScore
      }, sessionState);

      if (result.property) {
        // Convert to our format
        const propertyData = batchLeadsService.convertToProperty(result.property, userId);

        res.json({
          property: propertyData,
          hasMore: result.hasMore,
          sessionState: result.sessionState,
          stats: {
            totalChecked: result.totalChecked,
            filtered: result.filtered
          }
        });
      } else {
        res.json({
          property: null,
          hasMore: false,
          sessionState: result.sessionState,
          stats: {
            totalChecked: result.totalChecked,
            filtered: result.filtered
          }
        });
      }
    } catch (error: any) {
      console.error("Next property error:", error);
      res.status(500).json({ message: error.message });
    }
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

      // Check if this is a property search request
      const isPropertySearch = message.toLowerCase().match(/(find|search|show|get)\s+(properties|distressed|leads)/i) ||
                               message.toLowerCase().includes('properties in') ||
                               message.match(/\d+\s+properties/i) ||
                               message.toLowerCase().match(/properties.*philadelphia|philadelphia.*properties/i);

      if (isNextPropertyRequest && sessionState) {
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

          console.log(`🏠 Displaying property:`, rawProperty._id);

          // Enhanced contact information display
          let contactInfo = `**CONTACT INFORMATION:**\n`;
          contactInfo += `Owner Name: ${owner?.fullName || 'Not available'}\n`;

          // Property vs Mailing Address Analysis  
          const propertyAddress = `${address?.street}, ${address?.city}, ${address?.state} ${address?.zip}`;
          if (owner?.mailingAddress) {
            const mailingAddr = `${owner.mailingAddress.street}, ${owner.mailingAddress.city}, ${owner.mailingAddress.state} ${owner.mailingAddress.zip}`;
            const isDifferent = mailingAddr.toLowerCase() !== propertyAddress.toLowerCase();
            contactInfo += `Property Address: ${propertyAddress}\n`;
            contactInfo += `Mailing Address: ${mailingAddr}\n`;
            contactInfo += `Owner Status: ${isDifferent ? '🏃 Absentee Owner (Lives elsewhere)' : '🏠 Owner Occupied'}\n`;
          } else {
            contactInfo += `Property Address: ${propertyAddress}\n`;
            contactInfo += `Mailing Address: Not available\n`;
          }

          // Contact methods (BatchData doesn't provide phone/email in demo)
          contactInfo += `📞 Phone: Contact data available via skip trace\n`;
          contactInfo += `📧 Email: Contact data available via skip trace\n`;

          // Building details
          const building = rawProperty.building;
          const buildingDetails = [];
          if (building?.bedrooms) buildingDetails.push(`${building.bedrooms}bd`);
          if (building?.bathrooms) buildingDetails.push(`${building.bathrooms}ba`);
          if (building?.livingArea) buildingDetails.push(`${building.livingArea.toLocaleString()} sq ft`);
          if (building?.yearBuilt) buildingDetails.push(`Built ${building.yearBuilt}`);
          const buildingInfo = buildingDetails.length > 0 ? buildingDetails.join(' • ') : 'Building details not available';

          // Financial analysis
          const estimatedValue = valuation?.estimatedValue || 0;
          const equityPercent = valuation?.equityPercent || 0;
          const maxOffer = Math.floor(estimatedValue * 0.7);

          // Motivation indicators
          const motivationFactors = [];
          if (quickLists.preforeclosure) motivationFactors.push('🚨 Pre-foreclosure');
          if (quickLists.vacant) motivationFactors.push('🏚️ Vacant');
          if (quickLists.absenteeOwner) motivationFactors.push('🏃 Absentee Owner');
          if (quickLists.highEquity) motivationFactors.push('💰 High Equity');
          if (foreclosure) motivationFactors.push(`⚖️ Foreclosure Sale: ${foreclosure.auctionDate ? new Date(foreclosure.auctionDate).toLocaleDateString() : 'Scheduled'}`);

          const propertyText = `**PROPERTY DETAILS:**\n${address?.street}\n${address?.city}, ${address?.state} ${address?.zip}\n${buildingInfo}\n\n**FINANCIAL ANALYSIS:**\nEstimated Value: $${estimatedValue.toLocaleString()}\nMax Offer (70% Rule): $${maxOffer.toLocaleString()}\nEquity: ${equityPercent}%\nConfidence Score: ${valuation?.confidenceScore || 'N/A'}%\n\n**MOTIVATION FACTORS:**\n${motivationFactors.join('\n') || 'Standard property'}\n\n${contactInfo}`;

          // Additional foreclosure details
          let foreclosureInfo = "";
          if (foreclosure) {
            foreclosureInfo = `\n**FORECLOSURE DETAILS:**\nStatus: ${foreclosure.status}\nUnpaid Balance: $${foreclosure.unpaidBalance?.toLocaleString() || 'N/A'}\nAuction Date: ${foreclosure.auctionDate ? new Date(foreclosure.auctionDate).toLocaleDateString() : 'TBD'}\nCase Number: ${foreclosure.caseNumber}\nTrustee: ${foreclosure.trusteeName}\n`;
          }

          let qualityNote = "";
          if (result.filtered > 0) {
            qualityNote = `\n✅ Data Quality: Filtered out ${result.filtered} properties with incomplete data to show you only actionable leads.`;
          }

          const aiResponse = `🎯 Found a HIGH-PRIORITY property lead in ${location}:\n\n${propertyText}${foreclosureInfo}${qualityNote}\n\n💡 This is REAL property data from BatchData API with complete market analysis! ${result.hasMore ? "Say 'next' to see another property." : "This was the only quality property found."}`;

          // Also convert for storage format
          const convertedProperty = batchLeadsService.convertToProperty(result.property, 'demo-user');

          res.json({
            response: aiResponse,
            property: convertedProperty,
            sessionState: { ...result.sessionState, searchCriteria },
            hasMore: result.hasMore
          });
        } else {
          res.json({
            response: `No more properties found in your current search. Try a new search with different criteria!`,
            hasMore: false
          });
        }
      } else if (isPropertySearch) {
        // Improved location extraction - handle multiple formats
        let location = '17112'; // Default fallback

        // Try different location patterns
        const cityStateMatch = message.match(/in\s+([\w\s]+),?\s*([A-Z]{2})/i);
        const cityOnlyMatch = message.match(/in\s+([\w\s]+?)(?:\s|$)/i);
        const zipMatch = message.match(/(\d{5})/);

        if (cityStateMatch) {
          location = `${cityStateMatch[1].trim()}, ${cityStateMatch[2].trim()}`;
        } else if (cityOnlyMatch && cityOnlyMatch[1].length > 2) {
          const cityName = cityOnlyMatch[1].trim();
          // Add PA as default state for common PA cities
          if (['hershey', 'philadelphia', 'pittsburgh', 'allentown', 'erie'].includes(cityName.toLowerCase())) {
            location = `${cityName}, PA`;
          } else {
            location = cityName;
          }
        } else if (zipMatch) {
          location = zipMatch[1];
        }

        console.log(`🔍 Searching for properties in: "${location}"`);

        const { batchLeadsService } = await import("./batchleads");

        // Determine if this is a distressed property search
        const searchCriteria: any = { location };
        if (message.toLowerCase().includes('distressed') || message.toLowerCase().includes('motivated')) {
          searchCriteria.distressedOnly = true;
        }

        // Extract bedroom requirements
        const bedroomMatch = message.match(/(\d+)\s+bedrooms?/i) || message.match(/at least\s+(\d+)\s+bedrooms?/i);
        if (bedroomMatch) {
          searchCriteria.minBedrooms = parseInt(bedroomMatch[1]);
        }

        console.log(`📋 Search criteria:`, searchCriteria);

        // Get first property only
        let result = await batchLeadsService.getNextValidProperty(searchCriteria);

        console.log(`📊 Search result stats:`, {
          totalChecked: result.totalChecked,
          filtered: result.filtered,
          hasProperty: !!result.property
        });

        // If no results found with city name, try with ZIP code fallback
        if (!result.property && result.totalChecked === 0 && location.toLowerCase().includes('hershey')) {
          console.log(`🔄 No results for "${location}", trying ZIP code 17033 (Hershey area)`);
          const zipSearchCriteria = { ...searchCriteria, location: '17033' };
          result = await batchLeadsService.getNextValidProperty(zipSearchCriteria);

          console.log(`📊 ZIP search result stats:`, {
            totalChecked: result.totalChecked,
            filtered: result.filtered,
            hasProperty: !!result.property
          });
        }

        if (!result.property) {
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

        const convertedProperty = batchLeadsService.convertToProperty(result.property, 'demo-user');

        // Enhanced contact information display
        let contactInfo = `**CONTACT INFORMATION:**\n`;
        contactInfo += `Owner Name: ${convertedProperty.ownerName || 'Not available'}\n`;

        // Property vs Mailing Address Analysis
        if (convertedProperty.ownerMailingAddress) {
          const propertyAddress = `${convertedProperty.address}, ${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}`;
          const isDifferent = convertedProperty.ownerMailingAddress.toLowerCase() !== propertyAddress.toLowerCase();
          contactInfo += `Property Address: ${propertyAddress}\n`;
          contactInfo += `Mailing Address: ${convertedProperty.ownerMailingAddress}\n`;
          contactInfo += `Owner Status: ${isDifferent ? '🏃 Absentee Owner (Lives elsewhere)' : '🏠 Owner Occupied'}\n`;
        } else {
          contactInfo += `Property Address: ${convertedProperty.address}, ${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}\n`;
          contactInfo += `Mailing Address: Not available\n`;
        }

        // Contact methods
        if (convertedProperty.ownerPhone) {
          contactInfo += `📞 Phone: ${convertedProperty.ownerPhone}\n`;
        } else {
          contactInfo += `📞 Phone: Not available\n`;
        }

        if (convertedProperty.ownerEmail) {
          contactInfo += `📧 Email: ${convertedProperty.ownerEmail}\n`;
        } else {
          contactInfo += `📧 Email: Not available\n`;
        }

        // Format building details with fallbacks for missing data
        const buildingDetails = [];
        if (convertedProperty.bedrooms) buildingDetails.push(`${convertedProperty.bedrooms}bd`);
        if (convertedProperty.bathrooms) buildingDetails.push(`${convertedProperty.bathrooms}ba`);
        if (convertedProperty.squareFeet) buildingDetails.push(`${convertedProperty.squareFeet.toLocaleString()} sq ft`);
        const buildingInfo = buildingDetails.length > 0 ? buildingDetails.join(' • ') : 'Building details not available';

        const propertyText = `**PROPERTY DETAILS:**\n${convertedProperty.address}\n${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}\n${buildingInfo}\n\n**FINANCIAL ANALYSIS:**\nARV: $${parseInt(convertedProperty.arv).toLocaleString()}\nMax Offer (70% Rule): $${parseInt(convertedProperty.maxOffer).toLocaleString()}\nEquity: ${convertedProperty.equityPercentage}%\nMotivation Score: ${convertedProperty.motivationScore}/100\nLead Type: ${convertedProperty.leadType.replace('_', ' ')}\n\n${contactInfo}`;

        let qualityNote = "";
        if (result.filtered > 0) {
          qualityNote = `\n✅ Data Quality: Filtered out ${result.filtered} properties with incomplete data to show you only actionable leads.`;
        }

        const aiResponse = `🎯 Found a quality property lead with complete contact information in ${location}:

${propertyText}${qualityNote}

💡 This is REAL property data from BatchData API with complete market analysis and owner contact details! ${result.hasMore ? "Say 'next' to see another property." : "This was the only quality property found."}`;

        res.json({
          response: aiResponse,
          property: convertedProperty,
          sessionState: { ...result.sessionState, searchCriteria },
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