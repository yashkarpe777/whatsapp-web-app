import { useState } from "react";
import { Eye, Pause, Play, Copy, BarChart3 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { campaignsAPI } from "@/services/api";

interface CampaignCardProps {
  id?: string;
  name: string;
  status: "active" | "paused" | "completed" | "draft";
  date: string;
  icon: React.ReactNode;
  stats?: {
    sent?: number;
    delivered?: number;
  };
  onStatusChange?: (id: string, newStatus: string) => void;
}

const statusConfig = {
  active: { label: "Active", className: "bg-success/10 text-success border-success/20" },
  paused: { label: "Paused", className: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Completed", className: "bg-muted/10 text-muted-foreground border-muted/20" },
  draft: { label: "Draft", className: "bg-muted/10 text-muted-foreground border-muted/20" },
};

export const CampaignCard = ({ id = '0', name, status, date, icon, stats, onStatusChange }: CampaignCardProps) => {
  const config = statusConfig[status];
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Handle viewing campaign details
  const handleView = () => {
    navigate(`/campaigns/${id}`);
  };

  // Handle toggling campaign status (active/paused)
  const handleToggleStatus = async () => {
    if (status === "completed") return; // Can't toggle completed campaigns
    
    setIsLoading(true);
    try {
      const newStatus = status === "active" ? "paused" : "active";
      
      // Update campaign status via API
      await campaignsAPI.update(id, { status: newStatus });
      
      // Call the parent's onStatusChange handler if provided
      if (onStatusChange) {
        onStatusChange(id, newStatus);
      }
      
      toast({
        title: "Status updated",
        description: `Campaign is now ${newStatus}`,
      });
    } catch (error) {
      console.error("Error updating campaign status:", error);
      toast({
        title: "Error",
        description: "Failed to update campaign status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle duplicating a campaign
  const handleDuplicate = async () => {
    setIsLoading(true);
    try {
      // Create a duplicate campaign
      const result = await campaignsAPI.create({
        name: `${name} (Copy)`,
        status: "draft"
      });
      
      toast({
        title: "Campaign duplicated",
        description: "New draft campaign created",
      });
      
      // Navigate to the new campaign
      navigate(`/campaigns/${result.id}`);
    } catch (error) {
      console.error("Error duplicating campaign:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate campaign",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle viewing campaign analytics
  const handleViewAnalytics = () => {
    navigate(`/campaigns/${id}/analytics`);
  };

  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">{name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{date}</p>
            </div>
            <Badge variant="outline" className={cn("shrink-0", config.className)}>
              {config.label}
            </Badge>
          </div>
          {stats && (
            <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
              {stats.sent && <span>Sent: {stats.sent.toLocaleString()}</span>}
              {stats.delivered && <span>Delivered: {stats.delivered.toLocaleString()}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button 
          size="sm" 
          variant="secondary" 
          className="flex-1"
          onClick={handleView}
          disabled={isLoading}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={handleToggleStatus}
          disabled={isLoading || status === "completed"}
          title={status === "completed" ? "Completed campaigns cannot be modified" : 
                 status === "active" ? "Pause campaign" : "Activate campaign"}
        >
          {status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={handleDuplicate}
          disabled={isLoading}
          title="Duplicate campaign"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={handleViewAnalytics}
          disabled={isLoading || status === "draft"}
          title={status === "draft" ? "Analytics not available for drafts" : "View analytics"}
        >
          <BarChart3 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
