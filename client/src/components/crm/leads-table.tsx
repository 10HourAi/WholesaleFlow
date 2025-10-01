import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Property, Contact } from "@shared/schema";
import PropertyCard from "./property-card";

export default function LeadsTable() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isPropertyCardOpen, setIsPropertyCardOpen] = useState(false);

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    refetchInterval: 5000, // Refetch every 5 seconds to keep data fresh
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: properties.length > 0, // Only fetch contacts if we have properties
  });

  const filteredProperties = properties
    .filter(property => {
      const matchesStatus = statusFilter === "all" || property.status === statusFilter;
      const matchesSearch = property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.city.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      // Sort by creation date, newest first
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-slate-100 text-slate-800";
      case "contacted": return "bg-yellow-100 text-yellow-800";
      case "qualified": return "bg-green-100 text-green-800";
      case "under_contract": return "bg-blue-100 text-blue-800";
      case "closed": return "bg-purple-100 text-purple-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const getContactForProperty = (propertyId: string) => {
    return contacts.find(contact => contact.propertyId === propertyId);
  };

  const handleViewProperty = (property: Property) => {
    setSelectedProperty(property);
    setIsPropertyCardOpen(true);
  };

  const handleClosePropertyCard = () => {
    setIsPropertyCardOpen(false);
    setSelectedProperty(null);
  };

  const stats = {
    total: properties.length,
    qualified: properties.filter(p => p.status === "qualified").length,
    underContract: properties.filter(p => p.status === "under_contract").length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
        <h1 className="text-lg font-semibold text-slate-900">CRM & Lead Management</h1>
        <div className="flex items-center space-x-3">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters and Stats */}
      <div className="p-4 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="under_contract">Under Contract</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm">
          <div className="text-center">
            <div className="font-semibold text-slate-900">{stats.total}</div>
            <div className="text-slate-500">Total Leads</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-green-600">{stats.qualified}</div>
            <div className="text-slate-500">Qualified</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-blue-600">{stats.underContract}</div>
            <div className="text-slate-500">Under Contract</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filteredProperties.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6 text-center">
                <h3 className="text-lg font-medium text-slate-900 mb-2">No leads found</h3>
                <p className="text-slate-600 mb-4">Start by adding your first property lead or adjust your filters.</p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lead
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ARV</TableHead>
                <TableHead>Max Offer</TableHead>
                <TableHead>Lead Type</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProperties.map((property) => {
                const contact = getContactForProperty(property.id);
                return (
                  <TableRow key={property.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-900">
                          {property.address}, {property.city} {property.state}
                        </div>
                        <div className="text-sm text-slate-500">
                          {property.bedrooms}bd, {property.bathrooms}ba • {property.squareFeet} sq ft
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact ? (
                        <div>
                          <div className="text-sm text-slate-900">{contact.name}</div>
                          <div className="text-sm text-slate-500">{contact.phone}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">No contact</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(property.status)}>
                        {property.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-900">
                      {property.arv ? `$${Number(property.arv).toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-900">
                      {property.maxOffer ? `$${Number(property.maxOffer).toLocaleString()}` : "-"}
                    </TableCell>
                    <TableCell>
                      {property.leadType && (
                        <Badge variant="outline">
                          {property.leadType.replace("_", " ")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => handleViewProperty(property)}
                        data-testid={`button-work-lead-${property.id}`}
                      >
                        Work This Lead
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      
      {/* Property Card Modal */}
      <PropertyCard
        property={selectedProperty}
        contact={selectedProperty ? getContactForProperty(selectedProperty.id) : undefined}
        isOpen={isPropertyCardOpen}
        onClose={handleClosePropertyCard}
      />
    </div>
  );
}
