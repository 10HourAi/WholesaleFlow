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
        motivationScore,
        minBedrooms
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

  // Public demo endpoints (no auth required for testing)
  app.get('/api/demo/batchleads/:location?', async (req, res) => {
    try {
      const location = req.params.location || '17112';
      const { batchLeadsService } = await import("./batchleads");
      const response = await batchLeadsService.searchProperties({ location }, 1, 5);
      
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
                               message.toLowerCase().match(/\d+\s+properties/i) ||
                               message.toLowerCase().match(/properties.*philadelphia|philadelphia.*properties/i);
                               
      if (isNextPropertyRequest && sessionState) {
        // User wants the next property in the current search
        const { batchLeadsService } = await import("./batchleads");
        
        const result = await batchLeadsService.getNextValidProperty(sessionState.searchCriteria, sessionState);
        
        if (result.property) {
          const convertedProperty = batchLeadsService.convertToProperty(result.property, 'demo-user');
          
          let contactInfo = `Owner: ${convertedProperty.ownerName || 'Not available'}`;
          if (convertedProperty.ownerMailingAddress) {
            const propertyAddress = `${convertedProperty.address}, ${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}`;
            const isDifferent = convertedProperty.ownerMailingAddress.toLowerCase() !== propertyAddress.toLowerCase();
            contactInfo += `\nMailing Address: ${convertedProperty.ownerMailingAddress}${isDifferent ? ' 🏃 (Absentee)' : ' 🏠 (Owner Occupied)'}`;
          }
          if (convertedProperty.ownerPhone) contactInfo += `\nPhone: ${convertedProperty.ownerPhone}`;
          if (convertedProperty.ownerEmail) contactInfo += `\nEmail: ${convertedProperty.ownerEmail}`;
          
          const propertyText = `**${convertedProperty.address}**\n${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}\nARV: $${parseInt(convertedProperty.arv).toLocaleString()}\nMax Offer: $${parseInt(convertedProperty.maxOffer).toLocaleString()}\nEquity: ${convertedProperty.equityPercentage}%\nMotivation Score: ${convertedProperty.motivationScore}/100\n${contactInfo}\nLead Type: ${convertedProperty.leadType.replace('_', ' ')}`;
          
          res.json({
            response: `Here's your next property:\n\n${propertyText}\n\n${result.hasMore ? "Say 'next' to see another property!" : "That's all the quality properties I found in this search."}`,
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
        // Extract location from message - improved regex
        const locationMatch = message.match(/in\s+([\w\s,]+?)(?:\s|$)/i) || message.match(/(\d{5})/);
        const location = locationMatch ? locationMatch[1].trim() : '17112';
        
        const { batchLeadsService } = await import("./batchleads");
        
        // Determine if this is a distressed property search
        const searchCriteria: any = { location };
        if (message.toLowerCase().includes('distressed')) {
          searchCriteria.distressedOnly = true;
        }
        
        // Extract bedroom requirements
        const bedroomMatch = message.match(/(\d+)\s+bedrooms?/i) || message.match(/at least\s+(\d+)\s+bedrooms?/i);
        if (bedroomMatch) {
          searchCriteria.minBedrooms = parseInt(bedroomMatch[1]);
        }
        
        // Get first property only
        const result = await batchLeadsService.getNextValidProperty(searchCriteria);
        
        if (!result.property) {
          res.json({
            response: `Searched ${result.filtered} properties in ${location}, but all were filtered out due to missing price or equity data. This ensures you only get actionable wholesale leads with complete valuation information.`
          });
          return;
        }
        
        const convertedProperty = batchLeadsService.convertToProperty(result.property, 'demo-user');
        
        let contactInfo = `Owner: ${convertedProperty.ownerName || 'Not available'}`;
        
        // Add mailing address (mark if different from property address)
        if (convertedProperty.ownerMailingAddress) {
          const propertyAddress = `${convertedProperty.address}, ${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}`;
          const isDifferent = convertedProperty.ownerMailingAddress.toLowerCase() !== propertyAddress.toLowerCase();
          contactInfo += `\nMailing Address: ${convertedProperty.ownerMailingAddress}${isDifferent ? ' 🏃 (Absentee)' : ' 🏠 (Owner Occupied)'}`;
        }
        
        if (convertedProperty.ownerPhone) contactInfo += `\nPhone: ${convertedProperty.ownerPhone}`;
        if (convertedProperty.ownerEmail) contactInfo += `\nEmail: ${convertedProperty.ownerEmail}`;
        
        const propertyText = `**${convertedProperty.address}**\n${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}\nARV: $${parseInt(convertedProperty.arv).toLocaleString()}\nMax Offer: $${parseInt(convertedProperty.maxOffer).toLocaleString()}\nEquity: ${convertedProperty.equityPercentage}%\nMotivation Score: ${convertedProperty.motivationScore}/100\n${contactInfo}\nLead Type: ${convertedProperty.leadType.replace('_', ' ')}`;
        
        let qualityNote = "";
        if (result.filtered > 0) {
          qualityNote = `\n\n✅ Data Quality: Filtered out ${result.filtered} properties with incomplete data to show you only actionable leads.`;
        }
        
        const aiResponse = `Here's a quality property in ${location}:\n\n${propertyText}${qualityNote}\n\nThis is a REAL property from BatchData API with complete market data! ${result.hasMore ? "Say 'next' to see another property." : "This was the only quality property found."}`;
        
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
