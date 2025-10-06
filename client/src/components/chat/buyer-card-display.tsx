import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface BuyerCardDisplayProps {
  content: string;
}

export function BuyerCardDisplay({ content }: BuyerCardDisplayProps) {
  const handleAddToCRM = () => {
    console.log('Add to CRM clicked');
    // TODO: Implement add to CRM functionality
  };

  const handlePass = () => {
    console.log("I'll Pass clicked");
    // TODO: Implement pass functionality
  };

  const handleContactBuyer = () => {
    console.log('Contact Buyer clicked');
    // TODO: Implement contact buyer functionality
  };

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden bg-white border border-slate-200 shadow-sm">
      <CardContent className="p-0">
        {/* Display the formatted content */}
        <div className="text-sm whitespace-pre-wrap font-mono bg-slate-50 p-4 border-b">
          {content}
        </div>

        {/* Action buttons */}
        <div className="bg-gray-50 p-4">
          <div className="flex gap-2">
            <Button
              onClick={handleAddToCRM}
              variant="outline"
              size="sm"
              className="!bg-emerald-50 !border-emerald-200 !text-emerald-700 hover:!bg-emerald-100"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add to CRM
            </Button>
            <Button
              onClick={handlePass}
              variant="outline"
              size="sm"
              className="!bg-rose-50 !border-rose-200 !text-rose-600 hover:!bg-rose-100"
            >
              I'll Pass
            </Button>
            <Button
              onClick={handleContactBuyer}
              variant="outline"
              size="sm"
              className="!bg-sky-50 !border-sky-200 !text-sky-700 hover:!bg-sky-100"
            >
              Contact Buyer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}