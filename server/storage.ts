import { type Property, type InsertProperty, type Contact, type InsertContact, type Conversation, type InsertConversation, type Message, type InsertMessage, type Document, type InsertDocument, type Deal, type InsertDeal, type User, type UpsertUser, type Comp, type InsertComp } from "@shared/schema";
import { db } from "./db";
import { users, properties, contacts, conversations, messages, documents, deals, comps } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Properties
  getProperties(userId: string): Promise<Property[]>;
  getProperty(id: string, userId: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty & { userId: string }): Promise<Property>;
  updateProperty(id: string, userId: string, updates: Partial<Property>): Promise<Property>;
  findDuplicateProperty(userId: string, address: string, city: string, state: string): Promise<Property | undefined>;
  updatePropertyAnalysis(propertyId: string, analysisData: {
    strategy?: string;
    isDeal?: boolean;
    analysisArv?: number;
    rehabCost?: number;
    analysisMaxOfferPrice?: number;
    profitMarginPct?: number;
    riskLevel?: string;
    analysisConfidence?: number;
    keyAssumptions?: any;
    compSummary?: any;
    nextActions?: any;
  }): Promise<Property>;
  deleteProperty(id: string, userId: string): Promise<void>;
  searchProperties(userId: string, criteria: { city?: string; state?: string; status?: string; leadType?: string }): Promise<Property[]>;

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
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation>;

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

  // Comps
  getCompsByProperty(propertyId: string): Promise<Comp[]>;
  createComp(comp: InsertComp): Promise<Comp>;
  updateComp(id: string, updates: Partial<Comp>): Promise<Comp>;
  deleteComp(id: string): Promise<void>;
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
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Properties
  async getProperties(userId: string): Promise<Property[]> {
    return await db.select().from(properties).where(eq(properties.userId, userId));
  }

  async getProperty(id: string, userId: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)));
    return property;
  }

  async createProperty(propertyData: InsertProperty & { userId: string }): Promise<Property> {
    const [property] = await db
      .insert(properties)
      .values(propertyData)
      .returning();
    return property;
  }

  async updateProperty(id: string, userId: string, updates: Partial<Property>): Promise<Property> {
    const [property] = await db
      .update(properties)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(properties.id, id), eq(properties.userId, userId)))
      .returning();
    if (!property) throw new Error("Property not found");
    return property;
  }

  async findDuplicateProperty(userId: string, address: string, city: string, state: string): Promise<Property | undefined> {
    const [property] = await db
      .select()
      .from(properties)
      .where(and(
        eq(properties.userId, userId),
        eq(properties.address, address),
        eq(properties.city, city),
        eq(properties.state, state)
      ));
    return property;
  }

  async updatePropertyAnalysis(propertyId: string, analysisData: {
    strategy?: string;
    isDeal?: boolean;
    analysisArv?: number;
    rehabCost?: number;
    analysisMaxOfferPrice?: number;
    profitMarginPct?: number;
    riskLevel?: string;
    analysisConfidence?: number;
    keyAssumptions?: any;
    compSummary?: any;
    nextActions?: any;
  }): Promise<Property> {
    const updateData = {
      ...analysisData,
      // Convert number to string for decimal fields if they exist
      profitMarginPct: analysisData.profitMarginPct?.toString(),
      analysisConfidence: analysisData.analysisConfidence?.toString(),
      updatedAt: new Date()
    };
    
    const [property] = await db
      .update(properties)
      .set(updateData)
      .where(eq(properties.id, propertyId))
      .returning();
    if (!property) throw new Error("Property not found");
    return property;
  }

  async deleteProperty(id: string, userId: string): Promise<void> {
    await db
      .delete(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)));
  }

  async searchProperties(userId: string, criteria: { city?: string; state?: string; status?: string; leadType?: string }): Promise<Property[]> {
    const conditions = [eq(properties.userId, userId)];
    
    if (criteria.city) {
      conditions.push(eq(properties.city, criteria.city));
    }
    if (criteria.state) {
      conditions.push(eq(properties.state, criteria.state));
    }
    if (criteria.status) {
      conditions.push(eq(properties.status, criteria.status));
    }
    if (criteria.leadType) {
      conditions.push(eq(properties.leadType, criteria.leadType));
    }
    
    return await db.select().from(properties).where(and(...conditions));
  }

  // Contacts
  async getContacts(userId: string): Promise<Contact[]> {
    const results = await db
      .select({
        id: contacts.id,
        propertyId: contacts.propertyId,
        name: contacts.name,
        phone: contacts.phone,
        email: contacts.email,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .leftJoin(properties, eq(contacts.propertyId, properties.id))
      .where(eq(properties.userId, userId));
    
    return results;
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async getContactsByProperty(propertyId: string): Promise<Contact[]> {
    return await db.select().from(contacts).where(eq(contacts.propertyId, propertyId));
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
      .select({
        id: conversations.id,
        propertyId: conversations.propertyId,
        contactId: conversations.contactId,
        agentType: conversations.agentType,
        title: conversations.title,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .leftJoin(properties, eq(conversations.propertyId, properties.id))
      .where(eq(properties.userId, userId));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(conversationData: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(conversationData).returning();
    return conversation;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
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
      .select({
        id: documents.id,
        propertyId: documents.propertyId,
        name: documents.name,
        type: documents.type,
        status: documents.status,
        content: documents.content,
        filePath: documents.filePath,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .leftJoin(properties, eq(documents.propertyId, properties.id))
      .where(eq(properties.userId, userId));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByProperty(propertyId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.propertyId, propertyId));
  }

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(documentData).returning();
    return document;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
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
      .select({
        id: deals.id,
        propertyId: deals.propertyId,
        stage: deals.stage,
        dealValue: deals.dealValue,
        profit: deals.profit,
        closeDate: deals.closeDate,
        notes: deals.notes,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
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
      .select({
        id: deals.id,
        propertyId: deals.propertyId,
        stage: deals.stage,
        dealValue: deals.dealValue,
        profit: deals.profit,
        closeDate: deals.closeDate,
        notes: deals.notes,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .leftJoin(properties, eq(deals.propertyId, properties.id))
      .where(and(eq(deals.stage, stage), eq(properties.userId, userId)));
  }

  // Comps
  async getCompsByProperty(propertyId: string): Promise<Comp[]> {
    return await db.select().from(comps).where(eq(comps.propertyId, propertyId));
  }

  async createComp(compData: InsertComp): Promise<Comp> {
    const [comp] = await db.insert(comps).values(compData).returning();
    return comp;
  }

  async updateComp(id: string, updates: Partial<Comp>): Promise<Comp> {
    const [comp] = await db
      .update(comps)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(comps.id, id))
      .returning();
    if (!comp) throw new Error("Comp not found");
    return comp;
  }

  async deleteComp(id: string): Promise<void> {
    await db.delete(comps).where(eq(comps.id, id));
  }
}

export const storage = new DatabaseStorage();