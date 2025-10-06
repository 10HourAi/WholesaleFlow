
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BuyerCardDisplayProps {
  content: string;
}

export function BuyerCardDisplay({ content }: BuyerCardDisplayProps) {
  // Extract buyer data from formatted text
  const extractBuyerData = (text: string) => {
    const data: any = {};

    // Extract buyer number
    const buyerMatch = text.match(/QUALIFIED CASH BUYER #(\d+)/);
    data.buyerNumber = buyerMatch ? buyerMatch[1] : '1';

    // Extract investor name
    const nameMatch = text.match(/👤 𝗜𝗡𝗩𝗘𝗦𝗧𝗢𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘\s*\n\s*(.+?)\s*\n/);
    data.investorName = nameMatch ? nameMatch[1] : 'Cash Investor';

    // Extract location
    const locationMatch = text.match(/📍 Based in (.+)/);
    data.location = locationMatch ? locationMatch[1] : '';

    // Extract portfolio value
    const portfolioMatch = text.match(/Total Portfolio Value: \$([0-9,]+)/);
    data.portfolioValue = portfolioMatch ? portfolioMatch[1] : 'N/A';

    // Extract properties count
    const propertiesMatch = text.match(/Properties Owned: (\d+) properties/);
    data.propertiesCount = propertiesMatch ? propertiesMatch[1] : 'N/A';

    // Extract average purchase price
    const avgPriceMatch = text.match(/Avg Purchase Price: \$([0-9,]+)/);
    data.avgPurchasePrice = avgPriceMatch ? avgPriceMatch[1] : 'N/A';

    // Extract last activity
    const activityMatch = text.match(/Last Activity: (.+)/);
    data.lastActivity = activityMatch ? activityMatch[1] : 'N/A';

    // Extract recent purchase address
    const addressMatch = text.match(/📍 (.+?)\n.*?(.+?), (.+?) (\d{5})/s);
    if (addressMatch) {
      data.recentAddress = addressMatch[1].trim();
      data.city = addressMatch[2].trim();
      data.state = addressMatch[3].trim();
      data.zipCode = addressMatch[4].trim();
    }

    // Extract property type and square feet
    const propertyDetailsMatch = text.match(/🏘️ (.+?) • (.+?) sqft/);
    if (propertyDetailsMatch) {
      data.propertyType = propertyDetailsMatch[1].trim();
      data.squareFeet = propertyDetailsMatch[2].trim();
    }

    // Extract beds/baths
    const bedsMatch = text.match(/🛏️ (\d+) bed/);
    const bathsMatch = text.match(/🛁 (\d+) bath/);
    data.bedrooms = bedsMatch ? bedsMatch[1] : 'N/A';
    data.bathrooms = bathsMatch ? bathsMatch[1] : 'N/A';

    // Extract last sale price
    const saleMatch = text.match(/💵 Last Sale: \$([0-9,]+)/);
    data.lastSalePrice = saleMatch ? saleMatch[1] : 'N/A';

    // Extract email
    const emailMatch = text.match(/📧 (.+?)\n/);
    data.email = emailMatch ? emailMatch[1].trim() : 'Contact for details';

    // Extract mailing address
    const mailingMatch = text.match(/📮 (.+?)(?:\n|$)/);
    data.mailingAddress = mailingMatch ? mailingMatch[1].trim() : 'N/A';

    // Extract phone numbers
    const phoneMatches = text.match(/📱 (.+?)(?:\n|$)/);
    data.phone = phoneMatches ? phoneMatches[1].trim() : 'Contact for details';

    // Extract DNC phones
    const dncMatch = text.match(/🚫 DNC: (.+?)(?:\n|$)/);
    data.dncPhone = dncMatch ? dncMatch[1].trim() : null;

    return data;
  };

  const buyerData = extractBuyerData(content);

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden bg-white border border-gray-200 shadow-sm">
      <CardContent className="p-6">
        {/* Header with Location and Buyer Badge */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">{buyerData.location || 'Location'}</p>
            <p className="font-semibold text-lg text-gray-800">
              {buyerData.investorName}
            </p>
          </div>
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            Buyer
          </Badge>
        </div>

        {/* Investor Name (Owner Name equivalent) */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-1">Investor Name</p>
          <p className="font-medium text-gray-800">
            {buyerData.investorName}
          </p>
        </div>

        {/* Portfolio Details Grid (equivalent to Property Details) */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Properties Owned</p>
            <p className="font-semibold text-xl text-gray-800">
              {buyerData.propertiesCount}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Avg Purchase</p>
            <p className="font-semibold text-xl text-gray-800">
              ${buyerData.avgPurchasePrice}
            </p>
          </div>
        </div>

        {/* Financial Information */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Portfolio Value</p>
            <p className="font-semibold text-lg text-gray-800">
              ${buyerData.portfolioValue}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Last Activity</p>
            <p className="font-semibold text-lg text-gray-800">
              {buyerData.lastActivity}
            </p>
          </div>
        </div>

        {/* Recent Purchase Details */}
        {buyerData.recentAddress && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Recent Property</p>
                <p className="font-semibold text-lg text-gray-800">
                  {buyerData.propertyType || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Square Feet</p>
                <p className="font-semibold text-lg text-gray-800">
                  {buyerData.squareFeet || 'N/A'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Beds</p>
                <p className="font-semibold text-xl text-gray-800">
                  {buyerData.bedrooms}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Baths</p>
                <p className="font-semibold text-xl text-gray-800">
                  {buyerData.bathrooms}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Last Sale Price - Prominent Display */}
        <div className="mb-6 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-600 mb-1">Last Sale Price</p>
          <p className="text-2xl font-bold text-blue-700">
            ${buyerData.lastSalePrice}
          </p>
        </div>

        {/* Contact Information */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Contact Information</p>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium text-gray-600">Email:</span>
              <p className="text-gray-800">{buyerData.email}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Phone:</span>
              <p className="text-gray-800">{buyerData.phone}</p>
            </div>
            {buyerData.dncPhone && (
              <div>
                <span className="font-medium text-gray-600">DNC Phone:</span>
                <p className="text-red-600">{buyerData.dncPhone}</p>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-600">Mailing Address:</span>
              <p className="text-gray-800">{buyerData.mailingAddress}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
