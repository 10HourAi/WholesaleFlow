import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DollarSign, CheckCircle, Users, TrendingUp, Activity, MessageSquare, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Property, Deal, Conversation } from "@shared/schema";

export default function MetricsDashboard() {
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const calculateMetrics = () => {
    const totalRevenue = deals
      .filter(deal => deal.stage === "closing")
      .reduce((sum, deal) => sum + Number(deal.dealValue || 0), 0);
    
    const dealsThisMonth = deals.filter(deal => {
      const dealDate = deal.createdAt;
      if (!dealDate) return false;
      const now = new Date();
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      return dealDate >= monthAgo;
    }).length;

    const closedDeals = deals.filter(deal => deal.stage === "closing").length;
    const conversionRate = properties.length > 0 ? (closedDeals / properties.length) * 100 : 0;

    return {
      totalRevenue,
      dealsThisMonth,
      activeLeads: properties.filter(p => p.status !== "closed").length,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  };

  const getDealsByStage = () => {
    const stages = ["lead_generation", "analysis", "negotiation", "closing"];
    return stages.map(stage => ({
      stage,
      count: deals.filter(deal => deal.stage === stage).length,
      percentage: deals.length > 0 ? (deals.filter(deal => deal.stage === stage).length / deals.length) * 100 : 0
    }));
  };

  const getRecentActivity = () => {
    const activities = [
      ...deals.slice(-3).map(deal => ({
        type: "deal_closed",
        message: `Deal closed: Property ${deal.id.slice(0, 8)}...`,
        time: deal.updatedAt || deal.createdAt,
        icon: CheckCircle,
        color: "text-green-600"
      })),
      ...conversations.slice(-2).map(conv => ({
        type: "message",
        message: `New conversation: ${conv.title}`,
        time: conv.updatedAt || conv.createdAt,
        icon: MessageSquare,
        color: "text-blue-600"
      })),
      ...properties.slice(-2).map(prop => ({
        type: "lead_found",
        message: `Lead found: ${prop.address}`,
        time: prop.createdAt,
        icon: Search,
        color: "text-yellow-600"
      }))
    ].sort((a, b) => {
      const timeA = a.time?.getTime() || 0;
      const timeB = b.time?.getTime() || 0;
      return timeB - timeA;
    }).slice(0, 5);

    return activities;
  };

  const metrics = calculateMetrics();
  const stageData = getDealsByStage();
  const recentActivity = getRecentActivity();

  const formatTime = (date: Date | null) => {
    if (!date) return "Unknown time";
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">Dashboard & Analytics</h1>
        <div className="flex items-center space-x-3">
          <Select defaultValue="30days">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30days">Last 30 Days</SelectItem>
              <SelectItem value="90days">Last 90 Days</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">Export Report</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">
                    ${metrics.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center">
                <span className="text-green-600 text-sm font-medium">+12.5%</span>
                <span className="text-slate-500 text-sm ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Deals Closed</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.dealsThisMonth}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center">
                <span className="text-green-600 text-sm font-medium">+8.2%</span>
                <span className="text-slate-500 text-sm ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Leads</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.activeLeads}</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center">
                <span className="text-red-600 text-sm font-medium">-3.1%</span>
                <span className="text-slate-500 text-sm ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Conversion Rate</p>
                  <p className="text-2xl font-bold text-slate-900">{metrics.conversionRate}%</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center">
                <span className="text-green-600 text-sm font-medium">+5.3%</span>
                <span className="text-slate-500 text-sm ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500">Revenue chart would be displayed here</p>
                  <p className="text-sm text-slate-400">Integration with charting library needed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deals by Stage */}
          <Card>
            <CardHeader>
              <CardTitle>Deals by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stageData.map((stage) => (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 capitalize">
                        {stage.stage.replace("_", " ")}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-slate-900">{stage.count}</span>
                      </div>
                    </div>
                    <Progress value={stage.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-500">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                      <activity.icon className={`w-4 h-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-900">{activity.message}</p>
                      <p className="text-xs text-slate-500">{formatTime(activity.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
