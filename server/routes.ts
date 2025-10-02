import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import {
  insertPropertySchema,
  insertContactSchema,
  insertConversationSchema,
  insertMessageSchema,
  insertDocumentSchema,
  insertDealSchema,
} from "@shared/schema";
import {
  generateLeadFinderResponse,
  generateDealAnalyzerResponse,
  generateNegotiationResponse,
  generateClosingResponse,
  generatePropertyLeads,
  findCompsWithOpenAI,
} from "./openai";
import { setupAuth, isAuthenticated } from "./replitAuth";
import bcrypt from "bcrypt";

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("🟢 ROUTES FILE LOADED - NEW VERSION WITH SKIP TRACE!");

  // Auth middleware
  await setupAuth(app);

  // Traditional auth endpoints (for email/password)
  app.post("/api/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      console.log("🔐 Signup attempt:", { email, firstName, lastName });

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: "All fields are required",
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email",
        });
      }

      // Hash password with bcrypt
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user with hashed password
      const user = await storage.upsertUser({
        id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
        email,
        password: hashedPassword, // Store hashed password
        firstName,
        lastName,
        profileImageUrl: null,
      });

      console.log("✅ User created successfully:", user.id);
      console.log("🔐 Password hashed and stored securely");

      res.json({ success: true, message: "Account created successfully" });
    } catch (error: any) {
      console.error("❌ Signup error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create account",
      });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      console.log("🔐 Login attempt:", { email });

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Check if user has a password set
      if (!user.password) {
        return res.status(401).json({
          success: false,
          message: "This account does not have a password set. Please use 'Continue with Replit' to login or reset your password.",
        });
      }

      // Verify password with bcrypt
      let isPasswordValid = false;
      try {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } catch (error) {
        console.log("❌ Password comparison error:", error);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      if (!isPasswordValid) {
        console.log("❌ Password verification failed for user:", user.id);
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Clear any logout flag and create fresh session for traditional auth
      (req as any).session.loggedOut = false;
      (req as any).session.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        profileImage: user.profileImageUrl,
      };

      console.log("✅ Login successful:", user.id);
      console.log("🔐 Password verified and session created");

      res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: `${user.firstName} ${user.lastName}`,
          profileImage: user.profileImageUrl,
        },
      });
    } catch (error: any) {
      console.error("❌ Login error:", error);
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req: any, res) => {
    try {
      // Set a logout flag in the session to prevent Replit Auth auto-login
      if (req.session) {
        req.session.loggedOut = true;
        req.session.user = null;
        
        req.session.save((saveErr: any) => {
          if (saveErr) {
            console.error("❌ Session save error:", saveErr);
          }
          
          // Clear the session cookie
          res.clearCookie('connect.sid', { path: '/' });
          console.log("✅ User logged out, session cleared");
          res.json({ success: true, message: "Logged out successfully" });
        });
      } else {
        res.clearCookie('connect.sid', { path: '/' });
        res.json({ success: true, message: "Already logged out" });
      }
    } catch (error: any) {
      console.error("❌ Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to logout",
      });
    }
  });

  // Auth routes - Updated to handle both Replit Auth and traditional sessions
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      // Check if user explicitly logged out
      if (req.session && req.session.loggedOut) {
        console.log("❌ User explicitly logged out, rejecting auth");
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check for traditional session first
      if (req.session && req.session.user) {
        console.log("🔐 Traditional session found:", req.session.user.email);
        return res.json(req.session.user);
      }

      // Check for Repl Auth headers
      const replitUserId = req.headers['x-replit-user-id'] as string;
      const replitUserName = req.headers['x-replit-user-name'] as string;
      const replitUserEmail = req.headers['x-replit-user-email'] as string;
      const replitUserProfileImage = req.headers['x-replit-user-profile-image'] as string;

      if (replitUserId) {
        console.log("🔐 Repl Auth headers found for user:", replitUserName);

        // Clear logout flag when Replit Auth is active
        if (req.session) {
          req.session.loggedOut = false;
        }

        // Try to get or create user in database
        let user = await storage.getUser(replitUserId);
        
        if (!user && replitUserEmail) {
          // Create user if doesn't exist
          await storage.upsertUser({
            id: replitUserId,
            email: replitUserEmail,
            firstName: replitUserName?.split(' ')[0] || '',
            lastName: replitUserName?.split(' ').slice(1).join(' ') || '',
            profileImageUrl: replitUserProfileImage,
          });
          user = await storage.getUser(replitUserId);
        }

        if (user) {
          const userData = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
            profileImage: user.profileImageUrl,
          };
          return res.json(userData);
        }

        // Fallback to header data
        return res.json({
          id: replitUserId,
          email: replitUserEmail,
          name: replitUserName,
          profileImage: replitUserProfileImage,
        });
      }

      // No authentication found
      console.log("❌ No authentication found in request");
      return res.status(401).json({ message: "Unauthorized" });

    } catch (error) {
      console.error("❌ Error fetching user:", error);
      return res.status(401).json({ message: "Unauthorized" });
    }
  });
  // Properties
  app.get("/api/properties", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Repl Auth
      let userId: string;

      if (req.session && req.session.user) {
        // Traditional session
        userId = req.session.user.id;
      } else if (req.headers['x-replit-user-id']) {
        // Repl Auth headers
        userId = req.headers['x-replit-user-id'] as string;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const properties = await storage.getProperties(userId);
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/properties", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Replit Auth sessions
      let userId: string;

      if (req.session && req.session.user) {
        // Traditional session
        userId = req.session.user.id;
      } else if (req.user && req.user.claims) {
        // Replit Auth session
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }
      console.log("🏠 Creating property for user:", userId);
      console.log("🏠 Request body:", req.body);

      // Check for existing property to prevent duplicates
      const existingProperties = await storage.searchProperties(userId, {
        city: req.body.city,
        state: req.body.state,
      });

      const duplicateProperty = existingProperties.find(p =>
        p.address === req.body.address &&
        p.city === req.body.city &&
        p.state === req.body.state
      );

      if (duplicateProperty) {
        console.log("🏠 Duplicate property found, returning existing:", duplicateProperty.id);
        return res.status(200).json({
          ...duplicateProperty,
          message: "Property already exists in your CRM",
        });
      }

      // Clean the data before validation and ADD userId
      const cleanedData = {
        ...req.body,
        userId // Add userId from authenticated user
      };

      // Convert string numbers to actual numbers
      if (cleanedData.bedrooms && typeof cleanedData.bedrooms === 'string') {
        cleanedData.bedrooms = parseInt(cleanedData.bedrooms);
      }
      if (cleanedData.bathrooms && typeof cleanedData.bathrooms === 'string') {
        cleanedData.bathrooms = parseFloat(cleanedData.bathrooms);
      }
      if (cleanedData.squareFeet && typeof cleanedData.squareFeet === 'string') {
        cleanedData.squareFeet = parseInt(cleanedData.squareFeet);
      }
      if (cleanedData.yearBuilt && typeof cleanedData.yearBuilt === 'string') {
        cleanedData.yearBuilt = parseInt(cleanedData.yearBuilt);
      }
      if (cleanedData.equityPercentage && typeof cleanedData.equityPercentage === 'string') {
        cleanedData.equityPercentage = parseInt(cleanedData.equityPercentage);
      }
      if (cleanedData.confidenceScore && typeof cleanedData.confidenceScore === 'string') {
        cleanedData.confidenceScore = parseInt(cleanedData.confidenceScore);
      }

      console.log("🏠 Cleaned data with userId:", cleanedData);

      const validatedData = insertPropertySchema.parse(cleanedData);
      console.log("🏠 Validated data:", validatedData);

      const property = await storage.createProperty(validatedData);

      console.log("🏠 Property created successfully:", property.id);
      res.json(property);
    } catch (error: any) {
      console.error("❌ Property creation error:", error);
      if (error.name === 'ZodError') {
        console.error("❌ Validation errors:", error.errors);
        res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
          details: error.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      } else {
        res.status(400).json({ message: error.message });
      }
    }
  });

  app.get("/api/properties/search", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Replit Auth sessions
      let userId: string;

      if (req.session && req.session.user) {
        // Traditional session
        userId = req.session.user.id;
      } else if (req.user && req.user.claims) {
        // Replit Auth session
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { city, state, status, leadType } = req.query;
      const properties = await storage.searchProperties(userId, {
        city: city as string,
        state: state as string,
        status: status as string,
        leadType: leadType as string,
      });
      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/properties/:id", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Replit Auth sessions
      let userId: string;

      if (req.session && req.session.user) {
        // Traditional session
        userId = req.session.user.id;
      } else if (req.user && req.user.claims) {
        // Replit Auth session
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const property = await storage.updateProperty(
        req.params.id,
        userId,
        req.body,
      );
      res.json(property);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/properties/:id/comps", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Replit Auth sessions
      let userId: string;

      if (req.session && req.session.user) {
        userId = req.session.user.id;
      } else if (req.user && req.user.claims) {
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const propertyId = req.params.id;
      
      // Verify the property belongs to the user
      const property = await storage.getProperty(propertyId, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const comps = await storage.getComps(propertyId);
      res.json(comps);
    } catch (error: any) {
      console.error("❌ Error fetching comps:", error);
      res.status(500).json({ 
        message: "Failed to fetch comps", 
        error: error.message 
      });
    }
  });

  app.post("/api/properties/:id/comps", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Replit Auth sessions
      let userId: string;

      if (req.session && req.session.user) {
        userId = req.session.user.id;
      } else if (req.user && req.user.claims) {
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const propertyId = req.params.id;
      console.log('🏘️ Running comps analysis for property:', propertyId);

      const property = await storage.getProperty(propertyId, userId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      console.log('🧹 Deleting existing comps for property:', propertyId);
      await storage.deleteCompsByProperty(propertyId);

      console.log('🤖 Calling findCompsWithOpenAI...');
      const comps = await findCompsWithOpenAI(property);

      console.log('💾 Saving', comps.length, 'comps to database...');
      const savedComps = [];
      for (const comp of comps) {
        const savedComp = await storage.createComp(comp);
        savedComps.push(savedComp);
      }

      console.log('✅ Successfully saved', savedComps.length, 'comparable properties');
      res.json(savedComps);
    } catch (error: any) {
      console.error("❌ Error running comps analysis:", error);
      res.status(500).json({ 
        message: "Failed to run comps analysis", 
        error: error.message 
      });
    }
  });

  // Google Street View URL generator
  app.get("/api/streetview/:address", async (req: any, res) => {
    try {
      const { address } = req.params;
      const apiKey = process.env.GOOGLE_STREET_VIEW_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ 
          message: "Google Street View API key not configured" 
        });
      }

      // Generate Street View Static API URL
      const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodeURIComponent(address)}&key=${apiKey}`;
      
      res.json({ url: streetViewUrl });
    } catch (error: any) {
      console.error("Error generating street view URL:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Contacts
  app.get("/api/contacts", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Repl Auth
      let userId: string;

      if (req.session && req.session.user) {
        // Traditional session
        userId = req.session.user.id;
      } else if (req.headers['x-replit-user-id']) {
        // Repl Auth headers
        userId = req.headers['x-replit-user-id'] as string;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const contacts = await storage.getContacts(userId);
      res.json(contacts);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contacts", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Repl Auth
      if (!req.session?.user && !req.headers['x-replit-user-id']) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.json(contact);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // BatchData Property Search API - Get detailed property information
  app.post("/api/property-search", isAuthenticated, async (req: any, res) => {
    try {
      console.log("🏠 Property Search API endpoint called");
      const { address, city, state, zipCode } = req.body;

      if (!address || !city || !state) {
        return res.status(400).json({
          message: "Address, city, and state are required",
        });
      }

      console.log(
        `🔍 Searching property details for: ${address}, ${city}, ${state} ${zipCode || ""}`,
      );

      // Call BatchData Property Lookup API for detailed building information
      const lookupRequest = {
        requests: [
          {
            address: {
              street: address,
              city: city,
              state: state,
              zip: zipCode || "",
            },
          },
        ],
      };

      console.log(
        "📋 BatchData Property Lookup API Request:",
        JSON.stringify(lookupRequest, null, 2),
      );

      const response = await fetch(
        "https://api.batchdata.com/api/v1/property/lookup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.BATCHLEADS_API_KEY}`,
          },
          body: JSON.stringify(lookupRequest),
        },
      );

      console.log(
        `🏗️ BatchData Property Lookup API Response Status:`,
        response.status,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `BatchData API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const propertyData = await response.json();

      console.log("🏠 COMPLETE BATCHDATA PROPERTY LOOKUP API RESPONSE:");
      console.log(JSON.stringify(propertyData, null, 2));

      // Extract building data from the response
      const property = propertyData.results?.[0]?.property || {};
      const building = property.building || {};
      const assessment = property.assessment || {};

      // Create formatted response with detailed building information
      const formattedResponse = {
        success: true,
        property: {
          address: {
            street: address,
            city: city,
            state: state,
            zipCode: zipCode,
          },
          building: {
            bedrooms: building.bedroomCount || building.bedrooms || null,
            bathrooms: building.bathroomCount || building.bathrooms || null,
            squareFeet:
              building.totalBuildingAreaSquareFeet ||
              building.livingArea ||
              null,
            yearBuilt:
              building.effectiveYearBuilt || building.yearBuilt || null,
            propertyType: building.propertyType || null,
            lotSize: building.lotSizeSquareFeet || null,
            stories: building.stories || null,
            foundationType: building.foundationType || null,
            heatingType: building.heatingType || null,
            coolingType: building.coolingType || null,
            roofMaterial: building.roofMaterial || null,
            exteriorWallType: building.exteriorWallType || null,
          },
          assessment: {
            totalMarketValue: assessment.totalMarketValue || null,
            landValue: assessment.landValue || null,
            improvementValue: assessment.improvementValue || null,
            assessedYear: assessment.assessedYear || null,
          },
          fullApiResponse: propertyData,
        },
      };

      console.log("✅ Formatted Property Response:");
      console.log(JSON.stringify(formattedResponse, null, 2));

      res.json(formattedResponse);
    } catch (error: any) {
      console.error("❌ Property Search API error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: error.toString(),
      });
    }
  });

  // Conversations
  app.get("/api/conversations", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Replit Auth sessions
      let userId: string;

      if (req.session && req.session.user) {
        // Traditional session
        userId = req.session.user.id;
      } else if (req.user && req.user.claims) {
        // Replit Auth session
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/conversations", async (req: any, res) => {
    try {
      // Check authentication for both traditional and Replit Auth sessions
      let userId: string;

      if (req.session && req.session.user) {
        // Traditional session
        userId = req.session.user.id;
      } else if (req.user && req.user.claims) {
        // Replit Auth session
        userId = req.user.claims.sub;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Messages
  app.get(
    "/api/conversations/:id/messages",
    async (req: any, res) => {
      try {
        // Check authentication for both traditional and Replit Auth sessions
        if (!req.session?.user && !req.user?.claims) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const messages = await storage.getMessagesByConversation(req.params.id);
        res.json(messages);
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  app.post(
    "/api/conversations/:id/messages",
    async (req: any, res) => {
      try {
        // Check authentication for both traditional and Replit Auth sessions
        let userId: string;

        if (req.session && req.session.user) {
          // Traditional session
          userId = req.session.user.id;
        } else if (req.user && req.user.claims) {
          // Replit Auth session
          userId = req.user.claims.sub;
        } else {
          return res.status(401).json({ message: "Unauthorized" });
        }
        const validatedData = insertMessageSchema.parse({
          ...req.body,
          conversationId: req.params.id,
        });
        const userMessage = await storage.createMessage(validatedData);

        // Skip AI responses for wizard-generated messages OR any property search messages
        const isWizardMessage =
          validatedData.content.toLowerCase().includes("find") &&
          validatedData.content.toLowerCase().includes("properties") &&
          (validatedData.content.toLowerCase().includes("distressed") ||
            validatedData.content.toLowerCase().includes("motivated") ||
            validatedData.content.toLowerCase().includes("leads"));

        // Also skip if it looks like any property search to let frontend wizard handle it
        const isAnyPropertySearch =
          validatedData.content
            .toLowerCase()
            .match(/(find|search|show|get)\s+(properties|distressed|leads)/i) ||
          validatedData.content.toLowerCase().includes("properties in") ||
          validatedData.content.match(/\d+\s+properties/i);

        // Generate AI response based on agent type (skip for wizard messages)
        const conversation = await storage.getConversation(req.params.id);
        let aiResponse = "";

        if (conversation && !isWizardMessage && !isAnyPropertySearch) {
          switch (conversation.agentType) {
            case "lead-finder":
              // Check if this is a property search request from Seller Lead Wizard
              const isPropertySearch =
                validatedData.content
                  .toLowerCase()
                  .match(
                    /(find|search|show|get)\s+(properties|distressed|leads)/i,
                  ) ||
                validatedData.content.toLowerCase().includes("properties in") ||
                validatedData.content.match(/\d+\s+properties/i);

              // Check if this is a cash buyer search request from Cash Buyer Wizard
              const isCashBuyerSearch =
                validatedData.content
                  .toLowerCase()
                  .match(
                    /(find|search|show|get)\s+(cash\s+buyers?|buyers?)/i,
                  ) ||
                validatedData.content.toLowerCase().includes("cash buyers in");

              if (isCashBuyerSearch) {
                // Route directly to BatchLeads Cash Buyer API, bypass OpenAI
                const { batchLeadsService } = await import("./batchleads");

                // Extract location from message
                let location = "Orlando, FL"; // Default
                const locationMatch = validatedData.content.match(
                  /in\s+([^,\n]+(?:,\s*[A-Z]{2})?)/i,
                );
                if (locationMatch) {
                  location = locationMatch[1].trim();
                }

                console.log(
                  `💰 ROUTES: About to call BatchLeads Cash Buyer API with location:`,
                  location,
                );
                const results = await batchLeadsService.searchCashBuyersRaw({
                  location,
                  limit: 5,
                });
                console.log(
                  `💰 ROUTES: Cash Buyer API returned:`,
                  JSON.stringify(results, null, 2),
                );

                if (results.buyers.length === 0) {
                  aiResponse = `I couldn't find any qualified cash buyers with 3+ properties in ${location}. Try a different location or check back later as new buyers enter the market regularly.`;
                } else {
                  // Simple response - the frontend wizard will handle the detailed card formatting
                  aiResponse = `Found ${results.buyers.length} qualified cash buyers with 3+ properties in ${location}. Processing individual cards now...`;
                }
              } else if (isPropertySearch) {
                // Seller Lead Wizard will handle the formatted card display
                aiResponse =
                  "I'm ready to help you find motivated sellers! Please use the Seller Lead Wizard above to search for properties with beautiful formatted cards.";
              } else {
                // Non-property search - using dummy response while API is paused
                aiResponse =
                  "I'm here to help you find motivated sellers and distressed properties! Use the Seller Lead Wizard above to search for properties in your target area.";
              }
              break;
            case "deal-analyzer":
              // Using dummy response while API is paused
              aiResponse =
                "I'm the Deal Analyzer Agent! I help analyze property deals and calculate profit potential. All API calls are currently paused - using dummy data for testing.";
              break;
            case "negotiation":
              // Using dummy response while API is paused
              aiResponse =
                "I'm the Negotiation Agent! I help craft compelling offers and negotiate with sellers. All API calls are currently paused - using dummy data for testing.";
              break;
            case "closing":
              // Using dummy response while API is paused
              aiResponse =
                "I'm the Closing Agent! I help manage transactions and prepare closing documents. All API calls are currently paused - using dummy data for testing.";
              break;
            default:
              aiResponse =
                "I'm here to help with your real estate wholesaling needs!";
          }

          // Create AI response message
          const aiMessage = await storage.createMessage({
            conversationId: req.params.id,
            content: aiResponse,
            role: "assistant",
            isAiGenerated: true,
          });

          res.json([userMessage, aiMessage]);
        } else {
          res.json([userMessage]);
        }
      } catch (error: any) {
        console.error("Error in message handler:", error);
        res.status(400).json({ message: error.message });
      }
    },
  );

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
        properties: properties.slice(0, 5),
      });
    } catch (error: any) {
      console.error("BatchLeads test error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: error.toString(),
      });
    }
  });

  // Test Property Search API - No authentication required for testing
  app.post("/api/test/property-search", async (req: any, res) => {
    console.log("🧪 TESTING PROPERTY SEARCH API");

    try {
      // Test with a real property address
      const testRequest = {
        address: "2715 W Lamar Rd",
        city: "Phoenix",
        state: "AZ",
        zipCode: "85017",
      };

      console.log(
        "🏠 Testing Property Search API with:",
        JSON.stringify(testRequest, null, 2),
      );

      // Call BatchData Property Lookup API directly
      const lookupRequest = {
        requests: [
          {
            address: {
              street: testRequest.address,
              city: testRequest.city,
              state: testRequest.state,
              zip: testRequest.zipCode,
            },
          },
        ],
      };

      console.log(
        "📋 BatchData Property Lookup API Request:",
        JSON.stringify(lookupRequest, null, 2),
      );

      const response = await fetch(
        "https://api.batchdata.com/api/v1/property/lookup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.BATCHLEADS_API_KEY}`,
          },
          body: JSON.stringify(lookupRequest),
        },
      );

      console.log(`🏗️ Property Search API Response Status:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `BatchData API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const propertyData = await response.json();

      console.log("🏠 COMPLETE PROPERTY SEARCH API RESPONSE:");
      console.log(JSON.stringify(propertyData, null, 2));

      // Extract and format the data
      const property = propertyData.results?.[0]?.property || {};
      const building = property.building || {};
      const assessment = property.assessment || {};

      const formattedResponse = {
        success: true,
        testAddress: testRequest,
        rawApiResponse: propertyData,
        extractedData: {
          building: {
            bedrooms: building.bedroomCount || building.bedrooms || null,
            bathrooms: building.bathroomCount || building.bathrooms || null,
            squareFeet:
              building.totalBuildingAreaSquareFeet ||
              building.livingArea ||
              null,
            yearBuilt:
              building.effectiveYearBuilt || building.yearBuilt || null,
            propertyType: building.propertyType || null,
            lotSize: building.lotSizeSquareFeet || null,
            stories: building.stories || null,
            foundationType: building.foundationType || null,
            heatingType: building.heatingType || null,
            coolingType: building.coolingType || null,
            roofMaterial: building.roofMaterial || null,
            exteriorWallType: building.exteriorWallType || null,
          },
          assessment: {
            totalMarketValue: assessment.totalMarketValue || null,
            landValue: assessment.landValue || null,
            improvementValue: assessment.improvementValue || null,
            assessedYear: assessment.assessedYear || null,
          },
        },
      };

      console.log("✅ FORMATTED PROPERTY SEARCH RESPONSE:");
      console.log(JSON.stringify(formattedResponse, null, 2));

      res.json(formattedResponse);
    } catch (error: any) {
      console.error("❌ Property Search API test error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
        error: error.toString(),
      });
    }
  });

  // BatchLeads Property Search
  app.post("/api/properties/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        location,
        maxPrice,
        minEquity,
        propertyType,
        distressedOnly,
        motivationScore,
      } = req.body;

      const { batchLeadsService } = await import("./batchleads");
      const results = await batchLeadsService.searchProperties({
        location,
        maxPrice,
        minEquity,
        propertyType,
        distressedOnly,
        motivationScore,
      });

      // Convert BatchLeads properties to our format and save them
      const savedProperties = [];
      for (const batchProperty of results.data.slice(0, 10)) {
        // Limit to first 10 results
        const propertyData = batchLeadsService.convertToProperty(
          batchProperty,
          userId,
        );
        if (propertyData !== null) {
          // Only save valid properties
          const property = await storage.createProperty(propertyData);
          savedProperties.push(property);
        }
      }

      res.json({
        properties: savedProperties,
        total: results.total_results,
        page: results.page,
      });
    } catch (error: any) {
      console.error("Property search error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get Distressed Properties
  app.post(
    "/api/properties/distressed",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { location } = req.body;

        const { batchLeadsService } = await import("./batchleads");
        const distressedProperties =
          await batchLeadsService.getDistressedProperties(location);

        // Convert and save distressed properties
        const savedProperties = [];
        for (const batchProperty of distressedProperties) {
          const propertyData = batchLeadsService.convertToProperty(
            batchProperty,
            userId,
          );
          const property = await storage.createProperty(propertyData);
          savedProperties.push(property);
        }

        res.json(savedProperties);
      } catch (error: any) {
        console.error("Distressed properties error:", error);
        res.status(500).json({ message: error.message });
      }
    },
  );

  // TEST ENDPOINT TO GET ACTUAL CONTACT ENRICHMENT RESPONSE (NO AUTH FOR TESTING)
  app.post("/api/test/contact-enrichment", async (req: any, res) => {
    console.log("🟢 TEST ROUTE HIT - MAKING REAL CONTACT ENRICHMENT CALL!");

    try {
      // Test with one of the actual Phoenix properties
      const testRequest = {
        requests: [
          {
            propertyAddress: {
              street: "13402 S 38th Pl",
              city: "Phoenix",
              state: "AZ",
              zip: "85044",
            },
            ownerName: "Test Owner",
          },
        ],
      };

      console.log("📞 Making BatchData Contact Enrichment API call...");
      const response = await fetch(
        "https://api.batchdata.com/api/v1/property/lookup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.BATCHLEADS_API_KEY}`,
          },
          body: JSON.stringify(testRequest),
        },
      );

      console.log(
        "📞 BatchData Contact Enrichment Response Status:",
        response.status,
      );
      const originalEnrichmentData = await response.json();
      console.log(
        "📞 FULL BATCHDATA CONTACT ENRICHMENT RESPONSE:",
        JSON.stringify(originalEnrichmentData, null, 2),
      );

      res.json({
        message: "Contact enrichment test completed",
        status: response.status,
        data: originalEnrichmentData,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.log("❌ Contact enrichment test error:", error);
      res
        .status(500)
        .json({ error: error.message || "Unknown error occurred" });
    }
  });

  // DIRECT CONTACT ENRICHMENT TEST - BYPASS COMPLEX ROUTING
  app.post("/api/properties/batch-test", async (req: any, res) => {
    console.log("🟢 DIRECT CONTACT ENRICHMENT TEST ROUTE HIT!");

    try {
      // Test with hardcoded Phoenix property
      const testProperty = {
        address: "2715 W Lamar Rd",
        city: "Phoenix",
        state: "AZ",
        zipCode: "85017",
        ownerName: "Kosani Gerard",
      };

      console.log(
        "📞 Testing both Property Lookup and Contact Enrichment endpoints...",
      );

      // Test 1: Try Property Lookup API (as shown in your documentation)
      const propertyLookupRequest = {
        requests: [
          {
            address: {
              street: testProperty.address,
              city: testProperty.city,
              state: testProperty.state,
              zip: testProperty.zipCode,
            },
          },
        ],
      };

      console.log("📞 Testing Property Lookup API first...");
      const propertyLookupResponse = await fetch(
        "https://api.batchdata.com/api/v1/property/lookup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.BATCHLEADS_API_KEY}`,
          },
          body: JSON.stringify(propertyLookupRequest),
        },
      );

      const lookupData = await propertyLookupResponse.json();

      console.log(
        "📞 Property Lookup API Response:",
        JSON.stringify(lookupData, null, 2),
      );

      // Check if the API returned an error in the response body
      const isLookupSuccess = lookupData.status?.code === 200;

      if (!isLookupSuccess) {
        console.log("❌ Property Lookup failed");
        return res.json({
          success: false,
          error: {
            code: lookupData.status?.code,
            message: `Property Lookup failed: ${lookupData.status?.message}`,
          },
          originalProperty: testProperty,
          propertyLookupResponse: lookupData,
        });
      }

      // Use property lookup data
      const enrichmentData = lookupData;

      console.log("📞 PROPERTY LOOKUP SUCCESS");

      // Extract contact data from property lookup response structure
      const owner =
        enrichmentData.results?.owner ||
        enrichmentData.results?.persons?.[0] ||
        {};
      const enrichedProperty = {
        ...testProperty,
        // Property Lookup Contact Data structure
        ownerPhone: owner?.phoneNumbers?.[0]?.number || null,
        ownerEmail: owner?.emails?.[0]?.email || owner?.emails?.[0] || null,
        phoneNumbers:
          owner?.phoneNumbers?.map((phone: any) => ({
            number: phone?.number || phone,
            reachable:
              phone?.reachable || phone?.status === "verified" || false,
            dnc: phone?.dnc || phone?.type === "dnc" || false,
            type: phone?.type || "unknown",
          })) || [],
        emails:
          owner?.emails
            ?.map((email: any) =>
              typeof email === "string" ? email : email?.email,
            )
            .filter(Boolean) || [],
      };

      res.json({
        success: true,
        originalProperty: testProperty,
        enrichedProperty: enrichedProperty,
        fullPropertyLookupResponse: enrichmentData,
      });
    } catch (error: any) {
      console.log("❌ Property lookup test error:", error);
      res
        .status(500)
        .json({ error: error.message || "Unknown error occurred" });
    }
  });

  // Get multiple properties at once - WITH LEAD DELIVERY DEDUPLICATION & AUTO-SAVE SEARCH
  app.post("/api/properties/batch", async (req: any, res) => {
    console.log(
      "🔥🔥🔥 ENHANCED BATCH ROUTE WITH LEAD DELIVERIES - TIMESTAMP:",
      new Date().toISOString(),
    );
    try {
      // Check authentication for both traditional and Replit Auth sessions
      let userId: string;

      if (req.session && req.session.user) {
        // Traditional session
        userId = req.session.user.id;
        console.log("🔐 Using traditional session userId:", userId);
      } else if (req.user && req.user.claims) {
        // Replit Auth session
        userId = req.user.claims.sub;
        console.log("🔐 Using Replit Auth session userId:", userId);
      } else {
        console.log("❌ No valid session found");
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { count = 5, criteria = {} } = req.body;

      console.log(
        "🔍 Backend: Starting batch search with lead delivery deduplication",
      );
      console.log("🔍 Backend: User ID:", userId);
      console.log("🔍 Backend: Search criteria:", criteria);

      // Import services
      const { batchLeadsService } = await import("./batchleads");
      const { LeadDeliveryService } = await import("./lead-delivery");
      const leadService = new LeadDeliveryService();

      // Auto-save search data by default (if criteria has location)
      let savedSearchId = null;
      if (criteria.location) {
        try {
          // Generate a descriptive name based on criteria
          const searchName = `${criteria.location}${criteria.sellerType ? ` - ${criteria.sellerType}` : ""}${criteria.propertyType ? ` - ${criteria.propertyType}` : ""}`;

          const savedSearch = await leadService.saveSearch(userId, {
            name: searchName,
            type: "seller", // Default to seller for property searches
            criteriaJson: criteria,
            isActive: true,
          });
          savedSearchId = savedSearch.id;
          console.log(
            "💾 Auto-saved search:",
            savedSearchId,
            "Name:",
            searchName,
          );
        } catch (error) {
          console.error("❌ Failed to auto-save search:", error);
          // Continue with search even if save fails
        }
      }

      // Search and deliver new properties (with automatic deduplication)
      console.log(
        "🚀 ROUTES: Calling searchAndDeliverProperties with deduplication",
      );
      const result = await leadService.searchAndDeliverProperties(
        userId,
        criteria,
        count,
      );

      console.log("🚀 ROUTES: Lead delivery result:", {
        deliveredCount: result.deliveredCount,
        totalAvailable: result.totalAvailable,
        propertiesLength: result.properties.length,
      });

      const responseData = {
        properties: result.properties,
        total: result.totalAvailable,
        delivered: result.deliveredCount,
        savedSearchId,
        message: `Delivered ${result.deliveredCount} new properties (${result.totalAvailable} total found)`,
      };

      console.log("🔍 Backend: Sending response with lead delivery tracking");
      res.json(responseData);
    } catch (error: any) {
      console.error("Batch properties with lead delivery error:", error);
      res.status(500).json({
        properties: [],
        total: 0,
        delivered: 0,
        message: error.message || "Failed to fetch and deliver properties",
      });
    }
  });

  // Serve demo page
  app.get("/demo", (req, res) => {
    res.sendFile(path.join(process.cwd(), "demo.html"));
  });

  // Lead Deliveries API - prevents duplicate leads to same user
  app.get("/api/leads/deliverable", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 5;
      const { LeadDeliveryService } = await import("./lead-delivery");
      const leadService = new LeadDeliveryService();

      const leads = await leadService.getDeliverableLeads(userId, limit);
      res.json(leads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clear delivered leads for testing
  app.delete("/api/leads/delivered", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { LeadDeliveryService } = await import("./lead-delivery");
      const leadService = new LeadDeliveryService();

      const cleared = await leadService.clearDeliveredLeads(userId);
      res.json({
        message: `Cleared ${cleared.length} delivered leads`,
        cleared: cleared.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get delivered leads for a user
  app.get("/api/leads/delivered", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { LeadDeliveryService } = await import("./lead-delivery");
      const leadService = new LeadDeliveryService();

      const deliveredLeads = await leadService.getDeliveredLeads(userId);
      res.json(deliveredLeads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Search and deliver new properties (with deduplication)
  app.post(
    "/api/leads/search-and-deliver",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { criteria, count = 5 } = req.body;
        const { LeadDeliveryService } = await import("./lead-delivery");
        const leadService = new LeadDeliveryService();

        const result = await leadService.searchAndDeliverProperties(
          userId,
          criteria,
          count,
        );
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // Check if a lead has been delivered to user
  app.get(
    "/api/leads/:id/delivered",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { LeadDeliveryService } = await import("./lead-delivery");
        const leadService = new LeadDeliveryService();

        const isDelivered = await leadService.isLeadDelivered(
          userId,
          req.params.id,
        );
        res.json({ isDelivered });
      } catch (error: any) {
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Saved Searches API
  app.get("/api/saved-searches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("🔍 Getting saved searches for user:", userId);

      const { LeadDeliveryService } = await import("./lead-delivery");
      const leadService = new LeadDeliveryService();

      const searches = await leadService.getUserSavedSearches(
        userId,
        req.query.type as "buyer" | "seller",
      );
      console.log("📋 Found saved searches:", searches.length);

      res.json(searches);
    } catch (error: any) {
      console.error("❌ Error getting saved searches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/saved-searches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("💾 Saving search for user:", userId);
      console.log("📋 Search data:", req.body);

      const { LeadDeliveryService } = await import("./lead-delivery");
      const leadService = new LeadDeliveryService();

      const savedSearch = await leadService.saveSearch(userId, req.body);
      console.log("✅ Search saved:", savedSearch.id);

      res.json(savedSearch);
    } catch (error: any) {
      console.error("❌ Error saving search:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/saved-searches/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { LeadDeliveryService } = await import("./lead-delivery");
      const leadService = new LeadDeliveryService();

      const updatedSearch = await leadService.updateSavedSearch(
        userId,
        req.params.id,
        req.body,
      );
      res.json(updatedSearch);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete(
    "/api/saved-searches/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { LeadDeliveryService } = await import("./lead-delivery");
        const leadService = new LeadDeliveryService();

        const deletedSearch = await leadService.deleteSavedSearch(
          userId,
          req.params.id,
        );
        res.json(deletedSearch);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // Execute a saved search
  app.post(
    "/api/saved-searches/:id/execute",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { count = 5 } = req.body;
        const { LeadDeliveryService } = await import("./lead-delivery");
        const leadService = new LeadDeliveryService();

        const result = await leadService.executeSearch(
          userId,
          req.params.id,
          count,
        );
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
      }
    },
  );

  // Debug endpoint - check saved searches table
  app.get(
    "/api/debug/saved-searches",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const { db } = await import("./db");
        const { savedSearches } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");

        // Get all saved searches for this user
        const userSearches = await db
          .select()
          .from(savedSearches)
          .where(eq(savedSearches.userId, userId));

        // Get total count of all saved searches
        const allSearches = await db.select().from(savedSearches);

        res.json({
          user_id: userId,
          user_searches_count: userSearches.length,
          total_searches_count: allSearches.length,
          user_searches: userSearches,
          table_exists: true,
        });
      } catch (error: any) {
        res.status(500).json({
          error: error.message,
          table_exists: false,
        });
      }
    },
  );

  // Debug endpoint to test location formats
  app.get("/api/debug/locations/:location?", async (req, res) => {
    try {
      const location = req.params.location || "17112";
      const { batchLeadsService } = await import("./batchleads");

      // Try multiple formats
      const formats = [
        location,
        location.replace(/\s+/g, ""), // Remove spaces
        location.replace(",", ""), // Remove commas
        "17033", // Hershey ZIP
        "17112", // Default ZIP
      ];

      const results: { [key: string]: any } = {};

      for (const format of formats) {
        try {
          console.log(`Testing format: "${format}"`);
          const response = await batchLeadsService.searchProperties(
            { location: format },
            1,
            5,
          );
          results[format as string] = {
            totalResults: response.total_results,
            propertiesFound: response.data.length,
            success: true,
          };
        } catch (error: any) {
          results[format as string] = {
            error: error.message || "Unknown error occurred",
            success: false,
          };
        }
      }

      res.json({
        originalLocation: location,
        results,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || "Unknown error occurred" });
    }
  });

  // Dedicated Cash Buyer API endpoint - Using mock data for UI testing
  app.post("/api/cash-buyers/search", async (req, res) => {
    try {
      const { location, buyerType = "all_cash_buyers", quickLists, minProperties } = req.body;

      console.log("🔍 Cash buyer search:", {
        location,
        buyerType,
        quickLists,
        minProperties,
      });

      // Generate realistic mock cash buyer data for UI testing
      const mockBuyers = [
        {
          _id: "buyer1",
          address: {
            street: "1425 E Desert Garden Dr",
            city: "Phoenix",
            state: "AZ",
            zip: "85048",
          },
          owner: {
            fullName: "PINNACLE INVESTMENT GROUP LLC",
            emails: ["contact@pinnacleig.com"],
            phoneNumbers: [{ number: "6025551234", type: "business" }],
            mailingAddress: {
              street: "3540 W Sahara Ave Ste 440",
              city: "Las Vegas",
              state: "NV",
              zip: "89102",
            },
          },
          valuation: { estimatedValue: 845000 },
          building: {
            propertyType: "Single Family",
            bedrooms: 4,
            bathrooms: 3,
            squareFeet: 2200,
          },
          sale: { lastSaleDate: "2024-01-15", lastSalePrice: 785000 },
          propertyOwnerProfile: {
            propertiesCount: 12,
            propertiesTotalEstimatedValue: 8500000,
            averagePurchasePrice: 650000,
          },
        },
        {
          _id: "buyer2",
          address: {
            street: "7842 S 19th Ave",
            city: "Phoenix",
            state: "AZ",
            zip: "85041",
          },
          owner: {
            fullName: "DESERT CAPITAL VENTURES",
            emails: ["invest@desertcapital.com"],
            phoneNumbers: [{ number: "6025559876", type: "business" }],
            mailingAddress: {
              street: "7842 S 19th Ave",
              city: "Phoenix",
              state: "AZ",
              zip: "85041",
            },
          },
          valuation: { estimatedValue: 675000 },
          building: {
            propertyType: "Single Family",
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1850,
          },
          sale: { lastSaleDate: "2024-02-28", lastSalePrice: 620000 },
          propertyOwnerProfile: {
            propertiesCount: 8,
            propertiesTotalEstimatedValue: 5200000,
            averagePurchasePrice: 575000,
          },
        },
        {
          _id: "buyer3",
          address: {
            street: "2156 W Union Hills Dr",
            city: "Phoenix",
            state: "AZ",
            zip: "85027",
          },
          owner: {
            fullName: "ARIZONA PORTFOLIO HOLDINGS",
            emails: ["deals@azportfolio.com"],
            phoneNumbers: [
              { number: "6025554567", type: "business" },
              { number: "6025554568", type: "cell", dnc: true },
            ],
            mailingAddress: {
              street: "15950 N Scottsdale Rd Ste 104",
              city: "Scottsdale",
              state: "AZ",
              zip: "85254",
            },
          },
          valuation: { estimatedValue: 925000 },
          building: {
            propertyType: "Single Family",
            bedrooms: 5,
            bathrooms: 3,
            squareFeet: 2650,
          },
          sale: { lastSaleDate: "2023-11-12", lastSalePrice: 875000 },
          propertyOwnerProfile: {
            propertiesCount: 15,
            propertiesTotalEstimatedValue: 12500000,
            averagePurchasePrice: 720000,
          },
        },
      ];

      res.json({
        success: true,
        location: location,
        totalFound: 3,
        returned: 3,
        buyers: mockBuyers,
      });
    } catch (error: any) {
      console.error("Cash buyer search error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch cash buyers",
        buyers: [],
        totalFound: 0,
        returned: 0,
      });
    }
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
          error: "OpenAI API key not configured",
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
          content: msg.content,
        })),
      ];

      console.log("🚀 Calling OpenAI with", messages.length, "messages");
      const response = await openaiService.getChatCompletion(messages);
      console.log(
        "✅ OpenAI response received:",
        response.substring(0, 100) + "...",
      );

      res.json({ response });
    } catch (error: any) {
      console.error("❌ Terry chat error:", error);
      console.error("Error details:", error.message, error.stack);
      res.status(500).json({
        error:
          error.message ||
          "Sorry, I'm having trouble processing your request right now. Please try again.",
      });
    }
  });

  // Debug endpoint for Replit Auth configuration
  app.get("/api/debug/replit-config", async (req, res) => {
    const config = {
      currentHostname: req.hostname,
      replitDomains: process.env.REPLIT_DOMAINS,
      replitDomainsArray: process.env.REPLIT_DOMAINS?.split(",").map(d => d.trim()) || [],
      replId: process.env.REPL_ID,
      isReplit: !!process.env.REPL_ID,
      registeredStrategies: [
        `replitauth:${req.hostname}`,
        ...((process.env.REPLIT_DOMAINS?.split(",").map(d => d.trim()) || []).map(domain => `replitauth:${domain}`))
      ]
    };
    
    res.json(config);
  });

  // Public demo endpoints (no auth required for testing)
  app.get("/api/demo/batchleads/:location?", async (req, res) => {
    try {
      const location = req.params.location || "17112";
      const { batchLeadsService } = await import("./batchleads");
      const response = await batchLeadsService.searchProperties(
        { location },
        1,
        3,
      );

      const convertedProperties = response.data.map((prop) =>
        batchLeadsService.convertToProperty(prop, "demo-user"),
      );

      res.json({
        success: true,
        message: "BatchData API integration working!",
        location: location,
        total_results: response.total_results,
        properties_returned: convertedProperties.length,
        properties: convertedProperties.slice(0, 3).map((p) => ({
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
          ownerName: p.ownerName,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  app.post("/api/demo/chat", async (req, res) => {
    try {
      const { message, agentType = "lead_finder", sessionState } = req.body;

      // Check if this is a "next property" request
      const isNextPropertyRequest = message
        .toLowerCase()
        .match(/(next|another|more|show me another)/i);

      // Enhanced property search detection - much more flexible
      const hasSearchAction = message
        .toLowerCase()
        .match(/(find|search|show|get|locate|display)/i);
      const hasPropertyTerm =
        message
          .toLowerCase()
          .match(/(properties|homes|houses|leads|distressed)/i) ||
        message.toLowerCase().match(/(harrisburg|philadelphia|pa)/i) ||
        message.toLowerCase().includes("absentee") ||
        message.toLowerCase().includes("bedroom") ||
        message.toLowerCase().includes("single-family") ||
        message.toLowerCase().includes("family homes") ||
        message.match(/\d+\s+(properties|homes)/i);

      const isPropertySearch = hasSearchAction && hasPropertyTerm;

      console.log("🔍 Search detection:", {
        message: message.substring(0, 100),
        hasSearchAction,
        hasPropertyTerm,
        isPropertySearch,
        isNextPropertyRequest,
      });

      if (
        isNextPropertyRequest &&
        sessionState &&
        sessionState.searchCriteria
      ) {
        // User wants the next property in the current search
        const { batchLeadsService } = await import("./batchleads");

        const result = await batchLeadsService.getNextValidProperty(
          sessionState.searchCriteria,
          sessionState,
        );

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
          const propertyAddress = `${address?.street || "N/A"}, ${address?.city || "N/A"}, ${address?.state || "N/A"} ${address?.zip || "N/A"}`;

          // Building details with fallbacks
          const buildingDetails = [];
          if (building?.bedrooms)
            buildingDetails.push(`${building.bedrooms}bd`);
          if (building?.bathrooms)
            buildingDetails.push(`${building.bathrooms}ba`);
          if (building?.livingArea)
            buildingDetails.push(
              `${building.livingArea.toLocaleString()} sq ft`,
            );
          if (building?.yearBuilt)
            buildingDetails.push(`Built ${building.yearBuilt}`);
          const buildingInfo =
            buildingDetails.length > 0
              ? buildingDetails.join(" • ")
              : "Building details not in API response";

          // Financial analysis with all valuation data
          const estimatedValue = valuation?.estimatedValue || 0;
          const equityPercent = valuation?.equityPercent || 0;
          const maxOffer = Math.floor(estimatedValue * 0.7);
          const loanToValue = valuation?.ltv || 0;
          const currentEquity = valuation?.equityCurrentEstimatedBalance || 0;

          // Detailed owner information
          let ownerInfo = `**OWNER INFORMATION:**\n`;
          ownerInfo += `Owner Name: ${owner?.fullName || "Not available"}\n`;
          ownerInfo += `Owner Phone: ${owner?.phoneNumbers?.[0] || "Not available"}\n`;
          ownerInfo += `Owner Email: ${owner?.emailAddresses?.[0] || "Not available"}\n`;

          if (owner?.mailingAddress) {
            const mailingAddr = `${owner.mailingAddress.street}, ${owner.mailingAddress.city}, ${owner.mailingAddress.state} ${owner.mailingAddress.zip}`;
            const isDifferent =
              mailingAddr.toLowerCase() !== propertyAddress.toLowerCase();
            ownerInfo += `Mailing Address: ${mailingAddr}\n`;
            ownerInfo += `Owner Status: ${isDifferent ? "Absentee Owner (High motivation potential!)" : "Owner Occupied"}\n`;
          } else {
            ownerInfo += `Mailing Address: Same as property address\n`;
            ownerInfo += `Owner Status: Owner Occupied\n`;
          }

          // Mortgage and lien information
          let mortgageInfo = `**MORTGAGE & LIEN INFORMATION:**\n`;
          if (openLien?.totalOpenLienCount) {
            mortgageInfo += `Total Open Liens: ${openLien.totalOpenLienCount}\n`;
            mortgageInfo += `Total Lien Balance: $${openLien.totalOpenLienBalance?.toLocaleString() || "N/A"}\n`;

            if (openLien.mortgages && openLien.mortgages.length > 0) {
              mortgageInfo += `Primary Mortgage:\n`;
              const firstMortgage = openLien.mortgages[0];
              mortgageInfo += `  • Lender: ${firstMortgage.lenderName || firstMortgage.assignedLenderName || "N/A"}\n`;
              mortgageInfo += `  • Original Amount: $${firstMortgage.loanAmount?.toLocaleString() || "N/A"}\n`;
              mortgageInfo += `  • Current Balance: $${firstMortgage.currentEstimatedBalance?.toLocaleString() || "N/A"}\n`;
              mortgageInfo += `  • Interest Rate: ${firstMortgage.currentEstimatedInterestRate || "N/A"}%\n`;
              mortgageInfo += `  • Monthly Payment: $${firstMortgage.estimatedPaymentAmount?.toLocaleString() || "N/A"}\n`;
            }
          } else {
            mortgageInfo += `No open liens found - Property may be FREE AND CLEAR!\n`;
          }

          // Motivation indicators with detailed analysis
          const motivationFactors = [];
          let motivationScore = 50;

          if (quickLists.preforeclosure) {
            motivationFactors.push("🚨 PRE-FORECLOSURE - URGENT!");
            motivationScore += 35;
          }
          if (quickLists.vacant) {
            motivationFactors.push("🏚️ VACANT PROPERTY");
            motivationScore += 25;
          }
          if (quickLists.absenteeOwner) {
            motivationFactors.push("🏃 ABSENTEE OWNER");
            motivationScore += 20;
          }
          if (quickLists.highEquity) {
            motivationFactors.push("💰 HIGH EQUITY");
            motivationScore += 25;
          }
          if (quickLists.tiredLandlord) {
            motivationFactors.push("😤 TIRED LANDLORD");
            motivationScore += 20;
          }
          if (quickLists.outOfStateOwner) {
            motivationFactors.push("🌎 OUT-OF-STATE OWNER");
            motivationScore += 15;
          }

          motivationScore = Math.min(100, motivationScore);

          const propertyText = `**PROPERTY DETAILS:**\n${propertyAddress}\n${buildingInfo}\nAPN: ${rawProperty.ids?.apn || "N/A"}\n\n**FINANCIAL ANALYSIS:**\nEstimated Value: $${estimatedValue.toLocaleString()}\nMax Offer (70% Rule): $${maxOffer.toLocaleString()}\nCurrent Equity: $${currentEquity.toLocaleString()}\nEquity Percentage: ${equityPercent}%\nLoan-to-Value: ${loanToValue}%\nConfidence Score: ${valuation?.confidenceScore || "N/A"}%\nValue Range: $${valuation?.priceRangeMin?.toLocaleString() || "N/A"} - $${valuation?.priceRangeMax?.toLocaleString() || "N/A"}\n\n**MOTIVATION SCORE: ${motivationScore}/100**\n${motivationFactors.join("\n") || "Standard property"}\n\n${ownerInfo}\n${mortgageInfo}`;

          // Additional foreclosure details
          let foreclosureInfo = "";
          if (foreclosure) {
            foreclosureInfo = `\n**🚨 FORECLOSURE DETAILS - TIME SENSITIVE! 🚨**\nStatus: ${foreclosure.status}\nUnpaid Balance: $${foreclosure.unpaidBalance?.toLocaleString() || "N/A"}\nAuction Date: ${foreclosure.auctionDate ? new Date(foreclosure.auctionDate).toLocaleDateString() : "TBD"}\nAuction Time: ${foreclosure.auctionTime || "TBD"}\nAuction Location: ${foreclosure.auctionLocation || "TBD"}\nCase Number: ${foreclosure.caseNumber}\nTrustee: ${foreclosure.trusteeName}\nTrustee Phone: ${foreclosure.trusteePhone}\nBorrower: ${foreclosure.borrowerName}\n`;
          }

          let qualityNote = "";
          if (result.filtered > 0) {
            qualityNote = `\n✅ Data Quality: Filtered out ${result.filtered} properties with incomplete data to show you only actionable leads.`;
          }

          const aiResponse = `💡 This is LIVE property data from BatchData API with complete owner and mortgage details! ${result.hasMore ? "Say 'next' to see another property." : "This was the only quality property found."}`;

          // Also convert for storage format
          const convertedProperty = batchLeadsService.convertToProperty(
            result.property,
            "demo-user",
          );

          res.json({
            response: aiResponse,
            property: convertedProperty,
            sessionState: {
              ...result.sessionState,
              searchCriteria: sessionState.searchCriteria,
            },
            hasMore: result.hasMore,
          });
        } else {
          res.json({
            response: `No more properties found in your current search. Try a new search with different criteria!`,
            hasMore: false,
          });
        }
      } else if (isPropertySearch) {
        // Enhanced location extraction - prioritize wizard format and exact matches
        let location = "17112"; // Default fallback

        // First check for ZIP codes - most precise
        const zipMatch = message.match(/(\d{5})/);
        if (zipMatch) {
          location = zipMatch[1];
          console.log(`📍 Using ZIP code: ${location}`);
        } else {
          // Try different city,state patterns - prioritize comma-separated format from wizard
          const exactCityStateMatch = message.match(
            /in\s+([\w\s\-'\.]+),\s*([A-Z]{2})\b/i,
          );
          const looseCityStateMatch = message.match(
            /in\s+([\w\s\-'\.]+)\s+([A-Z]{2})\b/i,
          );
          const cityOnlyMatch = message.match(
            /in\s+([\w\s\-'\.]+?)(?:\s+(?:with|under|at|\d+)|$)/i,
          );

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
            const paCities = [
              "harrisburg",
              "hershey",
              "philadelphia",
              "pittsburgh",
              "allentown",
              "erie",
              "valley forge",
              "king of prussia",
              "west chester",
            ];
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

        // Map seller types to BatchLeads quicklists (updated)
        if (
          message.toLowerCase().includes("distressed") ||
          message.toLowerCase().includes("pre-foreclosure") ||
          message.toLowerCase().includes("vacant")
        ) {
          searchCriteria.quickLists = ["preforeclosure", "vacant"];
        } else if (
          message.toLowerCase().includes("absentee") ||
          message.toLowerCase().includes("out-of-state") ||
          message.toLowerCase().includes("non-resident")
        ) {
          searchCriteria.quickLists = ["absentee-owner"];
        } else if (
          message.toLowerCase().includes("high equity") ||
          message.toLowerCase().includes("70%")
        ) {
          searchCriteria.quickLists = ["high-equity", "free-and-clear"];
          searchCriteria.minEquity = 70;
        } else if (message.toLowerCase().includes("inherited")) {
          searchCriteria.quickLists = ["inherited"];
        } else if (message.toLowerCase().includes("tired landlord")) {
          searchCriteria.quickLists = ["tired-landlord"];
        } else if (message.toLowerCase().includes("corporate owned")) {
          searchCriteria.quickLists = ["corporate-owned"];
        } else {
          // Default fallback
          searchCriteria.quickLists = ["absentee-owner"];
        }

        if (
          message.toLowerCase().includes("high equity") ||
          message.toLowerCase().includes("70%")
        ) {
          searchCriteria.minEquity = 70;
        }

        // Extract price filter - comprehensive pattern matching
        const pricePatterns = [
          /under\s+\$?([0-9,]+)/i, // "under $500,000" or "under 500000"
          /below\s+\$?([0-9,]+)/i, // "below $500,000"
          /max\s+\$?([0-9,]+)/i, // "max $500,000"
          /maximum\s+\$?([0-9,]+)/i, // "maximum $500,000"
          /\$([0-9,]+)\s*or\s*less/i, // "$500,000 or less"
          /up\s+to\s+\$?([0-9,]+)/i, // "up to $500,000"
          /\$([0-9,]+)/, // any "$500,000" format
        ];

        let priceMatch = null;
        for (const pattern of pricePatterns) {
          priceMatch = message.match(pattern);
          if (priceMatch) break;
        }

        if (priceMatch) {
          searchCriteria.maxPrice = parseInt(priceMatch[1].replace(/,/g, ""));
          console.log(
            `💰 ✅ EXTRACTED PRICE FILTER: max $${searchCriteria.maxPrice.toLocaleString()}`,
          );
        } else {
          console.log(`💰 ❌ NO PRICE FILTER FOUND in message: "${message}"`);
        }

        // Extract bedroom filter
        const bedroomMatch = message.match(/at least\s+(\d+)\s+bedrooms?/i);
        if (bedroomMatch) {
          searchCriteria.minBedrooms = parseInt(bedroomMatch[1]);
          console.log(
            `🛏️ Added bedroom filter: min ${searchCriteria.minBedrooms} bedrooms`,
          );
        }

        if (
          message.toLowerCase().includes("motivated seller") ||
          message.toLowerCase().includes("multiple indicators")
        ) {
          searchCriteria.distressedOnly = true;
        }

        // Property type - default to single family for most searches
        if (message.toLowerCase().includes("single family")) {
          searchCriteria.propertyType = "single_family";
        } else if (message.toLowerCase().includes("multi")) {
          searchCriteria.propertyType = "multi_family";
        } else {
          searchCriteria.propertyType = "single_family"; // Default
        }

        console.log(`📋 Search criteria:`, searchCriteria);

        // Handle excluded properties from sessionState
        const excludePropertyIds = sessionState?.excludePropertyIds || [];
        console.log(
          `🚫 Excluding ${excludePropertyIds.length} already shown properties`,
        );

        // Get multiple properties for better user experience
        const result = await batchLeadsService.searchValidProperties(
          searchCriteria,
          5,
          excludePropertyIds,
        );

        console.log(`📊 Search result stats:`, {
          totalChecked: result.totalChecked || 0,
          filtered: result.filtered || 0,
          propertiesFound: result.data.length,
          excludedCount: excludePropertyIds.length,
        });

        // If no results found with city name, try with ZIP code fallback
        if (
          result.data.length === 0 &&
          result.totalChecked === 0 &&
          location.toLowerCase().includes("hershey")
        ) {
          console.log(
            `🔄 No results for "${location}", trying ZIP code 17033 (Hershey area)`,
          );
          const zipSearchCriteria = { ...searchCriteria, location: "17033" };
          const zipResult = await batchLeadsService.searchValidProperties(
            zipSearchCriteria,
            5,
          );
          result.data = zipResult.data;
          result.totalChecked = zipResult.totalChecked;
          result.filtered = zipResult.filtered;
          result.hasMore = zipResult.hasMore;

          console.log(`📊 ZIP search result stats:`, {
            totalChecked: result.totalChecked,
            filtered: result.filtered,
            propertiesFound: result.data.length,
          });
        }

        // Handle single property response
        if (result.data.length === 0) {
          const noResultsMessage =
            result.totalChecked === 0
              ? `I couldn't find any properties in "${location}". This might be due to:
• Location not recognized by the API (try "Hershey, PA" or a ZIP code like "17033")
• Network connection issues
• API rate limits

Try a different location format or a nearby ZIP code.`
              : `Searched ${result.totalChecked} properties in "${location}", but ${result.filtered} were filtered out due to missing critical data (price, equity, contact info). This ensures you only get actionable wholesale leads with complete information.

Try expanding your search area or checking a nearby city.`;

          res.json({
            response: noResultsMessage,
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
            bedrooms: convertedProperty.bedrooms,
          });

          propertiesText += `${index + 1}. ${convertedProperty.address}, ${convertedProperty.city}, ${convertedProperty.state} ${convertedProperty.zipCode}\n`;
          propertiesText += `   - **PROPERTY DETAILS:**\n`;
          propertiesText += `   - Est. Value (ARV): $${convertedProperty.arv ? parseInt(convertedProperty.arv).toLocaleString() : "N/A"}\n`;
          propertiesText += `   - Max Offer (70% Rule): $${convertedProperty.maxOffer ? parseInt(convertedProperty.maxOffer).toLocaleString() : "N/A"}\n`;
          propertiesText += `   - Building: ${convertedProperty.bedrooms || "Unknown"}BR/${convertedProperty.bathrooms || "Unknown"}BA, ${convertedProperty.squareFeet?.toLocaleString() || "Unknown"} sq ft\n`;
          propertiesText += `   - Year Built: ${convertedProperty.yearBuilt || "Not available"}\n`;
          propertiesText += `   - Property Type: ${convertedProperty.propertyType || "Single Family"}\n`;
          propertiesText += `   - **OWNER INFORMATION:**\n`;
          propertiesText += `   - Owner Name: ${convertedProperty.ownerName || "Available via skip trace"}\n`;
          propertiesText += `   - Owner Phone: ${convertedProperty.ownerPhone || "Available via skip trace"}\n`;
          propertiesText += `   - Owner Email: ${convertedProperty.ownerEmail || "Available via skip trace"}\n`;
          propertiesText += `   - Mailing Address: ${convertedProperty.ownerMailingAddress || "Same as property address"}\n`;
          propertiesText += `   - **FINANCIAL ANALYSIS:**\n`;
          propertiesText += `   - Equity Percentage: ${convertedProperty.equityPercentage || 0}%\n`;
          propertiesText += `   - Motivation Score: ${convertedProperty.motivationScore || 0}/100\n`;
          propertiesText += `   - Lead Type: ${convertedProperty.leadType ? convertedProperty.leadType.replace("_", " ").toUpperCase() : "STANDARD"}\n`;
          propertiesText += `   - Distressed Indicator: ${convertedProperty.distressedIndicator ? convertedProperty.distressedIndicator.replace("_", " ") : "Standard opportunity"}\n`;
          propertiesText += `   - **SALES HISTORY:**\n`;
          propertiesText += `   - Last Sale Date: ${convertedProperty.lastSaleDate || "No recent sales"}\n`;
          propertiesText += `   - Last Sale Price: ${convertedProperty.lastSalePrice ? `$${parseInt(convertedProperty.lastSalePrice).toLocaleString()}` : "Not available"}\n`;
          propertiesText += `   - Status: ${convertedProperty.status || "New"}\n\n`;
        });

        let qualityNote = "";
        if (result.filtered > 0) {
          qualityNote = `\n✅ Data Quality: Filtered out ${result.filtered} properties with incomplete data to show you only actionable leads.`;
        }

        const aiResponse = propertiesText + qualityNote;

        console.log(
          `📤 Final response length: ${aiResponse.length} characters`,
        );

        res.json({
          response: aiResponse,
          sessionState: {
            ...sessionState,
            searchCriteria: searchCriteria,
            excludePropertyIds: [
              ...excludePropertyIds,
              ...result.data.map((p) => p.id),
            ],
          },
          hasMore: result.hasMore,
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
        error: error.message,
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}