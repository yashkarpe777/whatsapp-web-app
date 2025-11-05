import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom"; 
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
  numberId?: string;
  // Media information
  media_type?: string;
  media_name?: string;
  caption?: string;
  // Track last update time for performance optimization
  lastUpdated?: number;
}

const ActiveCampaigns = () => {
  const storeKey = "running_campaigns";
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    // Performance optimization for large campaigns:
    // 1. Update campaigns in batches (max 5 at once)
    // 2. Use time-based throttling for large contact lists
    // 3. Reduce update frequency for campaigns with many contacts
    const interval = setInterval(() => {
      setCampaigns((current) => {
        const now = Date.now();
        const updatedCampaigns = [...current];
        let updatesInBatch = 0;
        const maxUpdatesPerBatch = 5; // Limit updates per cycle
        
        // Process campaigns in order, but limit updates per batch
        for (let i = 0; i < updatedCampaigns.length; i++) {
          const campaign = updatedCampaigns[i];
          
          // Skip paused campaigns
          if (campaign.status === 'paused') continue;
          
          // For large campaigns, throttle updates based on size
          const minUpdateInterval = campaign.totalContacts > 100000 ? 5000 : // 5s for very large
                                   campaign.totalContacts > 10000 ? 3000 : // 3s for large
                                   2000; // 2s for normal
          
          // Skip if updated too recently
          if (campaign.lastUpdated && now - campaign.lastUpdated < minUpdateInterval) continue;
          
          // Limit number of campaigns updated per batch
          if (updatesInBatch >= maxUpdatesPerBatch) break;
          updatesInBatch++;
          
          // Calculate progress increment - smaller for larger campaigns
          const baseIncrement = campaign.totalContacts > 100000 ? 0.5 : // 0.5% for very large
                              campaign.totalContacts > 10000 ? 1 : // 1% for large
                              Math.random() * 6; // 0-6% for normal
          
          const newProgress = Math.min(100, campaign.progress + baseIncrement);
          
          // Calculate sent messages - proportional to progress
          const progressDelta = newProgress - campaign.progress;
          const newSentCount = Math.floor(progressDelta / 100 * campaign.totalContacts);
          const newSent = campaign.sent + newSentCount;
          
          // Handle failures - less frequent for large campaigns
          const failureThreshold = campaign.totalContacts > 100000 ? 0.99 : 0.96;
          const shouldFail = Math.random() > failureThreshold;
          
          if (shouldFail) {
            updatedCampaigns[i] = {
              ...campaign,
              status: 'retrying' as const,
              failed: campaign.failed + Math.floor(Math.random() * 5 + 1),
              retries: campaign.retries + 1,
              lastUpdated: now
            };
            continue;
          }
          
          // Auto-recover from retry state
          const shouldRecover = campaign.status === 'retrying' && Math.random() > 0.5;
          if (shouldRecover) {
            updatedCampaigns[i] = { 
              ...campaign, 
              status: 'running' as const,
              lastUpdated: now 
            };
            continue;
          }
          
          // Normal progress update
          updatedCampaigns[i] = { 
            ...campaign, 
            progress: newProgress, 
            sent: newSent,
            lastUpdated: now 
          };
        }
        
        // Remove completed campaigns
        return updatedCampaigns.filter(c => c.progress < 100);
      });
    }, 1000); // Check more frequently but with internal throttling

    return () => clearInterval(interval);
  }, []);

  const handlePause = (id: number) => {
    setCampaigns((current) =>
      current.map((c) =>
        c.id === id ? { ...c, status: 'paused' as const } : c
      )
    );
  };

  const handleResume = (id: number) => {
    setCampaigns((current) =>
      current.map((c) =>
        c.id === id ? { ...c, status: 'running' as const } : c
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold break-words">{campaign.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {campaign.template === 'custom' ? (
                    <>
                      {campaign.media_type && (
                        <span className="inline-flex items-center mr-2">
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium me-2 px-2 py-0.5 rounded">
                            {campaign.media_type}
                          </span>
                          {campaign.media_name && campaign.media_name.length > 20 
                            ? campaign.media_name.substring(0, 20) + '...' 
                            : campaign.media_name}
                        </span>
                      )}
                      {campaign.caption && campaign.caption.length > 0 && (
                        <span className="inline-flex items-center">
                          <span className="bg-green-100 text-green-800 text-xs font-medium me-2 px-2 py-0.5 rounded">
                            Caption
                          </span>
                        </span>
                      )}
                    </>
                  ) : (
                    <>Template: {campaign.template}</>
                  )}
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground mb-1 gap-1">
                <span>Progress ({campaign.progress.toFixed(1)}%)</span>
                <span>{campaign.sent.toLocaleString()} / {campaign.totalContacts.toLocaleString()} messages sent</span>
              </div>
              <Progress value={campaign.progress} className="h-2" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-1 text-sm">
                <div>
                  Started: {campaign.startedAt}
                </div>
                <div className="text-destructive">
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