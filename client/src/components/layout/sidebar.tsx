import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageSquare, 
  Users, 
  BarChart3, 
  Mail, 
  FileText, 
  LayoutDashboard, 
  Plus,
  Briefcase,
  X,
  LogOut
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";

type Section = "chat" | "crm" | "pipeline" | "messages" | "documents" | "dashboard";

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  onClose?: () => void;
}

export default function Sidebar({ activeSection, onSectionChange, onClose }: SidebarProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const navItems = [
    { id: "chat" as Section, label: "AI Agents", icon: MessageSquare },
    { id: "crm" as Section, label: "CRM & Leads", icon: Users },
    { id: "pipeline" as Section, label: "Deal Pipeline", icon: BarChart3 },
    { id: "messages" as Section, label: "Messages", icon: Mail },
    { id: "documents" as Section, label: "Documents", icon: FileText },
    { id: "dashboard" as Section, label: "Dashboard", icon: LayoutDashboard },
  ];

  return (
    <div className="flex flex-col h-full pt-5 pb-4 overflow-y-auto bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 mb-8">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="ml-2 text-xl font-bold text-slate-900">WholesaleAI</span>
        </div>
        {isMobile && onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* New Chat Button */}
      <div className="px-4 mb-4">
        <Button className="w-full" onClick={() => onSectionChange("chat")}>
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={activeSection === item.id ? "secondary" : "ghost"}
            className={`w-full justify-start ${
              activeSection === item.id 
                ? "bg-primary/10 text-primary hover:bg-primary/20" 
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => {
              onSectionChange(item.id);
              if (isMobile && onClose) onClose();
            }}
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </Button>
        ))}
      </nav>

      <Separator className="mx-4 my-4" />

      {/* Recent Chats */}
      <div className="px-4">
        <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Recent Chats
        </h3>
        <div className="space-y-1">
          <div className="px-3 py-2 text-sm text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer">
            <p className="truncate">Deal Analysis: Oak Street</p>
            <p className="text-xs text-slate-500">2 hours ago</p>
          </div>
          <div className="px-3 py-2 text-sm text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer">
            <p className="truncate">Lead Research: Dallas</p>
            <p className="text-xs text-slate-500">1 day ago</p>
          </div>
        </div>
      </div>

      <Separator className="mx-4 my-4" />

      {/* User Profile */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || ""} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {user?.firstName?.[0] || user?.email?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => window.location.href = "/api/logout"}
            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
