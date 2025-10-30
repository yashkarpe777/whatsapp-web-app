import { Eye, Pause, Play, Copy, BarChart3 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface CampaignCardProps {
  name: string;
  status: "active" | "paused" | "completed" | "draft";
  date: string;
  icon: React.ReactNode;
  stats?: {
    sent?: number;
    delivered?: number;
  };
}

const statusConfig = {
  active: { label: "Active", className: "bg-success/10 text-success border-success/20" },
  paused: { label: "Paused", className: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Completed", className: "bg-muted/10 text-muted-foreground border-muted/20" },
  draft: { label: "Draft", className: "bg-muted/10 text-muted-foreground border-muted/20" },
};

export const CampaignCard = ({ name, status, date, icon, stats }: CampaignCardProps) => {
  const config = statusConfig[status];

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
        <Button size="sm" variant="secondary" className="flex-1">
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
        <Button size="sm" variant="ghost">
          {status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="ghost">
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost">
          <BarChart3 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
