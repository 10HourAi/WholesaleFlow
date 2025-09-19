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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
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

// Deal Analysis schemas (not database tables, just API types)
export const dealAnalysisRequestSchema = z.object({
  propertyId: z.string().uuid(),
  analysisOptions: z.object({
    includeComps: z.boolean().optional().default(true),
    includeRepairEstimates: z.boolean().optional().default(true),
    includeRentals: z.boolean().optional().default(false),
  }).optional(),
});

export const dealAnalysisResultSchema = z.object({
  propertyId: z.string().uuid(),
  summary: z.string(),
  offerRange: z.object({
    min: z.number(),
    max: z.number(),
    recommended: z.number(),
  }),
  repairEstimates: z.object({
    cosmetic: z.number(),
    structural: z.number(),
    total: z.number(),
    confidence: z.enum(["low", "medium", "high"]),
  }),
  financialProjection: z.object({
    purchasePrice: z.number(),
    repairCosts: z.number(),
    totalInvestment: z.number(),
    arv: z.number(),
    estimatedProfit: z.number(),
    profitMargin: z.number(),
  }),
  marketAnalysis: z.object({
    compsSummary: z.string(),
    marketTrend: z.enum(["declining", "stable", "improving"]),
    avgDaysOnMarket: z.number().optional(),
    pricePerSqFt: z.number().optional(),
  }),
  riskFactors: z.array(z.string()),
  timeline: z.object({
    acquisitionDays: z.number(),
    repairDays: z.number(),
    saleDays: z.number(),
    totalDays: z.number(),
  }),
  exitStrategies: z.array(z.object({
    strategy: z.enum(["wholesale", "fix_and_flip", "rental", "owner_finance"]),
    roi: z.number(),
    notes: z.string(),
  })),
  notes: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  analysisDate: z.string(),
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
