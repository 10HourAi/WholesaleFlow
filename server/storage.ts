import {
  type Property,
  type InsertProperty,
  type Contact,
  type InsertContact,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Document,
  type InsertDocument,
  type Deal,
  type InsertDeal,
  type User,
  type UpsertUser,
  type Lead,
  type InsertLead,
  type Owner,
  type InsertOwner,
  type LeadRequest,
  type InsertLeadRequest,
  type LeadDelivery,
  type InsertLeadDelivery,
  type UserLead,
  type InsertUserLead,
  type SavedSearch,
  type InsertSavedSearch,
} from "@shared/schema";
import { db } from "./db";
import {
  users,
  properties,
  contacts,
  conversations,
  messages,
  documents,
  deals,
  leads,
  owners,
  leadRequests,
  leadDeliveries,
  userLeads,
  savedSearches,
  leadContacts,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Properties
  getProperties(userId: string): Promise<Property[]>;
  getProperty(id: string, userId: string): Promise<Property | undefined>;
  createProperty(
    property: InsertProperty & { userId: string },
  ): Promise<Property>;
  updateProperty(
    id: string,
    userId: string,
    updates: Partial<Property>,
  ): Promise<Property>;
  deleteProperty(id: string, userId: string): Promise<void>;
  searchProperties(
    userId: string,
    criteria: {
      city?: string;
      state?: string;
      status?: string;
      leadType?: string;
    },
  ): Promise<Property[]>;

  // Contacts
  getContacts(userId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactsByProperty(propertyId: string): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact>;

  // Conversations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation>;

  // Messages
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Documents
  getDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByProperty(propertyId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // Deals
  getDeals(userId: string): Promise<Deal[]>;
  getDeal(id: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, updates: Partial<Deal>): Promise<Deal>;
  getDealsByStage(stage: string, userId: string): Promise<Deal[]>;

  // Leads
  getLeads(userId: string): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<Lead>): Promise<Lead>;

  // Owners
  getOwners(): Promise<Owner[]>;
  getOwner(id: string): Promise<Owner | undefined>;
  createOwner(owner: InsertOwner): Promise<Owner>;
  updateOwner(id: string, updates: Partial<Owner>): Promise<Owner>;

  // Lead Requests
  getLeadRequests(userId: string): Promise<LeadRequest[]>;
  getLeadRequest(id: string): Promise<LeadRequest | undefined>;
  createLeadRequest(request: InsertLeadRequest): Promise<LeadRequest>;
  updateLeadRequest(id: string, updates: Partial<LeadRequest>): Promise<LeadRequest>;

  // Lead Deliveries
  getLeadDeliveries(userId: string): Promise<LeadDelivery[]>;
  createLeadDelivery(delivery: InsertLeadDelivery): Promise<LeadDelivery>;

  // User Leads
  getUserLeads(userId: string): Promise<UserLead[]>;
  createUserLead(userLead: InsertUserLead): Promise<UserLead>;
  updateUserLead(id: string, updates: Partial<UserLead>): Promise<UserLead>;

  // Saved Searches
  getSavedSearches(userId: string): Promise<SavedSearch[]>;
  getSavedSearch(id: string): Promise<SavedSearch | undefined>;
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  updateSavedSearch(id: string, updates: Partial<SavedSearch>): Promise<SavedSearch>;
  deleteSavedSearch(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users (Required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          preferences: userData.preferences,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Properties
  async getProperties(userId: string): Promise<Property[]> {
    return await db
      .select()
      .from(properties)
      .where(eq(properties.userId, userId));
  }

  async getProperty(id: string, userId: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)));
    return property;
  }

  async createProperty(
    propertyData: InsertProperty & { userId: string },
  ): Promise<Property> {
    const [property] = await db
      .insert(properties)
      .values(propertyData)
      .returning();
    return property;
  }

  async updateProperty(
    id: string,
    userId: string,
    updates: Partial<Property>,
  ): Promise<Property> {
    const [property] = await db
      .update(properties)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(properties.id, id), eq(properties.userId, userId)))
      .returning();
    if (!property) throw new Error("Property not found");
    return property;
  }

  async deleteProperty(id: string, userId: string): Promise<void> {
    await db
      .delete(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)));
  }

  async searchProperties(
    userId: string,
    criteria: {
      city?: string;
      state?: string;
      status?: string;
      leadType?: string;
    },
  ): Promise<Property[]> {
    let query = db
      .select()
      .from(properties)
      .where(eq(properties.userId, userId));

    if (criteria.city) {
      query = query.where(eq(properties.city, criteria.city));
    }
    if (criteria.state) {
      query = query.where(eq(properties.state, criteria.state));
    }
    if (criteria.status) {
      query = query.where(eq(properties.status, criteria.status));
    }
    if (criteria.leadType) {
      query = query.where(eq(properties.leadType, criteria.leadType));
    }

    return await query;
  }

  // Contacts
  async getContacts(userId: string): Promise<Contact[]> {
    try {
      // Try with full schema first
      const results = await db
        .select({
          id: contacts.id,
          ownerId: contacts.ownerId,
          phoneE164: contacts.phoneE164,
          phoneQuality: contacts.phoneQuality,
          email: contacts.email,
          emailQuality: contacts.emailQuality,
          source: contacts.source,
          createdAt: contacts.createdAt,
        })
        .from(contacts);

      return results;
    } catch (error: any) {
      console.log("⚠️ Contacts schema mismatch, using fallback:", error.message);
      
      // Fallback with basic fields only
      try {
        const results = await db
          .select({
            id: contacts.id,
            ownerId: contacts.ownerId,
            email: contacts.email,
            createdAt: contacts.createdAt,
          })
          .from(contacts);

        return results.map(contact => ({
          ...contact,
          phoneE164: null,
          phoneQuality: null,
          emailQuality: null,
          source: null,
        }));
      } catch (fallbackError: any) {
        console.log("❌ Contacts fallback also failed:", fallbackError.message);
        return [];
      }
    }
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, id));
    return contact;
  }

  async getContactsByProperty(propertyId: string): Promise<Contact[]> {
    // Get contacts through leads relationship since contacts are linked to owners, not directly to properties
    return await db
      .select({
        id: contacts.id,
        ownerId: contacts.ownerId,
        phoneE164: contacts.phoneE164,
        phoneQuality: contacts.phoneQuality,
        email: contacts.email,
        emailQuality: contacts.emailQuality,
        source: contacts.source,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(leads, eq(contacts.ownerId, leads.ownerId))
      .where(eq(leads.propertyId, propertyId));
  }

  async createContact(contactData: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(contactData).returning();
    return contact;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set(updates)
      .where(eq(contacts.id, id))
      .returning();
    if (!contact) throw new Error("Contact not found");
    return contact;
  }

  // Conversations
  async getConversations(userId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .leftJoin(properties, eq(conversations.propertyId, properties.id))
      .where(eq(properties.userId, userId));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(
    conversationData: InsertConversation,
  ): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values(conversationData)
      .returning();
    return conversation;
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>,
  ): Promise<Conversation> {
    const [conversation] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    if (!conversation) throw new Error("Conversation not found");
    return conversation;
  }

  // Messages
  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(messageData).returning();
    return message;
  }

  // Documents
  async getDocuments(userId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .leftJoin(properties, eq(documents.propertyId, properties.id))
      .where(eq(properties.userId, userId));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByProperty(propertyId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.propertyId, propertyId));
  }

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(documentData)
      .returning();
    return document;
  }

  async updateDocument(
    id: string,
    updates: Partial<Document>,
  ): Promise<Document> {
    const [document] = await db
      .update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    if (!document) throw new Error("Document not found");
    return document;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Deals
  async getDeals(userId: string): Promise<Deal[]> {
    return await db
      .select()
      .from(deals)
      .leftJoin(properties, eq(deals.propertyId, properties.id))
      .where(eq(properties.userId, userId));
  }

  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(dealData: InsertDeal): Promise<Deal> {
    const [deal] = await db.insert(deals).values(dealData).returning();
    return deal;
  }

  async updateDeal(id: string, updates: Partial<Deal>): Promise<Deal> {
    const [deal] = await db
      .update(deals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();
    if (!deal) throw new Error("Deal not found");
    return deal;
  }

  async getDealsByStage(stage: string, userId: string): Promise<Deal[]> {
    return await db
      .select()
      .from(deals)
      .leftJoin(properties, eq(deals.propertyId, properties.id))
      .where(and(eq(deals.stage, stage), eq(properties.userId, userId)));
  }

  // Leads
  async getLeads(userId: string): Promise<Lead[]> {
    return await db
      .select()
      .from(leadDeliveries)
      .leftJoin(leads, eq(leadDeliveries.leadId, leads.id))
      .where(eq(leadDeliveries.userId, userId));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(leadData: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(leadData).returning();
    return lead;
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const [lead] = await db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, id))
      .returning();
    if (!lead) throw new Error("Lead not found");
    return lead;
  }

  // Owners
  async getOwners(): Promise<Owner[]> {
    return await db.select().from(owners);
  }

  async getOwner(id: string): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.id, id));
    return owner;
  }

  async createOwner(ownerData: InsertOwner): Promise<Owner> {
    const [owner] = await db.insert(owners).values(ownerData).returning();
    return owner;
  }

  async updateOwner(id: string, updates: Partial<Owner>): Promise<Owner> {
    const [owner] = await db
      .update(owners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(owners.id, id))
      .returning();
    if (!owner) throw new Error("Owner not found");
    return owner;
  }

  // Lead Requests
  async getLeadRequests(userId: string): Promise<LeadRequest[]> {
    return await db
      .select()
      .from(leadRequests)
      .where(eq(leadRequests.userId, userId));
  }

  async getLeadRequest(id: string): Promise<LeadRequest | undefined> {
    const [request] = await db
      .select()
      .from(leadRequests)
      .where(eq(leadRequests.id, id));
    return request;
  }

  async createLeadRequest(requestData: InsertLeadRequest): Promise<LeadRequest> {
    const [request] = await db
      .insert(leadRequests)
      .values(requestData)
      .returning();
    return request;
  }

  async updateLeadRequest(
    id: string,
    updates: Partial<LeadRequest>,
  ): Promise<LeadRequest> {
    const [request] = await db
      .update(leadRequests)
      .set(updates)
      .where(eq(leadRequests.id, id))
      .returning();
    if (!request) throw new Error("Lead request not found");
    return request;
  }

  // Lead Deliveries
  async getLeadDeliveries(userId: string): Promise<LeadDelivery[]> {
    return await db
      .select()
      .from(leadDeliveries)
      .where(eq(leadDeliveries.userId, userId));
  }

  async createLeadDelivery(
    deliveryData: InsertLeadDelivery,
  ): Promise<LeadDelivery> {
    const [delivery] = await db
      .insert(leadDeliveries)
      .values(deliveryData)
      .returning();
    return delivery;
  }

  // User Leads
  async getUserLeads(userId: string): Promise<UserLead[]> {
    return await db
      .select()
      .from(userLeads)
      .where(eq(userLeads.userId, userId));
  }

  async createUserLead(userLeadData: InsertUserLead): Promise<UserLead> {
    const [userLead] = await db
      .insert(userLeads)
      .values(userLeadData)
      .returning();
    return userLead;
  }

  async updateUserLead(
    id: string,
    updates: Partial<UserLead>,
  ): Promise<UserLead> {
    const [userLead] = await db
      .update(userLeads)
      .set({ ...updates, lastActionAt: new Date() })
      .where(eq(userLeads.id, id))
      .returning();
    if (!userLead) throw new Error("User lead not found");
    return userLead;
  }

  // Saved Searches
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId));
  }

  async getSavedSearch(id: string): Promise<SavedSearch | undefined> {
    const [search] = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.id, id));
    return search;
  }

  async createSavedSearch(searchData: InsertSavedSearch): Promise<SavedSearch> {
    const [search] = await db
      .insert(savedSearches)
      .values(searchData)
      .returning();
    return search;
  }

  async updateSavedSearch(
    id: string,
    updates: Partial<SavedSearch>,
  ): Promise<SavedSearch> {
    const [search] = await db
      .update(savedSearches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(savedSearches.id, id))
      .returning();
    if (!search) throw new Error("Saved search not found");
    return search;
  }

  async deleteSavedSearch(id: string): Promise<void> {
    await db.delete(savedSearches).where(eq(savedSearches.id, id));
  }
}

export const storage = new DatabaseStorage();
