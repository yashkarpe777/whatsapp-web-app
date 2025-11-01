import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom"; // Add this import
import { Pause, Play, Slash, AlertCircle } from "lucide-react";

interface Campaign {
  id: number;
  name: string;
  progress: number;
  sent: number;
  failed: number;
  retries: number;
  startedAt: string;
  status: 'running' | 'paused' | 'retrying';
  template: string;
  totalContacts: number;
}

const mockRunning: Campaign[] = [
  {
    id: 1,
    name: "Summer Sale Promotion",
    progress: 62,
    sent: 6500,
    failed: 32,
    retries: 2,
    startedAt: "2025-06-15 09:00",
    status: 'running',
    template: "summer_sale_2025",
    totalContacts: 10000
  },
  {
    id: 2,
    name: "Order Reminders",
    progress: 28,
    sent: 2800,
    failed: 10,
    retries: 0,
    startedAt: "2025-06-16 11:30",
    status: 'running',
    template: "order_reminder",
    totalContacts: 5000
  },
];

const ActiveCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>(mockRunning);
  useEffect(() => {
    const interval = setInterval(() => {
      setCampaigns((current) =>
        current.map((campaign) => {
          if (campaign.status === 'paused') return campaign;

          const newProgress = Math.min(100, campaign.progress + Math.random() * 5);
          const newSent = campaign.sent + Math.floor(Math.random() * 50);

          // Simulate random failures and auto-retry
          const shouldFail = Math.random() > 0.95;
          if (shouldFail) {
            return {
              ...campaign,
              status: 'retrying',
              failed: campaign.failed + Math.floor(Math.random() * 10),
              retries: campaign.retries + 1
            };
          }

          // Auto-recover from retry state
          const shouldRecover = campaign.status === 'retrying' && Math.random() > 0.5;
          if (shouldRecover) {
            return { ...campaign, status: 'running' };
          }

          return { ...campaign, progress: newProgress, sent: newSent };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handlePause = (id: number) => {
    setCampaigns((current) =>
      current.map((c) =>
        c.id === id ? { ...c, status: 'paused' } : c
      )
    );
  };

  const handleResume = (id: number) => {
    setCampaigns((current) =>
      current.map((c) =>
        c.id === id ? { ...c, status: 'running' } : c
      )
    );
  };

  const handleStop = (id: number) => {
    if (window.confirm('Are you sure you want to stop this campaign? This action cannot be undone.')) {
      setCampaigns((current) => current.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Active Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Monitoring {campaigns.length} running campaign(s)
          </p>
        </div>
        <Link to="/campaigns">
          <Button variant="outline">View All Campaigns</Button>
        </Link>
      </div>

      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="rounded-lg border bg-card p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">{campaign.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Template: {campaign.template}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {campaign.status === 'retrying' && (
                  <div className="flex items-center text-yellow-500">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span className="text-sm">Retrying...</span>
                  </div>
                )}
                <div className={`px-2 py-1 rounded-full text-xs ${campaign.status === 'running' ? 'bg-green-500/10 text-green-500' :
                    campaign.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-blue-500/10 text-blue-500'
                  }`}>
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground mb-1">
                <span>Progress ({campaign.progress.toFixed(1)}%)</span>
                <span>{campaign.sent} / {campaign.totalContacts} messages sent</span>
              </div>
              <Progress value={campaign.progress} className="h-2" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-1">
                <div className="text-sm">
                  Started: {campaign.startedAt}
                </div>
                <div className="text-sm text-destructive">
                  Failed: {campaign.failed} ({campaign.retries} retries)
                </div>
              </div>

              <div className="flex gap-2">
                {campaign.status === 'running' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePause(campaign.id)}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleResume(campaign.id)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStop(campaign.id)}
                >
                  <Slash className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No active campaigns running.
            <Link to="/campaigns" className="text-primary ml-1">
              Create a new campaign
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
export default ActiveCampaigns;