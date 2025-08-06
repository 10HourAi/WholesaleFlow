import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { Deal, Property } from "@shared/schema";

const stages = [
  { id: "lead_generation", name: "Lead Generation", color: "bg-slate-50" },
  { id: "analysis", name: "Analysis", color: "bg-yellow-50" },
  { id: "negotiation", name: "Negotiation", color: "bg-blue-50" },
  { id: "closing", name: "Closing", color: "bg-green-50" },
];

export default function KanbanBoard() {
  const [timeFilter, setTimeFilter] = useState("all");

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const getPropertyForDeal = (dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    return deal ? properties.find(p => p.id === deal.propertyId) : undefined;
  };

  const getDealsByStage = (stage: string) => {
    return deals.filter(deal => deal.stage === stage);
  };

  const getStageStats = () => {
    const totalPipeline = deals.reduce((sum, deal) => sum + Number(deal.dealValue || 0), 0);
    const closedThisMonth = deals
      .filter(deal => deal.stage === "closing" && deal.closeDate)
      .reduce((sum, deal) => sum + Number(deal.dealValue || 0), 0);
    const activeDeals = deals.filter(deal => deal.stage !== "closing").length;
    const closeRate = deals.length > 0 ? Math.round((deals.filter(d => d.stage === "closing").length / deals.length) * 100) : 0;

    return { totalPipeline, closedThisMonth, activeDeals, closeRate };
  };

  const stats = getStageStats();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Deal Pipeline</h1>
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Deals</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="p-4 bg-white border-b border-slate-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-slate-900">${stats.totalPipeline.toLocaleString()}</div>
              <div className="text-sm text-slate-500">Total Pipeline</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">${stats.closedThisMonth.toLocaleString()}</div>
              <div className="text-sm text-slate-500">Closed This Month</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.activeDeals}</div>
              <div className="text-sm text-slate-500">Active Deals</div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-600">{stats.closeRate}%</div>
              <div className="text-sm text-slate-500">Close Rate</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex space-x-4 h-full min-w-max">
          {stages.map((stage) => {
            const stageDeals = getDealsByStage(stage.id);
            return (
              <div key={stage.id} className={`w-80 ${stage.color} rounded-lg`}>
                <div className="p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">{stage.name}</h3>
                    <Badge variant="secondary">{stageDeals.length}</Badge>
                  </div>
                </div>
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {stageDeals.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-500 text-sm">No deals in this stage</p>
                    </div>
                  ) : (
                    stageDeals.map((deal) => {
                      const property = properties.find(p => p.id === deal.propertyId);
                      return (
                        <Card key={deal.id} className="bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                          <CardContent className="p-3">
                            <h4 className="font-medium text-slate-900">
                              {property ? `${property.address}` : "Unknown Property"}
                            </h4>
                            <p className="text-sm text-slate-500 mt-1">
                              {property ? `${property.city}, ${property.state} • ${property.bedrooms}/${property.bathrooms} • ${property.squareFeet} sqft` : "No property details"}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-sm font-medium text-green-600">
                                {deal.dealValue ? `Deal: $${Number(deal.dealValue).toLocaleString()}` : "No value"}
                              </span>
                              <Badge 
                                variant="outline"
                                className={
                                  stage.id === "lead_generation" ? "border-slate-400 text-slate-700" :
                                  stage.id === "analysis" ? "border-yellow-400 text-yellow-700" :
                                  stage.id === "negotiation" ? "border-blue-400 text-blue-700" :
                                  "border-green-400 text-green-700"
                                }
                              >
                                {stage.id === "closing" ? "Under Contract" : stage.name}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
