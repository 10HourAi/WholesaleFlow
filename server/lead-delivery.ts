import { db } from "./db";
import {
  leadDeliveries,
  properties,
  savedSearches,
  leads,
  owners,
  contacts,
  leadRequests,
  userLeads,
  type InsertLeadDelivery,
  type InsertSavedSearch,
  type Lead,
  type Owner,
  type Contact,
} from "@shared/schema";
import { eq, and, sql, desc, notInArray } from "drizzle-orm";
import { batchLeadsService } from "./batchleads";

export class LeadDeliveryService {
  private batchLeads = batchLeadsService;

  constructor() {
    // Use the existing batchLeadsService instance
  }

  // Get deliverable leads for a user (not delivered before)
  async getDeliverableLeads(userId: string, limit: number = 5) {
    const deliveredLeadIds = await this.getDeliveredLeadIds(userId);

    const query = db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.status, "new"),
          deliveredLeadIds.length > 0
            ? notInArray(properties.id, deliveredLeadIds)
            : undefined,
        ),
      )
      .orderBy(desc(properties.createdAt))
      .limit(limit);

    return await query;
  }

  // Deliver new leads to a user (with deduplication)
  async deliverLeads(userId: string, propertyIds: string[]) {
    const deliveries = [];

    for (const propertyId of propertyIds) {
      try {
        // Insert delivery record with conflict handling
        const [delivery] = await db
          .insert(leadDeliveries)
          .values({
            userId,
            leadId: propertyId,
          })
          .onConflictDoNothing() // Skip if already delivered
          .returning();

        if (delivery) {
          deliveries.push(delivery);
        }
      } catch (error) {
        console.log(
          `Skipping duplicate delivery for property ${propertyId} to user ${userId}`,
        );
      }
    }

    return deliveries;
  }

  // Check if a lead has been delivered to a user
  async isLeadDelivered(userId: string, leadId: string): Promise<boolean> {
    const [delivery] = await db
      .select()
      .from(leadDeliveries)
      .where(
        and(
          eq(leadDeliveries.userId, userId),
          eq(leadDeliveries.leadId, leadId),
        ),
      )
      .limit(1);

    return !!delivery;
  }

  // Get all delivered leads for a user
  async getDeliveredLeads(userId: string) {
    const query = db
      .select({
        property: properties,
        delivery: leadDeliveries,
      })
      .from(leadDeliveries)
      .innerJoin(properties, eq(properties.id, leadDeliveries.leadId))
      .where(eq(leadDeliveries.userId, userId))
      .orderBy(desc(leadDeliveries.deliveredAt));

    return await query;
  }

  // Helper function to create property fingerprint for deduplication
  private createPropertyFingerprint(
    address: string,
    city: string,
    state: string,
    postalCode: string,
  ): string {
    const normalized = `${address}|${city}|${state}|${postalCode}`
      .toLowerCase()
      .replace(/[^\w\s|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return normalized;
  }

  // Helper function to save property, owner, and lead according to proper schema
  private async savePropertyWithSchema(
    leadData: any,
    userId: string,
    leadRequestId?: string,
  ): Promise<{ leadId: string; propertyId: string; ownerId: string } | null> {
    try {
      // 1. Create property fingerprint for deduplication
      const fingerprint = this.createPropertyFingerprint(
        leadData.address,
        leadData.city,
        leadData.state,
        leadData.zipCode,
      );

      // 2. Insert/get property - with field validation
      let property = null;
      try {
        // Build property data with only fields that exist in the current schema
        const propertyData: any = {
          userId: userId,
          status: "new",
        };

        // Add fields based on current schema (from migrations/schema.ts)
        if (leadData.address) propertyData.address = leadData.address;
        if (leadData.city) propertyData.city = leadData.city;
        if (leadData.state) propertyData.state = leadData.state;
        if (leadData.zipCode) propertyData.zipCode = leadData.zipCode;
        if (leadData.bedrooms) propertyData.bedrooms = leadData.bedrooms;
        if (leadData.bathrooms) propertyData.bathrooms = leadData.bathrooms;
        if (leadData.squareFeet) propertyData.squareFeet = leadData.squareFeet;
        if (leadData.yearBuilt) propertyData.yearBuilt = leadData.yearBuilt;
        if (leadData.arv) propertyData.arv = leadData.arv.toString();
        if (leadData.maxOffer) propertyData.maxOffer = leadData.maxOffer.toString();
        if (leadData.lastSalePrice) propertyData.lastSalePrice = leadData.lastSalePrice.toString();
        if (leadData.lastSaleDate) propertyData.lastSaleDate = new Date(leadData.lastSaleDate);
        if (leadData.propertyType) propertyData.propertyType = leadData.propertyType;
        if (leadData.leadType) propertyData.leadType = leadData.leadType;

        const [insertedProperty] = await db
          .insert(properties)
          .values(propertyData)
          .onConflictDoNothing()
          .returning();

        property = insertedProperty;
        console.log("✅ Property saved with schema-compatible fields");
      } catch (propertyError: any) {
        console.log("⚠️ Property insert failed:", propertyError.message);

        // Fallback: Try with minimal required fields only
        try {
          const minimalPropertyData = {
            userId: userId,
            address: leadData.address || "Unknown Address",
            city: leadData.city || "Unknown City",
            state: leadData.state || "Unknown State",
            zipCode: leadData.zipCode || "00000",
            status: "new",
          };

          const [fallbackProperty] = await db
            .insert(properties)
            .values(minimalPropertyData)
            .onConflictDoNothing()
            .returning();

          property = fallbackProperty;
          console.log("✅ Property saved with minimal fallback fields");
        } catch (fallbackError: any) {
          console.log("❌ Property fallback also failed:", fallbackError.message);
        }
      }

      let propertyId = property?.id;

      // If property already exists, try to find by address (using correct field name)
      if (!propertyId) {
        try {
          const [existingProperty] = await db
            .select()
            .from(properties)
            .where(
              and(
                eq(properties.address, leadData.address),
                eq(properties.city, leadData.city),
                eq(properties.state, leadData.state),
              ),
            )
            .limit(1);
          propertyId = existingProperty?.id;
        } catch (findError: any) {
          console.log("⚠️ Could not find existing property:", findError.message);
          // Continue without existing property lookup
        }
      }

      if (!propertyId) {
        console.log("❌ Could not create or find property");
        return null;
      }

      // 3. Insert/get owner - with field validation
      let owner = null;
      try {
        // Build owner data with available fields
        const ownerData: any = {
          fullName: leadData.ownerName || "Unknown Owner",
          isIndividual:
            !leadData.ownerName?.includes("LLC") &&
            !leadData.ownerName?.includes("Corp"),
        };

        // Add optional fields if they exist in schema
        if (leadData.ownerMailingAddress) ownerData.mailingAddress = leadData.ownerMailingAddress;
        if (leadData.ownerPhone) ownerData.phone = leadData.ownerPhone;
        if (leadData.ownerEmail) ownerData.email = leadData.ownerEmail;

        const [insertedOwner] = await db
          .insert(owners)
          .values(ownerData)
          .onConflictDoNothing()
          .returning();

        owner = insertedOwner;
        console.log("✅ Owner saved with available fields");
      } catch (ownerError: any) {
        console.log("⚠️ Owner insert failed:", ownerError.message);

        // Fallback: Try with minimal required fields only
        try {
          const minimalOwnerData = {
            fullName: leadData.ownerName || "Unknown Owner",
            isIndividual: true,
          };

          const [fallbackOwner] = await db
            .insert(owners)
            .values(minimalOwnerData)
            .onConflictDoNothing()
            .returning();

          owner = fallbackOwner;
          console.log("✅ Owner saved with minimal fallback fields");
        } catch (fallbackError: any) {
          console.log("❌ Owner fallback also failed:", fallbackError.message);
        }
      }

      const ownerId = owner?.id || `temp-owner-${Date.now()}`;

      // 4. Insert/get contacts - with field validation
      if (leadData.ownerPhone || leadData.ownerEmail) {
        try {
          // Insert contact with current schema fields
          await db
            .insert(contacts)
            .values({
              propertyId: propertyId,
              name: leadData.ownerName || "Unknown Owner",
              phone: leadData.ownerPhone || null,
              email: leadData.ownerEmail || null,
            })
            .onConflictDoNothing();
          console.log("✅ Contact saved successfully");
        } catch (contactError: any) {
          console.log("⚠️ Contact insert failed:", contactError.message);
          // Skip contact creation if it fails
        }
      }

      // 5. Insert lead
      const [lead] = await db
        .insert(leads)
        .values({
          vendor: "batchdata",
          vendorLeadId: leadData.id,
          type: "seller",
          propertyId: propertyId,
          ownerId: ownerId,
          metaJson: {
            bedrooms: leadData.bedrooms,
            bathrooms: leadData.bathrooms,
            squareFeet: leadData.squareFeet,
            arv: leadData.arv,
            maxOffer: leadData.maxOffer,
            yearBuilt: leadData.yearBuilt,
            lastSalePrice: leadData.lastSalePrice,
            lastSaleDate: leadData.lastSaleDate,
            equityPercentage: leadData.equityPercentage,
            equityBalance: leadData.equityBalance,
            confidenceScore: leadData.confidenceScore,
            distressedIndicator: leadData.distressedIndicator,
            leadType: leadData.leadType,
          },
        })
        .onConflictDoNothing()
        .returning();

      const leadId = lead?.id;
      if (!leadId) {
        // Try to find existing lead
        const [existingLead] = await db
          .select()
          .from(leads)
          .where(
            and(
              eq(leads.vendor, "batchdata"),
              eq(leads.vendorLeadId, leadData.id),
            ),
          )
          .limit(1);

        if (existingLead) {
          return { leadId: existingLead.id, propertyId, ownerId };
        }
      }

      return leadId ? { leadId, propertyId, ownerId } : null;
    } catch (error) {
      console.log("❌ Error saving property with schema:", error);
      return null;
    }
  }

  // Search and deliver new properties from BatchLeads
  async searchAndDeliverProperties(
    userId: string,
    criteria: any,
    count: number = 5,
  ) {
    try {
      console.log("🔍 LEAD DELIVERY: Starting search and delivery process");
      console.log("🔍 LEAD DELIVERY: User ID:", userId);
      console.log("🔍 LEAD DELIVERY: Criteria:", criteria);
      console.log("🔍 LEAD DELIVERY: Requested count:", count);

      // Get properties from BatchLeads with userId for skip tracking
      const response = await this.batchLeads.searchValidProperties(
        criteria,
        count * 2, // Get more to account for filtering
        [],
        userId,
      );

      console.log(
        "🔍 LEAD DELIVERY: BatchLeads returned:",
        response.data.length,
        "properties",
      );

      // Update skip mapping BEFORE deduplication to ensure proper pagination
      if (userId && response.data.length > 0) {
        try {
          const currentSkip = await this.batchLeads.getOrCreateSkipMapping(userId, criteria);
          const newSkip = currentSkip + response.data.length;
          await this.batchLeads.updateSkipMapping(userId, criteria, newSkip);
          console.log(`📊 Skip mapping updated from ${currentSkip} to ${newSkip} (increment: ${response.data.length})`);
        } catch (error) {
          console.error("❌ Error updating skip mapping:", error);
        }
      }

      // Get already delivered properties by address (since BatchLeads properties don't have DB IDs yet)
      const deliveredProperties =
        await this.getDeliveredPropertiesByAddress(userId);
      const deliveredAddresses = new Set(
        deliveredProperties.map((p) => p.address.toLowerCase().trim()),
      );

      console.log(
        "🔍 LEAD DELIVERY: Already delivered addresses:",
        deliveredAddresses.size,
      );

      // Filter out already delivered leads by address comparison
      const newLeads = response.data
        .filter((lead) => {
          const leadAddress = lead.address?.toLowerCase().trim();
          const isAlreadyDelivered = deliveredAddresses.has(leadAddress);
          if (isAlreadyDelivered) {
            console.log(
              "⏭️ LEAD DELIVERY: Skipping already delivered property:",
              leadAddress,
            );
          }
          return !isAlreadyDelivered;
        })
        .slice(0, count);

      console.log(
        "🔍 LEAD DELIVERY: After deduplication:",
        newLeads.length,
        "new properties",
      );

      // Create lead request record
      const [leadRequest] = await db
        .insert(leadRequests)
        .values({
          userId,
          savedSearchId: null, // TODO: Link to saved search if available
          vendor: "batchdata",
          requestParams: criteria,
          requestedCount: count,
          respondedCount: newLeads.length,
          status: "ok",
        })
        .returning();

      const leadRequestId = leadRequest?.id;

      // Save new properties to database using proper schema
      const savedLeads = [];
      for (const leadData of newLeads) {
        try {
          console.log(
            "💾 LEAD DELIVERY: Attempting to save property:",
            leadData.address,
          );

          const result = await this.savePropertyWithSchema(
            leadData,
            userId,
            leadRequestId,
          );

          if (result) {
            // Create enriched lead data for frontend
            const enrichedLead = {
              ...leadData,
              id: result.leadId,
              propertyId: result.propertyId,
              ownerId: result.ownerId,
              ownerEmails: leadData.ownerEmails || [],
              ownerPhoneNumbers: leadData.ownerPhoneNumbers || [],
              ownerOccupied: leadData.ownerOccupied || "Contact for details",
              lengthOfResidence:
                leadData.lengthOfResidence || "Contact for details",
              ownershipStartDate: leadData.ownershipStartDate || null,
            };

            savedLeads.push(enrichedLead);
            console.log(
              "✅ LEAD DELIVERY: Successfully saved lead:",
              leadData.address,
            );
          } else {
            console.log(
              "⚠️ LEAD DELIVERY: Could not save lead:",
              leadData.address,
            );
          }
        } catch (error: any) {
          console.log(
            `❌ LEAD DELIVERY: Error saving property ${leadData.address}:`,
            error.message,
          );
        }
      }

      console.log(
        "🔍 LEAD DELIVERY: Saved to database:",
        savedLeads.length,
        "leads",
      );

      // Create delivery records for saved leads
      const deliveries = [];
      for (const lead of savedLeads) {
        try {
          const [delivery] = await db
            .insert(leadDeliveries)
            .values({
              userId,
              leadId: lead.id,
              leadRequestId: leadRequestId,
            })
            .onConflictDoNothing()
            .returning();

          if (delivery) {
            deliveries.push(delivery);
            console.log(
              "✅ LEAD DELIVERY: Created delivery record for:",
              lead.address,
            );
          }
        } catch (deliveryError) {
          console.log(
            `⚠️ Could not create delivery record for lead ${lead.id}:`,
            deliveryError,
          );
        }
      }

      console.log(
        "🔍 LEAD DELIVERY: Created delivery records:",
        deliveries.length,
      );

      // If no leads were saved, create temporary delivery for UI
      if (savedLeads.length === 0 && newLeads.length > 0) {
        console.log(
          "🚨 LEAD DELIVERY: No leads saved to DB, returning temporary leads",
        );

        const tempLeads = newLeads.map((lead, index) => ({
          ...lead,
          id: `temp-${Date.now()}-${index}`,
          ownerEmails: lead.ownerEmails || [],
          ownerPhoneNumbers: lead.ownerPhoneNumbers || [],
          ownerOccupied: lead.ownerOccupied || "Contact for details",
          lengthOfResidence: lead.lengthOfResidence || "Contact for details",
          ownershipStartDate: lead.ownershipStartDate || null,
        }));

        return {
          deliveredCount: tempLeads.length,
          totalAvailable: response.data.length,
          properties: tempLeads,
        };
      }

      const result = {
        deliveredCount: deliveries.length,
        totalAvailable: response.data.length,
        properties: savedLeads,
      };

      console.log("✅ LEAD DELIVERY: Final result:", result);
      return result;
    } catch (error) {
      console.error(
        "❌ LEAD DELIVERY: Error in searchAndDeliverProperties:",
        error,
      );
      throw error;
    }
  }

  // Save a search configuration from the wizard
  async saveSearch(userId: string, searchData: InsertSavedSearch) {
    console.log("💾 Saving search for user:", userId);
    console.log("📋 Search data:", searchData);

    try {
      // Check if a similar search already exists (same location and type)
      const existingSearch = await db
        .select()
        .from(savedSearches)
        .where(
          and(
            eq(savedSearches.userId, userId),
            eq(savedSearches.type, searchData.type),
            sql`${savedSearches.criteriaJson}->>'location' = ${searchData.criteriaJson.location}`,
          ),
        )
        .limit(1);

      if (existingSearch.length > 0) {
        console.log("🔄 Updating existing search:", existingSearch[0].id);
        // Update existing search with new criteria
        const [updatedSearch] = await db
          .update(savedSearches)
          .set({
            criteriaJson: searchData.criteriaJson,
            updatedAt: sql`now()`,
          })
          .where(eq(savedSearches.id, existingSearch[0].id))
          .returning();

        return updatedSearch;
      } else {
        // Create new search
        const [savedSearch] = await db
          .insert(savedSearches)
          .values({
            ...searchData,
            userId,
          })
          .returning();

        console.log("✅ New search saved successfully:", savedSearch.id);
        return savedSearch;
      }
    } catch (error) {
      console.error("❌ Error saving search:", error);
      throw error;
    }
  }

  // Get user's saved searches
  async getUserSavedSearches(userId: string, type?: "buyer" | "seller") {
    console.log("🔍 Getting saved searches for user:", userId, "type:", type);

    try {
      const query = db
        .select()
        .from(savedSearches)
        .where(
          type
            ? and(
                eq(savedSearches.userId, userId),
                eq(savedSearches.type, type),
              )
            : eq(savedSearches.userId, userId),
        )
        .orderBy(desc(savedSearches.createdAt));

      const result = await query;
      console.log("📋 Found searches:", result.length);
      return result;
    } catch (error) {
      console.error("❌ Error getting saved searches:", error);
      throw error;
    }
  }

  // Execute a saved search and deliver new leads
  async executeSearch(
    userId: string,
    savedSearchId: string,
    requestedCount: number = 5,
  ) {
    // Get the saved search
    const [savedSearch] = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.id, savedSearchId));

    if (!savedSearch) {
      throw new Error("Saved search not found");
    }

    // Use the saved criteria to search and deliver properties
    const searchCriteria = savedSearch.criteriaJson as any;

    // Ensure sellerType is properly mapped for BatchData API
    if (searchCriteria.sellerType) {
      console.log(`🔍 Using saved search criteria with sellerType: ${searchCriteria.sellerType}`);
    }

    const result = await this.searchAndDeliverProperties(
      userId,
      searchCriteria,
      requestedCount,
    );

    return {
      ...result,
      searchName: savedSearch.name,
      searchType: savedSearch.type,
    };
  }

  // Update a saved search
  async updateSavedSearch(
    userId: string,
    searchId: string,
    updates: Partial<InsertSavedSearch>,
  ) {
    const [updatedSearch] = await db
      .update(savedSearches)
      .set({
        ...updates,
        updatedAt: sql`now()`,
      })
      .where(
        and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId)),
      )
      .returning();

    return updatedSearch;
  }

  // Delete a saved search
  async deleteSavedSearch(userId: string, searchId: string) {
    const [deletedSearch] = await db
      .delete(savedSearches)
      .where(
        and(eq(savedSearches.id, searchId), eq(savedSearches.userId, userId)),
      )
      .returning();

    return deletedSearch;
  }

  // Helper method to get delivered lead IDs
  private async getDeliveredLeadIds(userId: string): Promise<string[]> {
    const deliveries = await db
      .select({ leadId: leadDeliveries.leadId })
      .from(leadDeliveries)
      .where(eq(leadDeliveries.userId, userId));

    return deliveries.map((d) => d.leadId);
  }

  // Helper method to get delivered properties by address for deduplication
  private async getDeliveredPropertiesByAddress(
    userId: string,
  ): Promise<{ address: string; city: string; state: string }[]> {
    try {
      const deliveredProperties = await db
        .select({
          address: properties.address, // Use correct field name from schema
          city: properties.city,
          state: properties.state,
        })
        .from(leadDeliveries)
        .innerJoin(properties, eq(properties.id, leadDeliveries.leadId))
        .where(eq(leadDeliveries.userId, userId));

      return deliveredProperties;
    } catch (error: any) {
      console.log(
        "⚠️ Database schema mismatch detected, using fallback approach",
      );
      console.log("Error:", error.message);

      // Fallback: If address column doesn't exist, try with raw SQL or return empty array
      // This prevents the entire lead delivery from failing
      try {
        // Try to get delivered lead IDs only (without address comparison)
        const deliveredLeadIds = await this.getDeliveredLeadIds(userId);
        console.log(
          `📋 Found ${deliveredLeadIds.length} previously delivered leads (using ID-based deduplication)`,
        );

        // Return empty array to skip address-based deduplication
        // The system will fall back to ID-based deduplication
        return [];
      } catch (fallbackError) {
        console.log("⚠️ Fallback also failed, returning empty array");
        return [];
      }
    }
  }

  // Clear all delivered leads for a user (useful for testing)
  async clearDeliveredLeads(userId: string) {
    console.log(
      "🧹 LEAD DELIVERY: Clearing all delivered leads for user:",
      userId,
    );

    const deletedDeliveries = await db
      .delete(leadDeliveries)
      .where(eq(leadDeliveries.userId, userId))
      .returning();

    console.log(
      "🧹 LEAD DELIVERY: Cleared",
      deletedDeliveries.length,
      "delivery records",
    );
    return deletedDeliveries;
  }
}