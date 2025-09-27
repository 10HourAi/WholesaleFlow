import { relations } from "drizzle-orm/relations";
import { properties, contacts, conversations, deals, documents, messages, leads, owners, leadContacts, users, leadRequests, userLeads } from "./schema";

export const contactsRelations = relations(contacts, ({one, many}) => ({
	property: one(properties, {
		fields: [contacts.propertyId],
		references: [properties.id]
	}),
	conversations: many(conversations),
	leadContacts: many(leadContacts),
}));

export const propertiesRelations = relations(properties, ({many}) => ({
	contacts: many(contacts),
	conversations: many(conversations),
	deals: many(deals),
	documents: many(documents),
	leads: many(leads),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	property: one(properties, {
		fields: [conversations.propertyId],
		references: [properties.id]
	}),
	contact: one(contacts, {
		fields: [conversations.contactId],
		references: [contacts.id]
	}),
	messages: many(messages),
}));

export const dealsRelations = relations(deals, ({one}) => ({
	property: one(properties, {
		fields: [deals.propertyId],
		references: [properties.id]
	}),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	property: one(properties, {
		fields: [documents.propertyId],
		references: [properties.id]
	}),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const leadsRelations = relations(leads, ({one, many}) => ({
	property: one(properties, {
		fields: [leads.propertyId],
		references: [properties.id]
	}),
	owner: one(owners, {
		fields: [leads.ownerId],
		references: [owners.id]
	}),
	leadContacts: many(leadContacts),
	userLeads: many(userLeads),
}));

export const ownersRelations = relations(owners, ({many}) => ({
	leads: many(leads),
}));

export const leadContactsRelations = relations(leadContacts, ({one}) => ({
	lead: one(leads, {
		fields: [leadContacts.leadId],
		references: [leads.id]
	}),
	contact: one(contacts, {
		fields: [leadContacts.contactId],
		references: [contacts.id]
	}),
}));

export const leadRequestsRelations = relations(leadRequests, ({one}) => ({
	user: one(users, {
		fields: [leadRequests.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	leadRequests: many(leadRequests),
	userLeads: many(userLeads),
}));

export const userLeadsRelations = relations(userLeads, ({one}) => ({
	user: one(users, {
		fields: [userLeads.userId],
		references: [users.id]
	}),
	lead: one(leads, {
		fields: [userLeads.leadId],
		references: [leads.id]
	}),
}));