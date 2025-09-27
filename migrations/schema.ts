import { pgTable, foreignKey, varchar, text, timestamp, index, jsonb, unique, numeric, boolean, integer, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const contacts = pgTable("contacts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	propertyId: varchar("property_id"),
	name: text().notNull(),
	phone: text(),
	email: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "contacts_property_id_properties_id_fk"
		}),
]);

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	preferences: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const conversations = pgTable("conversations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	propertyId: varchar("property_id"),
	contactId: varchar("contact_id"),
	agentType: text("agent_type"),
	title: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "conversations_property_id_properties_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "conversations_contact_id_contacts_id_fk"
		}),
]);

export const deals = pgTable("deals", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	propertyId: varchar("property_id"),
	stage: text().default('lead_generation').notNull(),
	dealValue: numeric("deal_value", { precision: 10, scale:  2 }),
	profit: numeric({ precision: 10, scale:  2 }),
	closeDate: timestamp("close_date", { mode: 'string' }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "deals_property_id_properties_id_fk"
		}),
]);

export const documents = pgTable("documents", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	propertyId: varchar("property_id"),
	name: text().notNull(),
	type: text().notNull(),
	status: text().default('draft').notNull(),
	content: text(),
	filePath: text("file_path"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "documents_property_id_properties_id_fk"
		}),
]);

export const messages = pgTable("messages", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	conversationId: varchar("conversation_id"),
	content: text().notNull(),
	role: text().notNull(),
	isAiGenerated: boolean("is_ai_generated").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}),
]);

export const properties = pgTable("properties", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	address: text().notNull(),
	city: text().notNull(),
	state: text().notNull(),
	zipCode: text("zip_code").notNull(),
	bedrooms: integer(),
	bathrooms: integer(),
	squareFeet: integer("square_feet"),
	arv: numeric({ precision: 10, scale:  2 }),
	maxOffer: numeric("max_offer", { precision: 10, scale:  2 }),
	status: text().default('active'),
	leadType: text("lead_type"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	lastSalePrice: text("last_sale_price"),
	lastSaleDate: text("last_sale_date"),
	ownerName: text("owner_name"),
	ownerPhone: text("owner_phone"),
	ownerEmail: text("owner_email"),
	equityPercentage: integer("equity_percentage"),
	price: numeric({ precision: 10, scale:  2 }),
	condition: text(),
	notes: text(),
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

export const leadDeliveries = pgTable("lead_deliveries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	leadId: uuid("lead_id").notNull(),
	leadRequestId: uuid("lead_request_id"),
	deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_lead_deliveries_unique").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.leadId.asc().nullsLast().op("uuid_ops")),
	index("idx_lead_deliveries_user_delivered").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.deliveredAt.asc().nullsLast().op("uuid_ops")),
]);

export const savedSearches = pgTable("saved_searches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	name: text(),
	criteriaJson: jsonb("criteria_json").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_saved_searches_active").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_saved_searches_created").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("idx_saved_searches_user_type").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.type.asc().nullsLast().op("text_ops")),
]);

export const leads = pgTable("leads", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	vendor: text().default('batchdata').notNull(),
	vendorLeadId: text("vendor_lead_id"),
	type: text().notNull(),
	propertyId: varchar("property_id").notNull(),
	ownerId: varchar("owner_id"),
	metaJson: jsonb("meta_json"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_leads_vendor_id").using("btree", table.vendor.asc().nullsLast().op("text_ops"), table.vendorLeadId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.propertyId],
			foreignColumns: [properties.id],
			name: "leads_property_id_properties_id_fk"
		}),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [owners.id],
			name: "leads_owner_id_owners_id_fk"
		}),
]);

export const leadContacts = pgTable("lead_contacts", {
	leadId: varchar("lead_id").notNull(),
	contactId: varchar("contact_id").notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_lead_contacts").using("btree", table.leadId.asc().nullsLast().op("text_ops"), table.contactId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "lead_contacts_lead_id_leads_id_fk"
		}),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "lead_contacts_contact_id_contacts_id_fk"
		}),
]);

export const leadRequests = pgTable("lead_requests", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	savedSearchId: varchar("saved_search_id"),
	vendor: text().default('batchdata').notNull(),
	requestParams: jsonb("request_params").notNull(),
	requestedCount: integer("requested_count").notNull(),
	respondedCount: integer("responded_count"),
	status: text().default('pending').notNull(),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "lead_requests_user_id_users_id_fk"
		}),
]);

export const owners = pgTable("owners", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	fullName: text("full_name"),
	firstName: text("first_name"),
	lastName: text("last_name"),
	mailingAddress: text("mailing_address"),
	mailingCity: text("mailing_city"),
	mailingState: text("mailing_state"),
	mailingPostal: text("mailing_postal"),
	isIndividual: boolean("is_individual"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const userLeads = pgTable("user_leads", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	leadId: varchar("lead_id").notNull(),
	status: text().notNull(),
	notes: text(),
	tags: text().array(),
	lastActionAt: timestamp("last_action_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_leads_unique").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.leadId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_leads_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "user_leads_lead_id_leads_id_fk"
		}),
]);
