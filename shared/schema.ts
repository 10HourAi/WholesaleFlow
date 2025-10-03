import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: text("password"), // Stores hashed passwords for traditional auth
  preferences: jsonb("preferences"), // Store user preferences and AI agent memory
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const properties = pgTable("properties", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  squareFeet: integer("square_feet"),
  arv: decimal("arv", { precision: 10, scale: 2 }),
  maxOffer: decimal("max_offer", { precision: 10, scale: 2 }),
  status: text("status").default("active"),
  leadType: text("lead_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastSalePrice: text("last_sale_price"),
  lastSaleDate: text("last_sale_date"),
  ownerName: text("owner_name"),
  ownerPhone: text("owner_phone"),
  ownerEmail: text("owner_email"),
  equityPercentage: integer("equity_percentage"),
  price: decimal("price", { precision: 10, scale: 2 }),
  condition: text("condition"),
  notes: text("notes"),
  propertyType: text("property_type"),
  yearBuilt: integer("year_built"),
  ownerMailingAddress: text("owner_mailing_address"),
  ownerDncPhone: text("owner_dnc_phone"),
  ownerLandLine: text("owner_land_line"),
  ownerMobilePhone: text("owner_mobile_phone"),
  confidenceScore: integer("confidence_score"),
  equityBalance: text("equity_balance"),
  distressedIndicator: text("distressed_indicator"),
});

// Owners table
export const owners = pgTable("owners", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fullName: text("full_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  mailingAddress: text("mailing_address"),
  mailingCity: text("mailing_city"),
  mailingState: text("mailing_state"),
  mailingPostal: text("mailing_postal"),
  isIndividual: boolean("is_individual"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contacts table
export const contacts = pgTable("contacts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id"),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Leads table
export const leads = pgTable(
  "leads",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    vendor: text("vendor").notNull().default("batchdata"),
    vendorLeadId: text("vendor_lead_id"),
    type: text("type").notNull(), // 'buyer' or 'seller'
    propertyId: varchar("property_id")
      .references(() => properties.id)
      .notNull(),
    ownerId: varchar("owner_id").references(() => owners.id),
    metaJson: jsonb("meta_json"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_leads_vendor_id").on(table.vendor, table.vendorLeadId),
  ],
);

// Lead contacts junction table
export const leadContacts = pgTable(
  "lead_contacts",
  {
    leadId: varchar("lead_id")
      .references(() => leads.id)
      .notNull(),
    contactId: varchar("contact_id")
      .references(() => contacts.id)
      .notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_lead_contacts").on(table.leadId, table.contactId)],
);

export const conversations = pgTable("conversations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  agentType: text("agent_type"), // lead-finder, deal-analyzer, negotiation, closing
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  content: text("content").notNull(),
  role: text("role").notNull(), // user, assistant, system
  isAiGenerated: boolean("is_ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id),
  stage: text("stage").notNull().default("lead_generation"), // lead_generation, analysis, negotiation, closing
  dealValue: decimal("deal_value", { precision: 10, scale: 2 }),
  profit: decimal("profit", { precision: 10, scale: 2 }),
  closeDate: timestamp("close_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comparable properties (comps) table
export const comps = pgTable("comps", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  address: text("address").notNull(),
  soldPrice: decimal("sold_price", { precision: 10, scale: 2 }).notNull(),
  soldDate: text("sold_date").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  squareFeet: integer("square_feet"),
  pricePerSqft: decimal("price_per_sqft", { precision: 10, scale: 2 }),
  distance: decimal("distance", { precision: 5, scale: 2 }), // Distance in miles from subject property
  similarityScore: integer("similarity_score"), // 0-100 score of how similar to subject property
  daysOnMarket: integer("days_on_market"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

export const insertCompSchema = createInsertSchema(comps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Skip mapping table for pagination tracking
export const skipMapping = pgTable("skip_mapping", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  userSearch: jsonb("user_search").notNull(),
  skip: integer("skip").notNull().default(0),
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertOwner = typeof owners.$inferInsert;
export type InsertLead = typeof leads.$inferInsert;
export type InsertLeadRequest = typeof leadRequests.$inferInsert;
export type InsertUserLead = typeof userLeads.$inferInsert;
export type Owner = typeof owners.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadContact = typeof leadContacts.$inferSelect;
export type LeadRequest = typeof leadRequests.$inferSelect;
export type UserLead = typeof userLeads.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertComp = z.infer<typeof insertCompSchema>;
export type Comp = typeof comps.$inferSelect;
export type SkipMapping = typeof skipMapping.$inferSelect;
export type InsertSkipMapping = typeof skipMapping.$inferInsert;

// Lead deliveries - tracks which leads have been shown to which users (prevents duplicates)
export const leadDeliveries = pgTable(
  "lead_deliveries",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    leadId: varchar("lead_id")
      .references(() => leads.id)
      .notNull(),
    leadRequestId: varchar("lead_request_id"),
    deliveredAt: timestamp("delivered_at").defaultNow(),
  },
  (table) => [
    index("idx_lead_deliveries_user_delivered").on(
      table.userId,
      table.deliveredAt,
    ),
    index("idx_lead_deliveries_unique").on(table.userId, table.leadId),
  ],
);

// Lead requests table
export const leadRequests = pgTable("lead_requests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  savedSearchId: varchar("saved_search_id").references(() => savedSearches.id),
  vendor: text("vendor").notNull().default("batchdata"),
  requestParams: jsonb("request_params").notNull(),
  requestedCount: integer("requested_count").notNull(),
  respondedCount: integer("responded_count"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User leads table
export const userLeads = pgTable(
  "user_leads",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    leadId: varchar("lead_id")
      .references(() => leads.id)
      .notNull(),
    status: text("status").notNull(), // 'saved', 'passed', 'archived'
    notes: text("notes"),
    tags: text("tags").array(),
    lastActionAt: timestamp("last_action_at").defaultNow(),
  },
  (table) => [index("idx_user_leads_unique").on(table.userId, table.leadId)],
);

// Saved searches - stores user's search configurations from wizard
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    type: text("type").notNull(), // 'buyer' or 'seller'
    name: text("name"),
    criteriaJson: jsonb("criteria_json").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_saved_searches_user_type").on(table.userId, table.type),
    index("idx_saved_searches_active").on(table.userId, table.isActive),
    index("idx_saved_searches_created").on(table.userId, table.createdAt),
  ],
);

export const insertLeadDeliverySchema = createInsertSchema(leadDeliveries).omit(
  {
    id: true,
    deliveredAt: true,
  },
);

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLeadDelivery = z.infer<typeof insertLeadDeliverySchema>;
export type LeadDelivery = typeof leadDeliveries.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;