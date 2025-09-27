import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  preferences: jsonb("preferences"), // Store user preferences and AI agent memory
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  address1: text("address1"), // Primary address line
  address2: text("address2"), // Secondary address line  
  address: text("address").notNull(), // Keep existing for compatibility
  city: text("city").notNull(),
  state: text("state").notNull(),
  postalCode: text("postal_code"), // Add postalCode field
  zipCode: text("zip_code").notNull(), // Keep existing for compatibility
  country: text("country").default("US"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  fingerprint: text("fingerprint"), // For deduplication
  statusFlag: text("status_flag"), // not_listed, for_sale, etc.
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  squareFeet: integer("square_feet"),
  arv: text("arv"), // Using text for large numbers
  maxOffer: text("max_offer"), // Using text for large numbers
  status: text("status").notNull().default("new"), // new, contacted, qualified, under_contract, closed
  leadType: text("lead_type"), // foreclosure, motivated_seller, distressed, etc.
  propertyType: text("property_type"), // single_family, condo, townhouse, etc.
  yearBuilt: integer("year_built"),
  lastSalePrice: text("last_sale_price"),
  lastSaleDate: text("last_sale_date"),
  ownerName: text("owner_name"),
  ownerPhone: text("owner_phone"),
  ownerEmail: text("owner_email"),
  ownerMailingAddress: text("owner_mailing_address"),
  ownerDNCPhone: text("owner_dnc_phone"), // Do Not Call phone numbers
  ownerLandLine: text("owner_land_line"), // Land line from contact enrichment
  ownerMobilePhone: text("owner_mobile_phone"), // Mobile phone from contact enrichment
  equityPercentage: integer("equity_percentage"),
  confidenceScore: integer("confidence_score"), // Changed from motivationScore to match BatchData
  equityBalance: text("equity_balance"), // Equity balance from BatchData valuation
  distressedIndicator: text("distressed_indicator"),
  
  // Deal Analysis Results
  strategy: text("strategy"), // wholesale, flip, rental, wholetail
  isDeal: boolean("is_deal"),
  analysisArv: integer("analysis_arv"), // Separate from the text ARV field
  rehabCost: integer("rehab_cost"),
  analysisMaxOfferPrice: integer("analysis_max_offer_price"), // Separate from the text maxOffer field
  profitMarginPct: decimal("profit_margin_pct", { precision: 5, scale: 2 }),
  riskLevel: text("risk_level"), // low, medium, high
  analysisConfidence: decimal("analysis_confidence", { precision: 3, scale: 2 }), // 0.0 to 1.0
  keyAssumptions: jsonb("key_assumptions"), // Array of strings
  compSummary: jsonb("comp_summary"), // Array of comp objects
  nextActions: jsonb("next_actions"), // Array of strings
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  agentType: text("agent_type"), // lead-finder, deal-analyzer, negotiation, closing
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  content: text("content").notNull(),
  role: text("role").notNull(), // user, assistant, system
  isAiGenerated: boolean("is_ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // purchase_agreement, assignment_contract, closing_statement, template
  status: text("status").notNull().default("draft"), // draft, pending, signed, completed
  content: text("content"), // document content or template
  filePath: text("file_path"), // for uploaded files
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id),
  stage: text("stage").notNull().default("lead_generation"), // lead_generation, analysis, negotiation, closing
  dealValue: decimal("deal_value", { precision: 10, scale: 2 }),
  profit: decimal("profit", { precision: 10, scale: 2 }),
  closeDate: timestamp("close_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Deal Analysis schemas (matching OpenAI structured output)
export const dealAnalysisRequestSchema = z.object({
  propertyId: z.string().uuid(),
});

// Comp summary item schema
export const compSummaryItemSchema = z.object({
  addr: z.string(),
  sold_price: z.number(),
  dist_mi: z.number().optional(),
  dom: z.number().optional(), // days on market
});

export const dealAnalysisResultSchema = z.object({
  address: z.string(),
  strategy: z.enum(["wholesale", "flip", "rental", "wholetail"]),
  is_deal: z.boolean(),
  arv: z.number(),
  rehab_cost: z.number(),
  max_offer_price: z.number(),
  profit_margin_pct: z.number(),
  risk_level: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  key_assumptions: z.array(z.string()),
  comp_summary: z.array(compSummaryItemSchema),
  next_actions: z.array(z.string()),
});

export type DealAnalysisRequest = z.infer<typeof dealAnalysisRequestSchema>;
export type DealAnalysisResult = z.infer<typeof dealAnalysisResultSchema>;

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

// Lead delivery and management tables
export const owners = pgTable("owners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  mailingAddress: text("mailing_address"),
  mailingCity: text("mailing_city"),
  mailingState: text("mailing_state"),
  mailingPostal: text("mailing_postal"),
  isIndividual: boolean("is_individual").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendor: text("vendor").notNull(), // batchdata, etc.
  vendorLeadId: text("vendor_lead_id"),
  type: text("type").notNull(), // seller, buyer
  propertyId: varchar("property_id").references(() => properties.id),
  ownerId: varchar("owner_id").references(() => owners.id),
  metaJson: jsonb("meta_json"), // Additional lead metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // buyer, seller
  criteriaJson: jsonb("criteria_json").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leadRequests = pgTable("lead_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  savedSearchId: varchar("saved_search_id").references(() => savedSearches.id),
  vendor: text("vendor").notNull(),
  requestParams: jsonb("request_params"),
  requestedCount: integer("requested_count"),
  respondedCount: integer("responded_count"),
  status: text("status").notNull(), // ok, error, partial
  createdAt: timestamp("created_at").defaultNow(),
});

export const leadDeliveries = pgTable("lead_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  leadId: varchar("lead_id").references(() => leads.id),
  leadRequestId: varchar("lead_request_id").references(() => leadRequests.id),
  deliveredAt: timestamp("delivered_at").defaultNow(),
});

export const userLeads = pgTable("user_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  leadId: varchar("lead_id").references(() => leads.id),
  status: text("status").notNull().default("new"), // new, contacted, qualified, closed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create insert schemas for new tables
export const insertOwnerSchema = createInsertSchema(owners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadRequestSchema = createInsertSchema(leadRequests).omit({
  id: true,
  createdAt: true,
});

export const insertLeadDeliverySchema = createInsertSchema(leadDeliveries).omit({
  id: true,
  deliveredAt: true,
});

export const insertUserLeadSchema = createInsertSchema(userLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types
export type Owner = typeof owners.$inferSelect;
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type LeadRequest = typeof leadRequests.$inferSelect;
export type InsertLeadRequest = z.infer<typeof insertLeadRequestSchema>;
export type LeadDelivery = typeof leadDeliveries.$inferSelect;
export type InsertLeadDelivery = z.infer<typeof insertLeadDeliverySchema>;
export type UserLead = typeof userLeads.$inferSelect;
export type InsertUserLead = z.infer<typeof insertUserLeadSchema>;
