import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Send,
  Search,
  TrendingUp,
  MessageSquare,
  FileText,
  Lightbulb,
  ArrowRight,
  ArrowLeft,
  Plus,
  BarChart3,
  PhoneCall,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Conversation, Message, Property } from "@shared/schema";

const agentTypes = [
  { id: "lead-finder", name: "🔍 Lead Finder Agent", icon: Search },
  { id: "deal-analyzer", name: "📊 Deal Analyzer Agent", icon: TrendingUp },
  { id: "negotiation", name: "💬 Negotiation Agent", icon: MessageSquare },
  { id: "closing", name: "📋 Closing Agent", icon: FileText },
];

interface WizardData {
  city: string;
  state: string;
  sellerType: string;
  propertyType: string;
  minBedrooms?: number;
  maxPrice?: number;
  minPrice?: number;
}

interface BuyerWizardData {
  city: string;
  state: string;
  buyerType: string;
}

// Helper to format numbers with commas
const formatNumber = (num?: number | string | null) => {
  if (num === null || num === undefined) return "N/A";
  return Number(num).toLocaleString();
};

// Helper to format date
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (e) {
    return dateStr;
  }
};

// New Component for Condensed Property Card
const CondensedPropertyCard = ({
  property,
  onViewDetails,
}: {
  property: Property;
  onViewDetails: (property: Property) => void;
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleAddToCRM = async () => {
    try {
      const result = await apiRequest("POST", "/api/properties", property);
      console.log("🏠 Property successfully added to CRM:", result);
      toast({
        title: "Added to CRM",
        description: `Property at ${property.address} has been added.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
    } catch (error: any) {
      console.error("Error adding property to CRM:", error);
      toast({
        title: "Error",
        description: "Failed to add property to CRM.",
        variant: "destructive",
      });
    }
  };

  const handleAnalyzeDeal = () => {
    toast({
      title: "Deal Analysis Started",
      description: `Analyzing deal for ${property.address}...`,
    });
  };

  const handleContactOwner = () => {
    toast({
      title: "Contact Owner",
      description: `Preparing to contact property owner...`,
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden bg-white border border-gray-200 shadow-sm">
      <CardContent className="p-6">
        {/* Header with Location and Seller Badge */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">{`${property.city}, ${property.state}`}</p>
            <p className="font-semibold text-lg text-gray-800">
              {property.address}
            </p>
          </div>
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Seller
          </Badge>
        </div>

        {/* Owner Name */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-1">Owner Name</p>
          <p className="font-medium text-gray-800">
            {property.ownerName || "Contact for details"}
          </p>
        </div>

        {/* Property Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Beds</p>
            <p className="font-semibold text-xl text-gray-800">
              {property.bedrooms || "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Baths</p>
            <p className="font-semibold text-xl text-gray-800">
              {property.bathrooms || "N/A"}
            </p>
          </div>
        </div>

        {/* Financial Information */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Last Sale Price</p>
            <p className="font-semibold text-lg text-gray-800">
              {property.lastSalePrice &&
              property.lastSalePrice !== "null" &&
              property.lastSalePrice !== null
                ? `$${formatNumber(property.lastSalePrice)}`
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Last Sale Date</p>
            <p className="font-semibold text-lg text-gray-800">
              {formatDate(property.lastSaleDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Equity Percent</p>
            <p className="font-semibold text-lg text-green-600">
              {property.equityPercentage
                ? `${property.equityPercentage}%`
                : "N/A"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Equity Value</p>
            <p className="font-semibold text-lg text-green-600">
              {property.equityBalance
                ? `$${formatNumber(property.equityBalance)}`
                : "N/A"}
            </p>
          </div>
        </div>

        {/* Estimated Value - Prominent Display */}
        <div className="mb-6 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-600 mb-1">Estimated Value</p>
          <p className="text-2xl font-bold text-blue-700">
            {property.arv
              ? `$${formatNumber(property.arv)}`
              : "Contact for details"}
          </p>
        </div>
      </CardContent>

      {/* Action buttons */}
      <div className="bg-gray-50 p-4 flex flex-wrap gap-2 justify-start border-t">
        <Button
          size="sm"
          variant="outline"
          className="bg-white hover:bg-green-50"
          onClick={handleAddToCRM}
        >
          <Plus className="h-4 w-4 mr-2" /> Add to CRM
        </Button>
        <Button size="sm" variant="outline" className="bg-white text-gray-600">
          I'll Pass
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-white text-blue-600 hover:bg-blue-50"
          onClick={() => onViewDetails(property)}
        >
          View Details
        </Button>
      </div>
    </Card>
  );
};

// New Component for Detailed Property View Modal
const PropertyDetailsModal = ({
  property,
  isOpen,
  onClose,
}: {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!property) return null;

  console.log("🔍 DEBUG PropertyDetailsModal: Received property data:", {
    address: property.address,
    ownerPhone: property.ownerPhone,
    ownerPhoneNumbers: property.ownerPhoneNumbers,
    ownerPhoneNumbersType: typeof property.ownerPhoneNumbers,
    ownerPhoneNumbersIsArray: Array.isArray(property.ownerPhoneNumbers),
    ownerPhoneNumbersLength: property.ownerPhoneNumbers?.length,
    rawProperty: property,
  });

  const formatEmail = (property: any) => {
    const emails = [];

    // Check for direct email field
    if (
      property.ownerEmail &&
      property.ownerEmail !== "null" &&
      property.ownerEmail !== null &&
      property.ownerEmail !== "undefined" &&
      property.ownerEmail.trim() !== ""
    ) {
      emails.push(property.ownerEmail.trim());
    }

    // Check for emails array
    if (
      property.ownerEmails &&
      Array.isArray(property.ownerEmails) &&
      property.ownerEmails.length > 0
    ) {
      const validEmails = property.ownerEmails.filter(
        (email: string) =>
          email &&
          email !== "null" &&
          email !== "undefined" &&
          email.trim() !== "" &&
          !emails.includes(email.trim()),
      );
      emails.push(...validEmails);
    }

    // Check for owner object with email
    if (
      property.owner?.email &&
      property.owner.email !== "null" &&
      property.owner.email !== null &&
      property.owner.email.trim() !== "" &&
      !emails.includes(property.owner.email.trim())
    ) {
      emails.push(property.owner.email.trim());
    }

    // Check for owner object with emails array
    if (
      property.owner?.emails &&
      Array.isArray(property.owner.emails) &&
      property.owner.emails.length > 0
    ) {
      const validOwnerEmails = property.owner.emails.filter(
        (email: string) =>
          email &&
          email !== "null" &&
          email !== "undefined" &&
          email.trim() !== "" &&
          !emails.includes(email.trim()),
      );
      emails.push(...validOwnerEmails);
    }

    return emails.length > 0 ? emails.join(", ") : "Contact for details";
  };

  const formatPhoneNumbers = (property: any) => {
    const phones = [];

    // Collect individual phone fields
    if (
      property.ownerPhone &&
      property.ownerPhone !== "undefined" &&
      property.ownerPhone !== null &&
      property.ownerPhone.trim() !== ""
    ) {
      phones.push(property.ownerPhone);
    }
    if (
      property.ownerMobilePhone &&
      property.ownerMobilePhone !== "undefined" &&
      property.ownerMobilePhone !== null &&
      property.ownerMobilePhone.trim() !== ""
    ) {
      phones.push(property.ownerMobilePhone);
    }
    if (
      property.ownerLandLine &&
      property.ownerLandLine !== "undefined" &&
      property.ownerLandLine !== null &&
      property.ownerLandLine.trim() !== ""
    ) {
      phones.push(property.ownerLandLine);
    }

    // Handle ownerPhoneNumbers array - SIMPLIFIED for strings
    if (
      Array.isArray(property.ownerPhoneNumbers) &&
      property.ownerPhoneNumbers.length > 0
    ) {
      property.ownerPhoneNumbers.forEach((phoneEntry: any) => {
        let phoneNumber = null;

        // Handle both string and object formats
        if (typeof phoneEntry === "string") {
          phoneNumber = phoneEntry.trim();
        } else if (
          typeof phoneEntry === "object" &&
          phoneEntry !== null &&
          phoneEntry.number
        ) {
          phoneNumber = String(phoneEntry.number).trim();
        }

        // Add if valid and not duplicate
        if (
          phoneNumber &&
          phoneNumber !== "" &&
          phoneNumber !== "undefined" &&
          phoneNumber !== "null" &&
          !phones.includes(phoneNumber)
        ) {
          phones.push(phoneNumber);
        }
      });
    }

    if (phones.length === 0) {
      return "Contact for details";
    }

    // Format phone numbers for display
    const formattedPhones = phones.map((phoneNumber) => {
      const cleanedPhone = phoneNumber.replace(/\D/g, "");

      if (cleanedPhone.length === 10) {
        return `(${cleanedPhone.slice(0, 3)}) ${cleanedPhone.slice(3, 6)}-${cleanedPhone.slice(6)}`;
      } else if (cleanedPhone.length === 11 && cleanedPhone.startsWith("1")) {
        return `+1 (${cleanedPhone.slice(1, 4)}) ${cleanedPhone.slice(4, 7)}-${cleanedPhone.slice(7)}`;
      }
      return phoneNumber; // Return as-is if format doesn't match
    });

    return formattedPhones.join(", ");
  };
  const formatDNCPhones = (property: any) => {
    const dncPhones = [];
    const addedNumbers = new Set();

    // Helper function to clean and format phone number
    const cleanPhoneNumber = (number: string) => {
      if (!number) return "";
      const digits = number.replace(/\D/g, "");
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return number;
    };

    // Check direct DNC phone field
    if (
      property.ownerDNCPhone &&
      property.ownerDNCPhone !== "null" &&
      property.ownerDNCPhone !== null &&
      property.ownerDNCPhone !== "undefined" &&
      property.ownerDNCPhone.trim() !== ""
    ) {
      const directDncPhones = property.ownerDNCPhone
        .split(",")
        .map((phone: string) => phone.trim())
        .filter(Boolean);

      directDncPhones.forEach((phone: string) => {
        if (!addedNumbers.has(phone)) {
          const formattedPhone = cleanPhoneNumber(phone);
          dncPhones.push(`${formattedPhone} (DNC)`);
          addedNumbers.add(phone);
        }
      });
    }

    // Check for DNC phones in phone numbers array
    if (
      property.ownerPhoneNumbers &&
      Array.isArray(property.ownerPhoneNumbers)
    ) {
      const dncFromArray = property.ownerPhoneNumbers.filter(
        (phone: any) =>
          phone &&
          phone.number &&
          phone.dnc &&
          phone.number !== "null" &&
          phone.number.trim() !== "",
      );

      dncFromArray.forEach((phone: any) => {
        const phoneNumber = phone.number.trim();
        if (!addedNumbers.has(phoneNumber)) {
          const formattedPhone = cleanPhoneNumber(phoneNumber);
          dncPhones.push(`${formattedPhone} (${phone.type || "DNC"})`);
          addedNumbers.add(phoneNumber);
        }
      });
    }

    // Check for DNC phones in owner object
    if (
      property.owner?.phoneNumbers &&
      Array.isArray(property.owner.phoneNumbers)
    ) {
      const ownerDncPhones = property.owner.phoneNumbers.filter(
        (phone: any) =>
          phone &&
          phone.number &&
          phone.dnc &&
          phone.number !== "null" &&
          phone.number.trim() !== "",
      );

      ownerDncPhones.forEach((phone: any) => {
        const phoneNumber = phone.number.trim();
        if (!addedNumbers.has(phoneNumber)) {
          const formattedPhone = cleanPhoneNumber(phoneNumber);
          dncPhones.push(`${formattedPhone} (${phone.type || "DNC"})`);
          addedNumbers.add(phoneNumber);
        }
      });
    }

    return dncPhones.length > 0 ? dncPhones.join(", ") : "None on record";
  };

  const formatMailingAddress = (property: any) => {
    // Check for direct mailing address field
    if (
      property.ownerMailingAddress &&
      property.ownerMailingAddress !== "null" &&
      property.ownerMailingAddress !== null &&
      property.ownerMailingAddress !== "undefined" &&
      property.ownerMailingAddress.trim() !== ""
    ) {
      return property.ownerMailingAddress.trim();
    }

    // Check for owner object mailing address
    if (
      property.owner?.mailingAddress &&
      property.owner.mailingAddress !== "null" &&
      property.owner.mailingAddress !== null &&
      property.owner.mailingAddress !== "undefined" &&
      property.owner.mailingAddress.trim() !== ""
    ) {
      return property.owner.mailingAddress.trim();
    }

    // Check for structured mailing address in owner object
    if (property.owner?.mailingAddress) {
      const addr = property.owner.mailingAddress;
      if (typeof addr === "object" && addr.street) {
        const fullAddress =
          `${addr.street || ""}, ${addr.city || ""}, ${addr.state || ""} ${addr.zip || ""}`.trim();
        if (fullAddress && fullAddress !== ", ") {
          return fullAddress;
        }
      }
    }

    // Check for mailing address fields separately
    const mailingParts = [];
    if (property.mailingStreet) mailingParts.push(property.mailingStreet);
    if (property.mailingCity) mailingParts.push(property.mailingCity);
    if (property.mailingState && property.mailingZip) {
      mailingParts.push(`${property.mailingState} ${property.mailingZip}`);
    } else if (property.mailingState) {
      mailingParts.push(property.mailingState);
    }

    if (mailingParts.length > 0) {
      return mailingParts.join(", ");
    }

    // Fall back to property address
    const propertyAddress =
      `${property.address || ""}, ${property.city || ""}, ${property.state || ""} ${property.zipCode || ""}`.trim();
    return propertyAddress || "Same as property address";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-gray-50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800">
            Seller Lead Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Property Header */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-bold text-blue-800 mb-2">
              🏠 SELLER LEAD
            </h3>
            <div className="text-blue-700">
              <p className="font-semibold">{property.address}</p>
              <p>
                {property.city}, {property.state} {property.zipCode}
              </p>
            </div>
          </div>

          {/* Building Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              🏗️ Building Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">
                  Property Type:
                </span>
                <div>
                  {property.propertyType?.replace(/_/g, " ") || "Single Family"}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Year Built:</span>
                <div>{property.yearBuilt || "N/A"}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Bedrooms:</span>
                <div>{property.bedrooms || "N/A"}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Bathrooms:</span>
                <div>{property.bathrooms || "N/A"}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Square Feet:</span>
                <div>{formatNumber(property.squareFeet)} sq ft</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Market Value:</span>
                <div className="font-semibold text-blue-600">
                  ${formatNumber(property.arv)}
                </div>
              </div>
            </div>
          </div>

          {/* Owner Information */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              👤 Owner Information
            </h4>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-600">Owner Name:</span>
                <div className="font-medium">{property.ownerName || "N/A"}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">
                  Mailing Address:
                </span>
                <div>{formatMailingAddress(property)}</div>
              </div>
            </div>
          </div>

          {/* Contact Information - Structured Display */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
              📞 Contact Information
            </h4>
            <div className="space-y-3">
              {/* Email Addresses */}
              <div className="bg-white rounded-md p-3 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-green-600"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,1.89 21.1,4 20,4Z" />
                  </svg>
                  <span className="font-medium text-green-700">
                    Email Addresses
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  {formatEmail(property)}
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="bg-white rounded-md p-3 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-green-600"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z" />
                  </svg>
                  <span className="font-medium text-green-700">
                    Phone Numbers
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  {formatPhoneNumbers(property)}
                </div>
              </div>

              {/* DNC Phone Numbers */}
              <div className="bg-white rounded-md p-3 border border-red-100">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-red-600"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17,7H22V9H19V12A5,5 0 0,1 14,17H10A5,5 0 0,1 5,12V9H2V7H7A2,2 0 0,1 9,5V4A2,2 0 0,1 11,2H13A2,2 0 0,1 15,4V5A2,2 0 0,1 17,7M13,4V7H11V4H13Z" />
                  </svg>
                  <span className="font-medium text-red-700">
                    DNC Phone Numbers
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  {formatDNCPhones(property)}
                </div>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              💰 Valuation Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">As of Date:</span>
                <div>{new Date().toLocaleDateString("en-US")}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">
                  Confidence Score:
                </span>
                <div>{property.confidenceScore || "N/A"}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">
                  Equity Balance:
                </span>
                <div className="font-semibold text-green-600">
                  ${formatNumber(property.equityBalance)}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">
                  Equity Percent:
                </span>
                <div className="font-semibold text-green-600">
                  {property.equityPercentage || "N/A"}%
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">
                  Estimated Value:
                </span>
                <div className="font-semibold text-blue-600">
                  ${formatNumber(property.arv)}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">
                  Max Offer (70% Rule):
                </span>
                <div className="font-semibold text-orange-600">
                  ${formatNumber(property.maxOffer)}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">
                  Last Sale Price:
                </span>
                <div>
                  {property.lastSalePrice
                    ? `$${formatNumber(property.lastSalePrice)}`
                    : "N/A"}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-600">
                  Last Sale Date:
                </span>
                <div>{formatDate(property.lastSaleDate)}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// PropertyCard component for rendering property cards with buttons
const PropertyCard = ({ content }: { content: string }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Detect card type and extract number
  const isSellerLead = content.includes("🏠 SELLER LEAD");
  const isCashBuyer = content.includes("🎯 QUALIFIED CASH BUYER");

  const cardNumber = isSellerLead
    ? content.match(/🏠 SELLER LEAD (\d+)/)?.[1] || "1"
    : content.match(/🎯 QUALIFIED CASH BUYER #(\d+)/)?.[1] || "1";

  const cardType = isSellerLead ? "Property" : "Buyer";

  // Helper function to check if a value is a placeholder
  const isPlaceholderValue = (value: string): boolean => {
    if (!value) return true;
    const trimmedValue = value.trim().toLowerCase();
    return (
      trimmedValue === "" ||
      trimmedValue === "n/a" ||
      trimmedValue.includes("contact for details") ||
      trimmedValue.includes("available via skip trace") ||
      trimmedValue.includes("not available") ||
      trimmedValue.includes("none on record")
    );
  };

  // Function to extract minimal property details for card view
  const extractMinimalDetails = (content: string) => {
    if (!isSellerLead) return null;

    console.log(
      "🔍 PropertyCard: Extracting details from content:",
      content.substring(0, 500) + "...",
    );

    try {
      // Extract address
      const addressMatch =
        content.match(/📍 LOCATION[ \t]*\n[ \t]+(.+?)\n/) ||
        content.match(/📍 LOCATION\s+(.+?)\n/);

      let address = addressMatch ? addressMatch[1].trim() : "";

      // Check if address is an object and handle it properly
      if (address.includes("[object Object]")) {
        // Try to extract address components separately
        const streetMatch = content.match(/Address:\s*([^,\n]+)/i);
        const cityMatch = content.match(/City:\s*([^,\n]+)/i);
        const stateMatch = content.match(/State:\s*([^,\n]+)/i);
        const zipMatch = content.match(/Zip:\s*(\d{5})/i);

        // Reconstruct address from components
        const street = streetMatch ? streetMatch[1].trim() : "";
        const city = cityMatch ? cityMatch[1].trim() : "";
        const state = stateMatch ? stateMatch[1].trim() : "";
        const zip = zipMatch ? zipMatch[1].trim() : "";

        address = street;
        if (city && state) {
          address += (address ? ", " : "") + city + ", " + state;
          if (zip) address += " " + zip;
        }
      }

      // Extract owner name
      const ownerNameMatch =
        content.match(/Owner Name\s+(.+?)\n/) ||
        content.match(/Owner: (.+?)\n/) ||
        content.match(/Owner name:\s*([^,\n]+)/i);

      let ownerName = ownerNameMatch ? ownerNameMatch[1].trim() : "";

      // Handle undefined owner name
      if (ownerName === "undefined" || !ownerName) {
        // Try to find owner name in other formats
        const altOwnerMatch = content.match(/Owner:\s*([^,\n]+)/i);
        ownerName = altOwnerMatch ? altOwnerMatch[1].trim() : "Not Available";
      }

      // Extract bedrooms and bathrooms - updated patterns to match actual format
      const bedroomsMatch =
        content.match(/Bedrooms\s+(\d+)/) || content.match(/🏠 (\d+) bed/);
      const bathroomsMatch =
        content.match(/Bathrooms\s+(\d+)/) || content.match(/(\d+) bath/);
      const bedrooms = bedroomsMatch ? bedroomsMatch[1] : "";
      const bathrooms = bathroomsMatch ? bathroomsMatch[1] : "";

      // Extract estimated value - updated pattern to match actual format
      const arvMatch =
        content.match(/Estimated Value\s+([0-9,]+)/) ||
        content.match(/💰 Market Value: \$([0-9,]+)/);
      const estimatedValue = arvMatch ? arvMatch[1] : "";

      // Extract equity percent - updated pattern to match actual format with multiple spaces
      const equityPercentMatch = content.match(/Equity Percent\s+(\d+)%/);
      const equityPercent = equityPercentMatch ? equityPercentMatch[1] : "";
      console.log("🔍 PropertyCard: Equity Percent match:", {
        equityPercentMatch,
        equityPercent,
      });

      // Extract equity balance (this is the equity value in dollars) - updated pattern
      const equityBalanceMatch = content.match(/Equity Balance\s+\$([0-9,]+)/);
      const equityValue = equityBalanceMatch ? equityBalanceMatch[1] : "";
      console.log("🔍 PropertyCard: Equity Balance match:", {
        equityBalanceMatch,
        equityValue,
      });

      // Extract last sale data if available - updated patterns to match actual format
      const lastSalePriceMatch = content.match(
        /Last Sale Price\s+(\$[0-9,]+|N\/A|null)/,
      );
      const lastSalePrice = lastSalePriceMatch ? lastSalePriceMatch[1] : "N/A";
      console.log("🔍 PropertyCard: Last Sale Price match:", {
        lastSalePriceMatch,
        lastSalePrice,
      });

      const lastSaleDateMatch = content.match(
        /Last Sale Date\s+([0-9\/\-]+|N\/A|null)/,
      );
      const lastSaleDate = lastSaleDateMatch ? lastSaleDateMatch[1] : "N/A";
      console.log("🔍 PropertyCard: Last Sale Date match:", {
        lastSaleDateMatch,
        lastSaleDate,
      });

      // Debug: Log the entire content around sale data
      const saleSection = content.match(
        /Last Sale Price[\s\S]*?Last Sale Date[\s\S]*?\n/,
      );
      console.log(
        "🔍 PropertyCard: Sale section from content:",
        saleSection?.[0],
      );

      // Equity value is extracted directly from the content above

      return {
        address,
        ownerName,
        bedrooms,
        bathrooms,
        lastSalePrice,
        lastSaleDate,
        equityPercent,
        estimatedValue,
        equityValue,
      };
    } catch (error) {
      console.error("Error extracting minimal details:", error);
      return null;
    }
  };

  // Function to extract property data from seller lead content
  const extractPropertyData = (content: string) => {
    if (!isSellerLead) return null;

    console.log(
      "🔍 DEBUG extractPropertyData: Starting extraction from content length:",
      content.length,
    );

    try {
      // Extract address information - handle both new format (address on next line) and old format (same line)
      const addressMatch =
        content.match(/📍 LOCATION[ \t]*\n[ \t]+(.+?)\n/) ||
        content.match(/📍 LOCATION\s+(.+?)\n/);
      const address = addressMatch ? addressMatch[1].trim() : "";

      // Parse address components
      const addressParts = address.split(", ");
      const streetAddress = addressParts[0] || "";
      const city = addressParts[1] || "";
      const stateZip = addressParts[2] || "";
      const [state, zipCode] = stateZip.split(" ");

      // Extract building details
      const bedroomsMatch =
        content.match(/🏠 (\d+) bed/) || content.match(/Bedrooms\s+(\d+)/);
      const bathroomsMatch =
        content.match(/(\d+) bath/) || content.match(/Bathrooms\s+(\d+)/);
      const squareFeetMatch =
        content.match(/(\d{1,3}(?:,\d{3})*) sq ft/) ||
        content.match(/Total Area\s+(\d{1,3}(?:,\d{3})*) sqft/);
      const yearBuiltMatch =
        content.match(/📅 Built: (\d{4})/) || content.match(/Built:\s*(\d{4})/);
      const propertyTypeMatch =
        content.match(/📐 Property Type: (.+?)\n/) ||
        content.match(/Property Type\s+(.+?)\n/);

      // Extract financial information - updated for new format
      // Try both "Market Value" in BUILDING DETAILS and "Estimated Value" in Valuation Details
      const arvMatch =
        content.match(/💰 Market Value: \$([0-9,]+)/) ||
        content.match(/Estimated Value\s*\$([0-9,]+)/) ||
        content.match(/Estimated Value\s+\$([0-9,]+)/);
      const maxOfferMatch = content.match(
        /Max Offer \(70% Rule\)\s*\$([0-9,]+)/,
      );
      const equityMatch =
        content.match(/Equity Percent\s*(\d+)%/) ||
        content.match(/Equity Percentage\s*(\d+)%/);

      // Extract owner information - updated to handle both old and new formats
      const ownerNameMatch =
        content.match(/Owner Name\s+(.+?)\n/) ||
        content.match(/Owner: (.+?)\n/);
      const ownerPhoneMatch =
        content.match(/Phone\(s\)\s+(.+?)\n/) ||
        content.match(/📱 Phone: (.+?)\n/);
      const ownerEmailMatch =
        content.match(/Email\(s\)\s+(.+?)\n/) ||
        content.match(/✉️ Email: (.+?)\n/);
      const dncPhoneMatch = content.match(/DNC Phone\(s\)\s+(.+?)\n/);
      const ownerMailingMatch =
        content.match(/Mailing Address\s+(.+?)\n/) ||
        content.match(/📬 Mailing: (.+?)\n/);

      // Extract confidence score - updated for new format (no emoji, no "/100")
      const confidenceScoreMatch = content.match(/Confidence Score\s*(\d+)/);

      // Clean and validate extracted data
      const bedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]) : undefined;
      const bathrooms = bathroomsMatch
        ? parseInt(bathroomsMatch[1])
        : undefined;
      const squareFeet = squareFeetMatch
        ? parseInt(squareFeetMatch[1].replace(/,/g, ""))
        : undefined;
      const yearBuilt = yearBuiltMatch
        ? parseInt(yearBuiltMatch[1])
        : undefined;
      const equityPercentage = equityMatch
        ? parseInt(equityMatch[1])
        : undefined;
      const confidenceScore = confidenceScoreMatch
        ? parseInt(confidenceScoreMatch[1])
        : undefined;

      return {
        address: streetAddress,
        city: city,
        state: state || "",
        zipCode: zipCode || "",
        bedrooms: bedrooms && bedrooms > 0 ? bedrooms : undefined,
        bathrooms: bathrooms && bathrooms > 0 ? bathrooms : undefined,
        squareFeet: squareFeet && squareFeet > 0 ? squareFeet : undefined,
        yearBuilt:
          yearBuilt &&
          yearBuilt > 1800 &&
          yearBuilt <= new Date().getFullYear() + 5
            ? yearBuilt
            : undefined,
        propertyType: propertyTypeMatch
          ? propertyTypeMatch[1].trim().toLowerCase().replace(/\s+/g, "_")
          : "single_family",
        arv: arvMatch ? arvMatch[1].replace(/,/g, "") : undefined,
        maxOffer: maxOfferMatch
          ? maxOfferMatch[1].replace(/,/g, "")
          : undefined,
        equityPercentage:
          equityPercentage && equityPercentage >= 0 && equityPercentage <= 100
            ? equityPercentage
            : undefined,
        ownerName: ownerNameMatch ? ownerNameMatch[1].trim() : undefined,
        ownerPhone:
          ownerPhoneMatch && !isPlaceholderValue(ownerPhoneMatch[1])
            ? ownerPhoneMatch[1].trim()
            : undefined,
        ownerEmail:
          ownerEmailMatch && !isPlaceholderValue(ownerEmailMatch[1])
            ? ownerEmailMatch[1].trim()
            : undefined,
        ownerMailingAddress: ownerMailingMatch
          ? ownerMailingMatch[1].trim()
          : undefined,
        confidenceScore:
          confidenceScore && confidenceScore >= 0 && confidenceScore <= 100
            ? confidenceScore
            : undefined,
        status: "new",
      };
    } catch (error) {
      console.error("Error extracting property data:", error);
      return null;
    }
  };

  const handleAddToCRM = async () => {
    if (!isSellerLead) {
      toast({
        title: "Added to CRM",
        description: `${cardType} ${cardNumber} has been added to your CRM system.`,
      });
      return;
    }

    const propertyData = extractPropertyData(content);

    if (!propertyData) {
      toast({
        title: "Error",
        description: "Failed to extract property data from the lead.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await apiRequest("POST", "/api/properties", propertyData);
      console.log("🏠 Property successfully added to CRM:", result);

      toast({
        title: "Added to CRM",
        description: `Property at ${propertyData.address} has been added to your CRM system.`,
      });

      // Force refresh the properties cache to ensure CRM updates immediately
      await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      await queryClient.refetchQueries({ queryKey: ["/api/properties"] });
    } catch (error: any) {
      console.error("Error adding property to CRM:", error);
      toast({
        title: "Error",
        description: "Failed to add property to CRM. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmAddToCRM = async () => {
    const propertyData = extractPropertyData(content);

    if (!propertyData) {
      toast({
        title: "Error",
        description: "Failed to extract property data from the lead.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await apiRequest("POST", "/api/properties", propertyData);
      console.log("🏠 Property successfully added to CRM:", result);

      toast({
        title: "Added to CRM",
        description: `Property at ${propertyData.address} has been added to your CRM system.`,
      });

      // Force refresh the properties cache to ensure CRM updates immediately
      await queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      await queryClient.refetchQueries({ queryKey: ["/api/properties"] });

      // Close the dialog
      setShowDetailsDialog(false);
    } catch (error: any) {
      console.error("Error adding property to CRM:", error);
      toast({
        title: "Error",
        description: "Failed to add property to CRM. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleAnalyzeDeal = () => {
    if (isSellerLead) {
      toast({
        title: "Deal Analysis Started",
        description: `Analyzing deal for property ${cardNumber}...`,
      });
    } else {
      toast({
        title: "Buyer Profile Analysis",
        description: `Analyzing investment profile for buyer ${cardNumber}...`,
      });
    }
  };

  const handleContactOwner = () => {
    if (isSellerLead) {
      toast({
        title: "Contact Owner",
        description: `Preparing to contact property owner...`,
      });
    } else {
      toast({
        title: "Contact Investor",
        description: `Preparing to contact cash buyer...`,
      });
    }
  };

  // Remove any action sections from content for display
  const displayContent = content
    .replace(
      / ACTIONS[\s\S]*?━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━/g,
      "",
    )
    .trim();

  // Dynamic button labels based on card type
  const actionButtons = isSellerLead
    ? [
        {
          label: "Add to CRM",
          icon: Plus,
          color: "green",
          action: handleAddToCRM,
        },
        {
          label: "Analyze Deal",
          icon: BarChart3,
          color: "blue",
          action: handleAnalyzeDeal,
        },
        {
          label: "Contact Owner",
          icon: PhoneCall,
          color: "orange",
          action: handleContactOwner,
        },
      ]
    : [
        {
          label: "Add to CRM",
          icon: Plus,
          color: "green",
          action: handleAddToCRM,
        },
        {
          label: "View Portfolio",
          icon: BarChart3,
          color: "blue",
          action: handleAnalyzeDeal,
        },
        {
          label: "Contact Investor",
          icon: PhoneCall,
          color: "orange",
          action: handleContactOwner,
        },
      ];

  const minimalDetails = extractMinimalDetails(content);

  // If not a seller lead, show the original format
  if (!isSellerLead) {
    return (
      <div className="space-y-4">
        {/* Display the formatted content */}
        <div className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-3 rounded border">
          {displayContent}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {actionButtons.map((button, idx) => {
            const colorClasses = {
              green:
                "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
              blue: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
              orange:
                "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
            };

            return (
              <Button
                key={idx}
                onClick={button.action}
                variant="outline"
                size="sm"
                className={`flex items-center gap-2 ${colorClasses[button.color as keyof typeof colorClasses]}`}
                data-testid={`button-${button.label.toLowerCase().replace(/\s+/g, "-")}-${cardNumber}`}
              >
                <button.icon className="h-4 w-4" />
                {button.label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  // For seller leads, show minimal card view
  return (
    <div className="space-y-4">
      {/* Minimal Property Card */}
      <Card className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-600">
              {minimalDetails?.address
                ? `${minimalDetails.address.split(",").slice(-2).join(",").trim()}`
                : "Location"}
            </h3>
            <Badge
              variant="secondary"
              className="text-xs bg-green-100 text-green-800"
            >
              Seller
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Address */}
          <div>
            <p className="text-sm text-gray-600">Address:</p>
            <p className="font-medium text-gray-900">
              {minimalDetails?.address || "Address not available"}
            </p>
          </div>

          {/* Owner */}
          <div>
            <p className="text-sm text-gray-600">Owner name:</p>
            <p className="font-medium text-gray-900">
              {minimalDetails?.ownerName &&
              minimalDetails.ownerName !== "undefined"
                ? minimalDetails.ownerName
                : "Not Available"}
            </p>
          </div>

          {/* Property Details Grid */}
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="text-center">
              <p className="text-xs text-gray-500">Beds</p>
              <p className="font-semibold text-gray-900">
                {minimalDetails?.bedrooms || "N/A"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Baths</p>
              <p className="font-semibold text-gray-900">
                {minimalDetails?.bathrooms || "N/A"}
              </p>
            </div>
          </div>

          {/* Sale Information */}
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <p className="text-xs text-gray-500">Last Sale Price</p>
              <p className="font-semibold text-gray-900">
                {minimalDetails?.lastSalePrice &&
                minimalDetails.lastSalePrice !== "N/A" &&
                minimalDetails.lastSalePrice !== "null"
                  ? minimalDetails.lastSalePrice.startsWith("$")
                    ? minimalDetails.lastSalePrice
                    : `$${minimalDetails.lastSalePrice}`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Sale Date</p>
              <p className="font-semibold text-gray-900">
                {minimalDetails?.lastSaleDate &&
                minimalDetails.lastSaleDate !== "N/A" &&
                minimalDetails.lastSaleDate !== "null"
                  ? minimalDetails.lastSaleDate
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Financial Information */}
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <p className="text-xs text-gray-500">Equity Percent</p>
              <p className="font-semibold text-green-600">
                {minimalDetails?.equityPercent
                  ? `${minimalDetails.equityPercent}%`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Equity Value</p>
              <p className="font-semibold text-green-600">
                {minimalDetails?.equityValue
                  ? minimalDetails.equityValue.startsWith("$")
                    ? minimalDetails.equityValue
                    : `$${minimalDetails.equityValue}`
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Estimated Value */}
          <div className="py-2">
            <p className="text-sm text-gray-600">Estimated Value</p>
            <p className="text-lg font-bold text-blue-600">
              {minimalDetails?.estimatedValue
                ? minimalDetails.estimatedValue.startsWith("$")
                  ? minimalDetails.estimatedValue
                  : `$${minimalDetails.estimatedValue}`
                : "N/A"}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-3">
            <Button
              onClick={handleAddToCRM}
              variant="outline"
              size="sm"
              className="flex items-center gap-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 text-xs px-3 py-1"
            >
              <Plus className="h-3 w-3" />
              Add to CRM
            </Button>
            <Button
              onClick={handleAnalyzeDeal}
              variant="outline"
              size="sm"
              className="flex items-center gap-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 text-xs px-3 py-1"
            >
              <BarChart3 className="h-3 w-3" />
              Analyze Deal
            </Button>
            <Button
              onClick={handleContactOwner}
              variant="outline"
              size="sm"
              className="flex items-center gap-1 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 text-xs px-3 py-1"
            >
              <PhoneCall className="h-3 w-3" />
              Contact Owner
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs px-3 py-1 text-gray-600 hover:bg-gray-50"
            >
              I'll Pass
            </Button>
            <Button
              onClick={() => setShowDetailsDialog(true)}
              variant="outline"
              size="sm"
              className="flex-1 text-xs px-3 py-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Property Information Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-green-700">
              🏠 Seller Lead {cardNumber} - Complete Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Full property details in formatted view */}
            <div className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-4 rounded border max-h-96 overflow-y-auto">
              {displayContent}
            </div>

            {/* Action buttons in dialog */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button
                onClick={handleConfirmAddToCRM}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="h-4 w-4" />
                Confirm Add to CRM
              </Button>
              <Button
                onClick={handleAnalyzeDeal}
                variant="outline"
                className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <BarChart3 className="h-4 w-4" />
                Analyze Deal
              </Button>
              <Button
                onClick={handleContactOwner}
                variant="outline"
                className="flex items-center gap-2 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
              >
                <PhoneCall className="h-4 w-4" />
                Contact Owner
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function ChatInterface() {
  // Safe text renderer for Terry's messages - handles **bold** without XSS risk
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        // Remove the ** markers and wrap in <strong>
        const boldText = part.slice(2, -2);
        return <strong key={index}>{boldText}</strong>;
      }
      // Regular text - React will safely escape any HTML
      return <span key={index}>{part}</span>;
    });
  };

  const [selectedAgent, setSelectedAgent] = useState("lead-finder");
  const [currentConversation, setCurrentConversation] = useState<string | null>(
    null,
  );
  const [inputMessage, setInputMessage] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [showBuyerWizard, setShowBuyerWizard] = useState(false);
  const [showTargetMarketFinder, setShowTargetMarketFinder] = useState(false);
  const [targetMarketResults, setTargetMarketResults] = useState(false);
  const [terryMessages, setTerryMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [terryInput, setTerryInput] = useState("");
  const [terryLoading, setTerryLoading] = useState(false);

  const handleTerrySuggestedQuestion = (question: string) => {
    setTerryInput(question);
    handleTerrySendMessage(question);
  };

  const handleTerrySendMessage = async (customMessage?: string) => {
    const messageToSend = customMessage || terryInput.trim();
    if (!messageToSend || terryLoading) return;

    // Add user message
    const newMessages = [
      ...terryMessages,
      { role: "user" as const, content: messageToSend },
    ];
    setTerryMessages(newMessages);
    setTerryInput("");
    setTerryLoading(true);

    try {
      const response = await fetch("/api/terry/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageToSend,
          history: newMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response from Terry");
      }

      // Add Terry's response
      setTerryMessages([
        ...newMessages,
        { role: "assistant" as const, content: data.response },
      ]);
    } catch (error: any) {
      console.error("Terry chat error:", error);
      const errorMessage =
        error.message ||
        "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
      setTerryMessages([
        ...newMessages,
        {
          role: "assistant" as const,
          content: errorMessage,
        },
      ]);
    } finally {
      setTerryLoading(false);
    }
  };
  const [wizardStep, setWizardStep] = useState(1);
  const [buyerWizardStep, setBuyerWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>({
    city: "",
    state: "",
    sellerType: "",
    propertyType: "",
  });
  const [buyerWizardData, setBuyerWizardData] = useState<BuyerWizardData>({
    city: "",
    state: "",
    buyerType: "",
  });
  const [wizardProcessing, setWizardProcessing] = useState(false);
  const [buyerWizardProcessing, setBuyerWizardProcessing] = useState(false);
  const [sessionState, setSessionState] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [shownPropertyIds, setShownPropertyIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastSearchCriteria, setLastSearchCriteria] = useState<any>(null);

  // State for the details modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );

  const handleViewDetails = (property: Property) => {
    setSelectedProperty(property);
    setIsModalOpen(true);
  };

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", currentConversation, "messages"],
    enabled: !!currentConversation,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: { agentType: string; title: string }) => {
      const response = await apiRequest("POST", "/api/conversations", data);
      return response.json();
    },
    onSuccess: (conversation: Conversation) => {
      setCurrentConversation(conversation.id);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });

      // Check for and send pending cash buyer response and individual cards
      const pendingResponse = localStorage.getItem("pendingCashBuyerResponse");
      const pendingCards = localStorage.getItem("pendingCashBuyerCards");

      if (pendingResponse) {
        localStorage.removeItem("pendingCashBuyerResponse");
        localStorage.removeItem("pendingCashBuyerCards");

        // Send the intro message first
        setTimeout(async () => {
          try {
            await apiRequest(
              "POST",
              `/api/conversations/${conversation.id}/messages`,
              {
                content: pendingResponse,
                role: "assistant",
                isAiGenerated: true,
              },
            );

            // If we have individual buyer cards, send each as a separate message
            if (pendingCards) {
              const buyerCards = JSON.parse(pendingCards);
              for (let i = 0; i < buyerCards.length; i++) {
                await new Promise((resolve) => setTimeout(resolve, 300)); // Small delay between cards
                await apiRequest(
                  "POST",
                  `/api/conversations/${conversation.id}/messages`,
                  {
                    content: buyerCards[i],
                    role: "assistant",
                    isAiGenerated: true,
                  },
                );
              }
            }

            queryClient.invalidateQueries({
              queryKey: ["/api/conversations", conversation.id, "messages"],
            });
          } catch (error) {
            console.error("Failed to send pending cash buyer response:", error);
          }
        }, 200);
      }

      // Check for and send pending seller lead response and individual cards
      const pendingSellerResponse = localStorage.getItem(
        "pendingSellerResponse",
      );
      const pendingSellerCards = localStorage.getItem("pendingSellerCards");

      if (pendingSellerResponse) {
        localStorage.removeItem("pendingSellerResponse");
        localStorage.removeItem("pendingSellerCards");

        // Send the intro message first
        setTimeout(async () => {
          try {
            await apiRequest(
              "POST",
              `/api/conversations/${conversation.id}/messages`,
              {
                content: pendingSellerResponse,
                role: "assistant",
                isAiGenerated: true,
              },
            );

            // If we have individual property cards, send each as a separate message
            if (pendingSellerCards) {
              const properties = JSON.parse(pendingSellerCards);
              for (let i = 0; i < properties.length; i++) {
                await new Promise((resolve) => setTimeout(resolve, 400)); // Small delay between cards
                const property = properties[i];

                // Use building data from original BatchData search - no additional API calls needed
                const buildingDetails = `
🏗️ BUILDING DETAILS
   🏠 ${property.bedrooms || "Contact seller"} bed, ${property.bathrooms || "Contact seller"} bath${property.squareFeet ? ` | ${property.squareFeet.toLocaleString()} sq ft` : " | Contact seller for sq ft"}
   📅 Built: ${property.yearBuilt || "Contact seller for year built"}
   📐 Property Type: ${property.propertyType?.replace(/_/g, " ") || "Single Family"}
   💰 Market Value: $${parseInt(property.arv).toLocaleString()}`;

                const propertyCard = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 SELLER LEAD ${i + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 LOCATION
   ${property.address}, ${property.city}, ${property.state} ${property.zipCode}

${buildingDetails}

🏠 PROPERTY DETAILS
   Total Area                   ${property.squareFeet ? property.squareFeet.toLocaleString() + " sqft" : "Contact for details"}
   Property Type                ${property.propertyType?.replace(/_/g, " ") || "Single Family"}
   Bedrooms                     ${property.bedrooms || "Contact seller"}
   Bathrooms                    ${property.bathrooms || "Contact seller"}

👤 OWNER INFORMATION
   Owner Name                   ${property.ownerName}
   Mailing Address              ${property.ownerMailingAddress}


📞 CONTACT INFORMATION
   Email(s)                     ${property.ownerEmails && property.ownerEmails.length > 0 ? property.ownerEmails.join(", ") : "Contact for details"}
   Phone(s)                     ${
     property.ownerPhoneNumbers && property.ownerPhoneNumbers.length > 0
       ? property.ownerPhoneNumbers
           .filter((p: any) => {
             if (typeof p === "string") return true;
             return !p.dnc;
           })
           .map((p: any) => {
             if (typeof p === "string") {
               const cleaned = p.replace(/\D/g, "");
               if (cleaned.length === 10) {
                 return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
               }
               return p;
             }
             return `${p.number} (${p.type})`;
           })
           .join(", ") || "Contact for details"
       : "Contact for details"
   }
   DNC Phone(s)                 ${
     property.ownerPhoneNumbers &&
     property.ownerPhoneNumbers.filter((p: any) => p.dnc).length > 0
       ? property.ownerPhoneNumbers
           .filter((p: any) => p.dnc)
           .map((p: any) => `${p.number} (${p.type})`)
           .join(", ")
       : "None on record"
   }
   Mailing Address              ${property.ownerMailingAddress}

💰 Valuation Details

As of Date                    ${new Date().toLocaleDateString()}
Confidence Score             ${property.confidenceScore}
Equity Balance               $${(parseInt(property.arv) * (property.equityPercentage / 100)).toLocaleString()}
Equity Percent               ${property.equityPercentage}%
Estimated Value              $${parseInt(property.arv).toLocaleString()}
Max Offer (70% Rule)         $${parseInt(property.maxOffer).toLocaleString()}
Last Sale Price              ${property.lastSalePrice ? `$${Number(property.lastSalePrice).toLocaleString()}` : "N/A"}
Last Sale Date               ${property.lastSaleDate || "N/A"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                // Property card already includes last sale data in template
                const updatedPropertyCard = propertyCard;

                await apiRequest(
                  "POST",
                  `/api/conversations/${conversation.id}/messages`,
                  {
                    content: updatedPropertyCard,
                    role: "assistant",
                    isAiGenerated: true,
                  },
                );
              }
            }

            queryClient.invalidateQueries({
              queryKey: ["/api/conversations", conversation.id, "messages"],
            });
          } catch (error) {
            console.error("Failed to send pending seller response:", error);
          }
        }, 200);
      }
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; role: string }) => {
      if (!currentConversation) throw new Error("No conversation selected");

      // Skip auto-responses for wizard-generated messages
      const isWizardMessage =
        data.content.toLowerCase().includes("find") &&
        data.content.toLowerCase().includes("properties") &&
        (data.content.toLowerCase().includes("distressed") ||
          data.content.toLowerCase().includes("motivated") ||
          data.content.toLowerCase().includes("leads"));

      if (selectedAgent === "lead-finder" && !isWizardMessage) {
        // For lead finder, use the normal API flow
        const response = await apiRequest(
          "POST",
          `/api/conversations/${currentConversation}/messages`,
          data,
        );
        return response.json();
      } else if (isWizardMessage) {
        // For wizard messages, just send the user message without triggering AI response
        await apiRequest(
          "POST",
          `/api/conversations/${currentConversation}/messages`,
          {
            content: data.content,
            role: "user",
          },
        );
        return { response: "Wizard message sent" };
      } else {
        const response = await apiRequest(
          "POST",
          `/api/conversations/${currentConversation}/messages`,
          data,
        );
        return response.json();
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", currentConversation, "messages"],
      });
      setWizardProcessing(false);
      createConversationMutation.reset();
    },
    onError: () => {
      setWizardProcessing(false);
    },
  });

  const savePropertyMutation = useMutation({
    mutationFn: async (propertyData: any) => {
      const response = await apiRequest(
        "POST",
        "/api/properties",
        propertyData,
      );
      return response.json();
    },
    onSuccess: (savedProperty) => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      console.log("Property saved successfully:", savedProperty);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (messageOverride?: string) => {
    const messageToSend = messageOverride || inputMessage.trim();
    if (!messageToSend) return;

    if (!messageOverride) {
      setInputMessage("");
    }

    if (!currentConversation) {
      const agentName =
        agentTypes.find((a) => a.id === selectedAgent)?.name || "Chat";
      createConversationMutation.mutate({
        agentType: selectedAgent,
        title:
          messageToSend.slice(0, 50) + (messageToSend.length > 50 ? "..." : ""),
      });
      setInputMessage(messageToSend);
    } else {
      sendMessageMutation.mutate({
        content: messageToSend,
        role: "user",
      });
    }
  };

  useEffect(() => {
    if (
      currentConversation &&
      inputMessage.trim() &&
      createConversationMutation.isSuccess
    ) {
      const messageContent = inputMessage.trim();
      sendMessageMutation.mutate({
        content: messageContent,
        role: "user",
      });
    }
  }, [currentConversation, createConversationMutation.isSuccess]);

  const currentAgent = agentTypes.find((agent) => agent.id === selectedAgent);

  const states = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "UT",
    "VT",
    "VA",
    "WV",
    "WI",
    "WY",
  ];

  const sellerTypes = [
    {
      value: "preforeclosure",
      label: "Distressed Properties (Pre-foreclosure, Vacant)",
    },
    {
      value: "out-of-state-absentee-owner",
      label: "Absentee Owners (Out-of-state/Non-resident)",
    },
    { value: "high-equity", label: "High Equity Owners (70%+ equity)" },
    { value: "inherited", label: "Inherited Properties" },
    { value: "corporate-owned", label: "Corporate Owned Properties" },
    { value: "tired-landlord", label: "Tired Landlords" },
  ];

  const propertyTypes = [
    { value: "single_family", label: "Single Family Homes" },
    { value: "multi_family", label: "Multi-Family (2-4 units)" },
    { value: "condo", label: "Condominiums" },
    { value: "townhouse", label: "Townhouses" },
  ];

  // client/src/components/chat/chat-interface.tsx

  // client/src/components/chat/chat-interface.tsx

  const handleWizardSubmit = async () => {
    let location = "";
    const cityInput = wizardData.city.trim();
    const zipPattern = /^\d{5}$/;
    const partsRaw = cityInput
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const allZips = partsRaw.every((p) => zipPattern.test(p));
    let locations: string[] | undefined;

    if (allZips && partsRaw.length > 1) {
      // Multiple comma-separated ZIP codes
      locations = partsRaw;
      location = locations[0]; // Primary location for display
    } else if (zipPattern.test(cityInput)) {
      location = cityInput;
    } else if (cityInput.includes(",")) {
      const parts = cityInput.split(",").map((p) => p.trim());
      if (parts.length >= 2 && parts[1].length === 2) {
        location = cityInput;
      } else {
        location = `${parts[0]}, ${wizardData.state}`;
      }
    } else {
      location = `${cityInput}, ${wizardData.state}`;
    }

    let searchQuery = "Find";
    if (wizardData.propertyType) {
      const propertyTypeLabel = propertyTypes.find(
        (p) => p.value === wizardData.propertyType,
      )?.label;
      if (propertyTypeLabel) {
        searchQuery += ` ${propertyTypeLabel.toLowerCase()}`;
      } else {
        searchQuery += ` properties`;
      }
    } else {
      searchQuery += ` properties`;
    }

    searchQuery += ` in ${location}`;

    if (wizardData.sellerType) {
      const sellerTypeLabel = sellerTypes.find(
        (s) => s.value === wizardData.sellerType,
      )?.label;
      searchQuery += ` with ${sellerTypeLabel?.toLowerCase()}`;
    }

    if (wizardData.minBedrooms) {
      searchQuery += ` with at least ${wizardData.minBedrooms} bedrooms`;
    }

    if (wizardData.maxPrice) {
      searchQuery += ` under $${wizardData.maxPrice.toLocaleString()}`;
    }

    setWizardProcessing(true);

    // Clear any previous search results
    localStorage.removeItem("pendingSellerResponse");
    localStorage.removeItem("pendingSellerCards");

    // Call real BatchData API for seller leads
    try {
      const searchCriteria: any = {
        location: location,
        sellerType: wizardData.sellerType,
        propertyType: wizardData.propertyType,
        minBedrooms: wizardData.minBedrooms,
        maxPrice: wizardData.maxPrice,
        minPrice: wizardData.minPrice,
      };
      if (locations && locations.length > 0) {
        searchCriteria.locations = locations;
      }

      console.log(
        "🔍 Calling BatchData API for seller leads with criteria:",
        searchCriteria,
      );

      const response = await apiRequest("POST", "/api/properties/batch", {
        count: 5,
        criteria: searchCriteria,
      });

      // Parse the JSON from the Response object
      const data = await response.json();

      console.log("🔍 Frontend received raw response:", response);
      console.log("🔍 Frontend parsed data:", data);
      console.log("🔍 Data properties:", data.properties);
      console.log("🔍 Data properties length:", data.properties?.length);

      const properties = data.properties || [];

      console.log("🔍 Final properties array:", properties);
      console.log("🔍 Final properties length:", properties.length);

      // Handle case when no properties are found
      if (properties.length === 0) {
        const noResultsMessage = `I searched for properties in **${location}** but couldn't find any that match your specific criteria:

🔍 **Search Criteria:**
• Location: ${location}
• Seller Type: ${wizardData.sellerType.replace(/_/g, " ")}
• Property Type: ${wizardData.propertyType.replace(/_/g, " ")}
${wizardData.minBedrooms ? `• Min Bedrooms: ${wizardData.minBedrooms}` : ""}
${wizardData.maxPrice ? `• Max Price: $${wizardData.maxPrice.toLocaleString()}` : ""}

💡 **Suggestions:**
• Try a broader location (like a full city/state)
• Increase your price range
• Reduce bedroom requirements
• Try "any" for seller or property type

Would you like to adjust your search criteria and try again?`;

        if (!currentConversation) {
          localStorage.setItem("pendingSellerResponse", noResultsMessage);
          createConversationMutation.mutate({
            agentType: selectedAgent,
            title: `No Results: ${location}`,
          });
        } else {
          await apiRequest(
            "POST",
            `/api/conversations/${currentConversation}/messages`,
            {
              content: searchQuery,
              role: "user",
            },
          );
          await apiRequest(
            "POST",
            `/api/conversations/${currentConversation}/messages`,
            {
              content: noResultsMessage,
              role: "assistant",
              isAiGenerated: true,
            },
          );
          queryClient.invalidateQueries({
            queryKey: ["/api/conversations", currentConversation, "messages"],
          });
        }

        setShowWizard(false);
        setWizardStep(1);
        setWizardProcessing(false);
        return;
      }

      // Create intro message with real data
      const introMessage = `Great! I found ${properties.length} motivated seller leads in **${location}**. Here are your top prospects:`;

      if (!currentConversation) {
        // Store the data for when the new conversation is created
        localStorage.setItem("pendingSellerResponse", introMessage);
        localStorage.setItem("pendingSellerCards", JSON.stringify(properties));

        createConversationMutation.mutate({
          agentType: selectedAgent,
          title: `Lead Search: ${wizardData.city}, ${wizardData.state}`,
        });

        // The cards will be displayed when the new conversation is created
        // due to the useEffect that checks for pendingSellerResponse
      } else {
        // Send user query first
        await apiRequest(
          "POST",
          `/api/conversations/${currentConversation}/messages`,
          {
            content: searchQuery,
            role: "user",
          },
        );

        // Send the intro message
        await apiRequest(
          "POST",
          `/api/conversations/${currentConversation}/messages`,
          {
            content: introMessage,
            role: "assistant",
            isAiGenerated: true,
          },
        );

        // Send property cards after intro message with a small delay
        for (let i = 0; i < properties.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, 400)); // Small delay between cards
          const rawProperty = properties[i];

          // Normalize property object to ensure camelCase field names
          const property = {
            ...rawProperty,
            lastSalePrice:
              rawProperty.lastSalePrice || rawProperty.last_sale_price,
            lastSaleDate:
              rawProperty.lastSaleDate || rawProperty.last_sale_date,
            equityPercentage:
              rawProperty.equityPercentage ||
              rawProperty.equity_percentage ||
              0,
          };

          console.log("🔍 PropertyCard Template: Normalized property:", {
            address: property.address,
            lastSalePrice: property.lastSalePrice,
            lastSaleDate: property.lastSaleDate,
            equityPercentage: property.equityPercentage,
            hasLastSalePrice: !!property.lastSalePrice,
            hasLastSaleDate: !!property.lastSaleDate,
            hasEquityPercentage: !!property.equityPercentage,
          });

          // Use building data from original BatchData search - no additional API calls needed
          const buildingDetails = `
🏗️ BUILDING DETAILS
   🏠 ${property.bedrooms || "Contact seller"} bed, ${property.bathrooms || "Contact seller"} bath${property.squareFeet ? ` | ${property.squareFeet.toLocaleString()} sq ft` : " | Contact seller for sq ft"}
   📅 Built: ${property.yearBuilt || "Contact seller for year built"}
   📐 Property Type: ${property.propertyType?.replace(/_/g, " ") || "Single Family"}
   💰 Market Value: $${parseInt(property.arv).toLocaleString()}`;

          const propertyCard = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 SELLER LEAD ${i + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 LOCATION
   ${property.address}, ${property.city}, ${property.state} ${property.zipCode}

${buildingDetails}

🏠 PROPERTY DETAILS
   Total Area                   ${property.squareFeet ? property.squareFeet.toLocaleString() + " sqft" : "Contact for details"}
   Property Type                ${property.propertyType?.replace(/_/g, " ") || "Single Family"}
   Bedrooms                     ${property.bedrooms || "Contact seller"}
   Bathrooms                    ${property.bathrooms || "Contact seller"}

👤 OWNER INFORMATION
   Owner Name                   ${property.ownerName}
   Mailing Address              ${property.ownerMailingAddress}

📞 CONTACT INFORMATION
   Email(s)                     ${property.ownerEmails && property.ownerEmails.length > 0 ? property.ownerEmails.join(", ") : "Contact for details"}
   Phone(s)                     ${
     property.ownerPhoneNumbers && property.ownerPhoneNumbers.length > 0
       ? property.ownerPhoneNumbers
           .filter((p: any) => !p.dnc)
           .map((p: any) => `${p.number} (${p.type})`)
           .join(", ") || "Contact for details"
       : "Contact for details"
   }
   DNC Phone(s)                 ${
     property.ownerPhoneNumbers &&
     property.ownerPhoneNumbers.filter((p: any) => p.dnc).length > 0
       ? property.ownerPhoneNumbers
           .filter((p: any) => p.dnc)
           .map((p: any) => `${p.number} (${p.type})`)
           .join(", ")
       : "None on record"
   }
   Mailing Address              ${property.ownerMailingAddress}

💰 Valuation Details

As of Date                    ${new Date().toLocaleDateString()}
Confidence Score             ${property.confidenceScore}
Equity Balance               $${(parseInt(property.arv) * (property.equityPercentage / 100)).toLocaleString()}
Equity Percent               ${property.equityPercentage}%
Estimated Value              $${parseInt(property.arv).toLocaleString()}
Max Offer (70% Rule)         $${parseInt(property.maxOffer).toLocaleString()}
Last Sale Price              ${property.lastSalePrice ? `$${Number(property.lastSalePrice).toLocaleString()}` : "N/A"}
Last Sale Date               ${property.lastSaleDate || "N/A"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

          await apiRequest(
            "POST",
            `/api/conversations/${currentConversation}/messages`,
            {
              content: JSON.stringify({
                type: "property_card",
                data: property,
              }),
              role: "assistant",
              isAiGenerated: true,
            },
          );
        }

        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", currentConversation, "messages"],
        });
      }

      // Now close the wizard and reset state
      setShowWizard(false);
      setWizardStep(1);
      setWizardProcessing(false);
    } catch (error) {
      console.error("Error in wizard submit:", error);
      setShowWizard(false);
      setWizardStep(1);
      setWizardProcessing(false);
    }
  };

  const handleBuyerWizardSubmit = async () => {
    let location = "";
    const cityInput = buyerWizardData.city.trim();
    const zipPattern = /^\d{5}$/;

    if (zipPattern.test(cityInput)) {
      location = cityInput;
    } else if (cityInput.includes(",")) {
      const parts = cityInput.split(",").map((p) => p.trim());
      if (parts.length >= 2 && parts[1].length === 2) {
        location = cityInput;
      } else {
        location = `${parts[0]}, ${buyerWizardData.state}`;
      }
    } else {
      location = `${cityInput}, ${buyerWizardData.state}`;
    }

    setBuyerWizardProcessing(true);
    setShowBuyerWizard(false);
    setBuyerWizardStep(1);

    // Clear any previous search results to prevent mixing with new search
    localStorage.removeItem("pendingCashBuyerResponse");
    localStorage.removeItem("pendingCashBuyerCards");

    try {
      // Call real BatchData API for cash buyers
      console.log("🔍 Calling BatchData API for cash buyers in:", location);

      const response = await apiRequest("POST", "/api/cash-buyers/search", {
        location: location,
        buyerType: buyerWizardData.buyerType,
        minProperties: 3, // Looking for investors with 3+ properties
      });

      const cashBuyerData = await response.json();

      if (!cashBuyerData.success) {
        throw new Error(cashBuyerData.error || "Failed to fetch cash buyers");
      }

      // Store individual cash buyer cards to be sent as separate messages
      if (cashBuyerData.buyers && cashBuyerData.buyers.length > 0) {
        // Limit to exactly 5 buyers
        const buyersToShow = cashBuyerData.buyers.slice(0, 5);

        // Store intro message
        const introMessage = `Great! I found ${buyersToShow.length} qualified cash buyers with 3+ properties in **${location}**. Here are your leads:`;
        localStorage.setItem("pendingCashBuyerResponse", introMessage);

        // Store individual buyer cards
        const buyerCards = buyersToShow.map((buyer: any, index: number) => {
          const address = buyer.address || {};
          const owner = buyer.owner || {};
          const valuation = buyer.valuation || {};
          const building = buyer.building || {};
          const quickLists = buyer.quickLists || {};

          // Get best contact info
          const bestPhone =
            owner.phoneNumbers && owner.phoneNumbers[0]
              ? `(${owner.phoneNumbers[0].number.slice(0, 3)}) ${owner.phoneNumbers[0].number.slice(3, 6)}-${owner.phoneNumbers[0].number.slice(6)}`
              : "Contact for details";
          const bestEmail =
            owner.emails && owner.emails[0]
              ? owner.emails[0]
              : "Contact for details";

          // Get property owner profile data
          const ownerProfile = buyer.propertyOwnerProfile || {};
          const sale = buyer.sale || {};

          // Format last sale date
          const lastSaleDate = sale.lastSaleDate
            ? new Date(sale.lastSaleDate).toLocaleDateString()
            : "N/A";

          // Format phone numbers with types
          const formatPhoneNumbers = (phones: any[]) => {
            if (!phones || phones.length === 0) return "Contact for details";
            return phones
              .map((phone) => `${phone.number} (${phone.type})`)
              .join(", ");
          };

          // Get emails
          const emailList =
            owner.emails && owner.emails.length > 0
              ? owner.emails.join(", ")
              : "Contact for details";

          // Get phone numbers (separate regular and DNC)
          const phoneNumbers = owner.phoneNumbers || [];
          const regularPhones = phoneNumbers.filter((p: any) => !p.dnc);
          const dncPhones = phoneNumbers.filter((p: any) => p.dnc);

          // Create modern, sleek card design
          let cardContent = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QUALIFIED CASH BUYER #${index + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

          cardContent += `👤 𝗜𝗡𝗩𝗘𝗦𝗧𝗢𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘\n`;
          cardContent += `${owner.fullName || "ACTIVE CASH INVESTOR"}\n`;
          cardContent += `📍 Based in ${address.city}, ${address.state}\n\n`;

          cardContent += `💰 𝗣𝗢𝗥𝗧𝗙𝗢𝗟𝗜𝗢 𝗢𝗩𝗘𝗥𝗩𝗜𝗘𝗪\n`;
          cardContent += `• Total Portfolio Value: $${ownerProfile.propertiesTotalEstimatedValue ? parseInt(ownerProfile.propertiesTotalEstimatedValue).toLocaleString() : "N/A"}\n`;
          cardContent += `• Properties Owned: ${ownerProfile.propertiesCount || "N/A"} properties\n`;
          cardContent += `• Avg Purchase Price: $${ownerProfile.averagePurchasePrice ? parseInt(ownerProfile.averagePurchasePrice).toLocaleString() : "N/A"}\n`;
          cardContent += `• Last Activity: ${lastSaleDate}\n\n`;

          cardContent += `🏠 𝗥𝗘𝗖𝗘𝗡𝗧 𝗣𝗨𝗥𝗖𝗛𝗔𝗦𝗘\n`;
          cardContent += `📍 ${address.street}\n`;
          cardContent += `    ${address.city}, ${address.state} ${address.zip}\n`;
          cardContent += `🏘️ ${building.propertyType || "Single Family"} • ${building.squareFeet ? parseInt(building.squareFeet).toLocaleString() + " sqft" : "N/A"}\n`;
          cardContent += `🛏️ ${building.bedrooms || "N/A"} bed • 🛁 ${building.bathrooms || "N/A"} bath\n`;
          cardContent += `💵 Last Sale: $${sale.lastSalePrice ? parseInt(sale.lastSalePrice).toLocaleString() : valuation.estimatedValue ? parseInt(valuation.estimatedValue).toLocaleString() : "N/A"}\n\n`;

          cardContent += `📞 𝗖𝗢𝗡𝗧𝗔𝗖𝗧 𝗗𝗘𝗧𝗔𝗜𝗟𝗦\n`;
          cardContent += `📧 ${emailList}\n`;
          cardContent += `📮 ${owner.mailingAddress?.street || address.street}, ${owner.mailingAddress?.city || address.city}, ${owner.mailingAddress?.state || address.state} ${owner.mailingAddress?.zip || address.zip}\n`;

          if (regularPhones.length > 0) {
            cardContent += `📱 ${formatPhoneNumbers(regularPhones)}\n`;
          }

          if (dncPhones.length > 0) {
            cardContent += `🚫 DNC: ${formatPhoneNumbers(dncPhones)}\n`;
          }

          if (regularPhones.length === 0 && dncPhones.length === 0) {
            cardContent += `📱 Contact for details\n`;
          }

          cardContent += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

          return cardContent;
        });

        localStorage.setItem(
          "pendingCashBuyerCards",
          JSON.stringify(buyerCards),
        );
      } else {
        const errorMessage = `No active cash buyers found in ${location}. Try expanding your search area.`;
        localStorage.setItem("pendingCashBuyerResponse", errorMessage);
      }

      // Create conversation or send messages directly
      if (!currentConversation) {
        createConversationMutation.mutate({
          agentType: selectedAgent,
          title: `Cash Buyers: ${location} (${buyerWizardData.buyerType.replace(/_/g, " ")})`,
        });
      } else {
        // Send intro message immediately
        const introMessage = ` **CASH BUYER SEARCH COMPLETE**\n\nFound **5 qualified ${buyerWizardData.buyerType.replace(/_/g, " ")}** in **${location}**!\n\nHere are your investor leads:`;

        await apiRequest(
          "POST",
          `/api/conversations/${currentConversation}/messages`,
          {
            content: introMessage,
            role: "assistant",
            isAiGenerated: true,
          },
        );

        // Send individual buyer cards with a small delay
        setTimeout(async () => {
          const storedCards = localStorage.getItem("pendingCashBuyerCards");
          if (storedCards) {
            localStorage.removeItem("pendingCashBuyerCards");
            const buyerCards = JSON.parse(storedCards);

            for (let i = 0; i < buyerCards.length; i++) {
              await new Promise((resolve) => setTimeout(resolve, 400)); // Small delay between cards
              await apiRequest(
                "POST",
                `/api/conversations/${currentConversation}/messages`,
                {
                  content: buyerCards[i],
                  role: "assistant",
                  isAiGenerated: true,
                },
              );
            }
          }

          queryClient.invalidateQueries({
            queryKey: ["/api/conversations", currentConversation, "messages"],
          });
        }, 500);

        queryClient.invalidateQueries({
          queryKey: ["/api/conversations", currentConversation, "messages"],
        });
      }
    } catch (error: any) {
      console.error("🔥 FRONTEND: Cash buyer search failed:", error);

      // Show error message
      const errorMessage = `❌ **Cash Buyer Search Failed**\n\nError: ${error.message}\n\nPlease try again or contact support if the issue persists.`;

      // Store error message to be sent
      localStorage.setItem("pendingCashBuyerResponse", errorMessage);

      if (!currentConversation) {
        createConversationMutation.mutate({
          agentType: selectedAgent,
          title: `Cash Buyer Error: ${location}`,
        });
      } else {
        sendMessageMutation.mutate({
          content: errorMessage,
          role: "assistant",
        });
      }
    } finally {
      setBuyerWizardProcessing(false);
      setBuyerWizardData({ city: "", state: "", buyerType: "" });
    }
  };

  const renderBuyerWizard = () => {
    if (!showBuyerWizard) return null;

    return (
      <Card className="mb-4 border-2 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Cash Buyer Wizard - Step {buyerWizardStep} of 2
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Find active real estate investors and cash buyers
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {buyerWizardStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">
                Where are you looking for cash buyers?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="buyer-city">City or ZIP Code</Label>
                  <Input
                    id="buyer-city"
                    placeholder="e.g., Valley Forge, Philadelphia, 19481"
                    value={buyerWizardData.city}
                    onChange={(e) =>
                      setBuyerWizardData({
                        ...buyerWizardData,
                        city: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="buyer-state">State</Label>
                  <Select
                    value={buyerWizardData.state}
                    onValueChange={(value) =>
                      setBuyerWizardData({ ...buyerWizardData, state: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {buyerWizardStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">
                What type of cash buyer are you looking for?
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    id: "active_landlord",
                    name: "🏠 Active Landlord Buyers",
                    description:
                      "Investors focused on rental properties and portfolio growth",
                  },
                  {
                    id: "fix_and_flip",
                    name: "🔨 Fix and Flip Buyers",
                    description:
                      "Investors who buy, renovate, and resell properties",
                  },
                  {
                    id: "cash_buyers",
                    name: "💰 Cash Buyers",
                    description:
                      "General cash buyers looking for investment opportunities",
                  },
                  {
                    id: "builders",
                    name: "🏗️ Builders",
                    description:
                      "Construction companies and developers looking for projects",
                  },
                ].map((type) => (
                  <div
                    key={type.id}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      buyerWizardData.buyerType === type.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-green-300"
                    }`}
                    onClick={() =>
                      setBuyerWizardData({
                        ...buyerWizardData,
                        buyerType: type.id,
                      })
                    }
                  >
                    <div className="font-medium text-sm">{type.name}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {type.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (buyerWizardStep === 1) {
                  setShowBuyerWizard(false);
                  setBuyerWizardStep(1);
                  setBuyerWizardData({ city: "", state: "", buyerType: "" });
                } else {
                  setBuyerWizardStep(1);
                }
              }}
            >
              {buyerWizardStep === 1 ? "Cancel" : "Back"}
            </Button>

            {buyerWizardStep === 1 ? (
              <Button
                onClick={() => setBuyerWizardStep(2)}
                disabled={!buyerWizardData.city || !buyerWizardData.state}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleBuyerWizardSubmit}
                disabled={!buyerWizardData.buyerType}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <TrendingUp className="h-4 w-4" />
                Find Cash Buyers
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-slate-900">AI Agents</h1>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {agentTypes.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500">GPT-4 Powered</span>
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {renderBuyerWizard()}

        {/* Target Market Finder Results - Separate Output Page */}
        {targetMarketResults && (
          <Card className="mb-4 border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-purple-600" />
                Target Market Finder - Chat with Terry
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Interactive market analysis and research with AI • Third of 3
                Lead Finder wizards
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[600px] flex flex-col">
                {/* Chat Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                  {/* Initial Welcome Message */}
                  {terryMessages.length === 0 && (
                    <div className="flex items-start gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <div className="w-4 h-4 text-white">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2A2,2 0 0,1 14,4A2,2 0 0,1 12,6A2,2 0 0,1 10,4A2,2 0 0,1 12,2M21,9V7L15,1H5A2,2 0 0,0 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,21H5V3H13V9H19Z" />
                          </svg>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm max-w-md">
                        <p className="text-gray-900 font-medium">
                          Hey! I'm your new Target Market Finder Agent! I can
                          help find the best market in your area.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Chat Messages */}
                  {terryMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 mb-6 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === "user"
                            ? "bg-blue-600"
                            : "bg-gray-800"
                        }`}
                      >
                        <div className="w-4 h-4 text-white">
                          {message.role === "user" ? (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12,2A2,2 0 0,1 14,4A2,2 0 0,1 12,6A2,2 0 0,1 10,4A2,2 0 0,1 12,2M21,9V7L15,1H5A2,2 0 0,0 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,21H5V3H13V9H19Z" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div
                        className={`rounded-2xl p-4 shadow-sm max-w-md ${
                          message.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-900"
                        }`}
                      >
                        <div className="prose prose-sm max-w-none">
                          {message.role === "assistant" ? (
                            <div className="whitespace-pre-wrap">
                              {renderFormattedText(message.content)}
                            </div>
                          ) : (
                            <p>{message.content}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Loading Indicator */}
                  {terryLoading && (
                    <div className="flex items-start gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                        <div className="w-4 h-4 text-white">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2A2,2 0 0,1 14,4A2,2 0 0,1 12,6A2,2 0 0,1 10,4A2,2 0 0,1 12,2M21,9V7L15,1H5A2,2 0 0,0 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,21H5V3H13V9H19Z" />
                          </svg>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm max-w-md">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggested Questions (only show initially) */}
                {terryMessages.length === 0 && (
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                      <button
                        onClick={() =>
                          handleTerrySuggestedQuestion(
                            "Terry, can you tell me what you do and how you can help me become more successful with real estate investing?",
                          )
                        }
                        className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                      >
                        Terry, can you tell me what you do and how you can help
                        me become more successful with...
                      </button>
                      <button
                        onClick={() =>
                          handleTerrySuggestedQuestion(
                            "Terry, can you do market research in my area?",
                          )
                        }
                        className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                      >
                        Terry, can you do market research in my area?
                      </button>
                      <button
                        onClick={() =>
                          handleTerrySuggestedQuestion(
                            "Hey Terry, find me the best niche markets with the highest cash landlord purchase activity",
                          )
                        }
                        className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-gray-700"
                      >
                        Hey Terry, find me the best niche markets with the
                        highest cash landlord purchase...
                      </button>
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="px-6 py-4 bg-white border-t border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 text-gray-400">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={terryInput}
                      onChange={(e) => setTerryInput(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleTerrySendMessage()
                      }
                      placeholder="Let's Get Started! Type Anything You Need Help With"
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={terryLoading}
                    />
                    <button
                      onClick={() => handleTerrySendMessage()}
                      disabled={!terryInput.trim() || terryLoading}
                      className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTargetMarketResults(false);
                        setTerryMessages([]);
                        setTerryInput("");
                      }}
                      className="flex-1"
                    >
                      Start New Chat
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setTargetMarketResults(false)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Back to Wizards
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing indicator */}
        {(wizardProcessing ||
          buyerWizardProcessing ||
          sendMessageMutation.isPending) && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-800">
                    🔍 Searching Properties...
                  </h3>
                  <p className="text-sm text-blue-600 mt-1">
                    {wizardData.city && wizardData.state
                      ? `Analyzing ${wizardData.city}, ${wizardData.state} with BatchData API for distressed properties and motivated sellers`
                      : "Analyzing property data with BatchData API for distressed properties and motivated sellers"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {messages.length === 0 &&
          !currentConversation &&
          !showWizard &&
          !showBuyerWizard &&
          !targetMarketResults &&
          !wizardProcessing &&
          !buyerWizardProcessing && (
            <div className="space-y-4">
              {/* Seller Lead Finder Card */}
              <div className="flex items-start space-x-3">
                <Avatar>
                  <AvatarImage />
                  <AvatarFallback>
                    <Search className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-slate-900">
                        {selectedAgent === "lead-finder" &&
                          "Hello! I'm your Seller Lead Finder. I can help you discover off-market properties, distressed sales, and motivated sellers. Use the wizard below to get started!"}
                        {selectedAgent === "deal-analyzer" &&
                          "Hi! I'm your Deal Analyzer Agent. I can help you analyze property deals, calculate ARV, estimate repair costs, and determine maximum allowable offers. Share a property address to get started!"}
                        {selectedAgent === "negotiation" &&
                          "Hello! I'm your Negotiation Agent. I can help you craft compelling offers, write follow-up messages, and develop negotiation strategies for your deals. What property are you working on?"}
                        {selectedAgent === "closing" &&
                          "Hi! I'm your Closing Agent. I can help you prepare contracts, coordinate closings, and manage documents. What deal are you looking to close?"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedAgent === "lead-finder" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowWizard(true)}
                              className="flex items-center gap-2 mb-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                            >
                              <Search className="h-4 w-4" />
                              Use Seller Lead Wizard
                            </Button>
                          </>
                        )}
                        {selectedAgent === "deal-analyzer" && (
                          <>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Calculate ARV
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Estimate repairs
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Find comps
                            </Badge>
                          </>
                        )}
                        {selectedAgent === "negotiation" && (
                          <>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Write offer letter
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Follow-up script
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Objection handling
                            </Badge>
                          </>
                        )}
                        {selectedAgent === "closing" && (
                          <>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Purchase agreement
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Assignment contract
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="cursor-pointer hover:bg-slate-200"
                            >
                              Closing checklist
                            </Badge>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Cash Buyer Wizard Card - Only for Lead Finder */}
              {selectedAgent === "lead-finder" && (
                <div className="flex items-start space-x-3">
                  <Avatar>
                    <AvatarImage />
                    <AvatarFallback>
                      <TrendingUp className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-slate-900">
                          Hello! I'm your Cash Buyer Finder. I can help you
                          discover active real estate investors, cash buyers,
                          and portfolio managers. Use the wizard below to get
                          started!
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowBuyerWizard(true)}
                            className="flex items-center gap-2 mb-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                          >
                            <TrendingUp className="h-4 w-4" />
                            Use Cash Buyer Wizard
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Target Market Finder - Only for Lead Finder */}
              {selectedAgent === "lead-finder" && (
                <div className="flex items-start space-x-3">
                  <Avatar>
                    <AvatarImage />
                    <AvatarFallback>
                      <Lightbulb className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-slate-900">
                          Hello! I'm your Target Market Finder. I help identify
                          and analyze ideal market areas for real estate
                          investing. Click below to access the interactive
                          market analysis tool!
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowTargetMarketFinder(false);
                              setTargetMarketResults(true);
                            }}
                            className="flex items-center gap-2 mb-2 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                          >
                            <Lightbulb className="h-4 w-4" />
                            Use Target Market Finder
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Wizard */}
        {showWizard && (
          <Card className="mb-4 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-600" />
                Seller Lead Wizard - Step {wizardStep} of 4
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Find distressed properties and motivated sellers • First of 3
                Lead Finder wizards
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    Where are you looking for properties?
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City or ZIP Code</Label>
                      <Input
                        id="city"
                        placeholder="e.g., Valley Forge, Philadelphia, 19481"
                        value={wizardData.city}
                        onChange={(e) =>
                          setWizardData({ ...wizardData, city: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Select
                        value={wizardData.state}
                        onValueChange={(value) =>
                          setWizardData({ ...wizardData, state: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {states.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    What type of sellers are you targeting?
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {sellerTypes.map((type) => (
                      <button
                        key={type.value}
                        className={`p-3 text-left rounded-lg border transition-colors ${
                          wizardData.sellerType === type.value
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() =>
                          setWizardData({
                            ...wizardData,
                            sellerType: type.value,
                          })
                        }
                      >
                        <div className="font-medium">{type.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    What property type are you interested in?
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {propertyTypes.map((type) => (
                      <button
                        key={type.value}
                        className={`p-3 text-left rounded-lg border transition-colors ${
                          wizardData.propertyType === type.value
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() =>
                          setWizardData({
                            ...wizardData,
                            propertyType: type.value,
                          })
                        }
                      >
                        <div className="font-medium">{type.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">
                    Additional filters (optional)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minBedrooms">Minimum Bedrooms</Label>
                      <Select
                        value={(wizardData.minBedrooms ?? 1).toString()}
                        onValueChange={(value) =>
                          setWizardData({
                            ...wizardData,
                            minBedrooms: value ? parseInt(value) : undefined,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                          <SelectItem value="5">5+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="maxPrice">Maximum Price</Label>
                      <Select
                        value={(wizardData.maxPrice ?? 3000000).toString()}
                        onValueChange={(value) =>
                          setWizardData({
                            ...wizardData,
                            maxPrice: value ? parseInt(value) : undefined,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3000000">
                            Up to $3M (default)
                          </SelectItem>
                          <SelectItem value="100000">Under $100k</SelectItem>
                          <SelectItem value="200000">Under $200k</SelectItem>
                          <SelectItem value="300000">Under $300k</SelectItem>
                          <SelectItem value="500000">Under $500k</SelectItem>
                          <SelectItem value="750000">Under $750k</SelectItem>
                          <SelectItem value="1000000">Under $1M</SelectItem>
                          <SelectItem value="1500000">$1–1.5M</SelectItem>
                          <SelectItem value="2000000">$1–2M</SelectItem>
                          <SelectItem value="3000000">$1–3M</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setShowWizard(false)}>
                  Cancel
                </Button>
                <div className="flex gap-2">
                  {wizardStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => setWizardStep(wizardStep - 1)}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  )}
                  <Button
                    onClick={async () => {
                      if (wizardStep < 4) {
                        setWizardStep(wizardStep + 1);
                      } else {
                        await handleWizardSubmit();
                      }
                    }}
                    disabled={
                      (wizardStep === 1 &&
                        (!wizardData.city || !wizardData.state)) ||
                      (wizardStep === 2 && !wizardData.sellerType) ||
                      (wizardStep === 3 && !wizardData.propertyType)
                    }
                  >
                    {wizardStep === 4 ? (
                      <>
                        <Search className="h-4 w-4 mr-1" />
                        Find Properties
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start space-x-3 ${message.role === "user" ? "justify-end" : ""}`}
          >
            {message.role === "assistant" && (
              <Avatar>
                <AvatarImage />
                <AvatarFallback>
                  {currentAgent && <currentAgent.icon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={`flex-1 ${message.role === "user" ? "max-w-xs sm:max-w-md" : ""}`}
            >
              <Card
                className={
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : ""
                }
              >
                <CardContent className="p-4">
                  {(() => {
                    try {
                      const parsed = JSON.parse(message.content);
                      if (parsed.type === "property_card") {
                        return (
                          <CondensedPropertyCard
                            property={parsed.data}
                            onViewDetails={handleViewDetails}
                          />
                        );
                      }
                    } catch (e) {
                      // Not JSON, check for legacy format
                    }

                    if (
                      message.content.includes("🏠 SELLER LEAD") ||
                      message.content.includes("🎯 QUALIFIED CASH BUYER #")
                    ) {
                      return <PropertyCard content={message.content} />;
                    }

                    return (
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
            {message.role === "user" && (
              <Avatar>
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <Textarea
              placeholder={`Ask your ${currentAgent?.name.replace(/[🔍📊💬📋]/g, "").trim()} anything...`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={3}
              className="resize-none"
            />
          </div>
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || sendMessageMutation.isPending}
            size="lg"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Modal Renderer */}
      <PropertyDetailsModal
        property={selectedProperty}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}