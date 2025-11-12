import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

import { StatCard } from "@/components/StatCard";
import { CampaignCard } from "@/components/CampaignCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import {
  adminAPI,
  AdminStatsResponse,
  WebhookLogEntry,
  campaignsAPI,
  mockDashboardStats,
} from "@/services/api";
import {
  Plus,
  Activity,
  Send,
  CheckCircle2,
  Megaphone,
  Sparkles,
  Calendar,
  Headphones,
  Loader2,
  Users,
  Coins,
  HeartPulse,
  Globe2,
} from "lucide-react";

const iconMap = {
  Megaphone: <Megaphone className="h-6 w-6" />,
  Sparkles: <Sparkles className="h-6 w-6" />,
  Calendar: <Calendar className="h-6 w-6" />,
  Headphones: <Headphones className="h-6 w-6" />,
} as const;

const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const checkIsAdmin = useAuthStore((state) => state.isAdmin);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState(mockDashboardStats);
  const [adminStats, setAdminStats] = useState<AdminStatsResponse | null>(null);
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [logFilters, setLogFilters] = useState({ source: "", eventType: "" });
  const [activeAdminTab, setActiveAdminTab] = useState("overview");

  const isAdminUser = checkIsAdmin();

  const fetchDashboardData = async () => {
    setLoading(true);

    try {
      if (isAdminUser) {
        const [statsResponse, logsResponse] = await Promise.all([
          adminAPI.getStats(),
          adminAPI.getWebhookLogs({ limit: 50 }),
        ]);

        setAdminStats(statsResponse);
        setLogs(logsResponse);
      } else {
        const [statsResponse, campaignsResponse] = await Promise.all([
          campaignsAPI.getDashboardStats(),
          campaignsAPI.getRecent(4),
        ]);

        setStats(statsResponse);
        setCampaigns(campaignsResponse);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminUser]);

  const handleLogFilterChange = async (updates: Partial<typeof logFilters>) => {
    const nextFilters = { ...logFilters, ...updates };
    setLogFilters(nextFilters);
    try {
      const logsResponse = await adminAPI.getWebhookLogs({
        source: nextFilters.source || undefined,
        eventType: nextFilters.eventType || undefined,
        limit: 50,
      });
      setLogs(logsResponse);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to filter logs",
        variant: "destructive",
      });
    }
  };

  const handleCreateCampaign = () => {
    navigate("/campaigns?create=true");
  };

  const firstName = user?.username?.split(" ")[0] || "there";

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-12">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdminUser && adminStats) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Control Center</h1>
            <p className="text-sm text-muted-foreground">
              Monitor users, campaigns, credit usage, and webhook activity.
            </p>
          </div>
        </div>

        <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="numbers">Number Health</TabsTrigger>
            <TabsTrigger value="logs">Webhook Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Total Users" value={adminStats.totalUsers} icon={<Users className="h-5 w-5" />} />
              <StatCard
                title="Credits Distributed"
                value={adminStats.totalCreditsAllocated.toLocaleString()}
                icon={<Coins className="h-5 w-5" />}
              />
              <StatCard
                title="Active Campaigns"
                value={adminStats.campaignStats.activeCampaigns}
                icon={<Activity className="h-5 w-5" />}
              />
              <StatCard
                title="Scheduled Campaigns"
                value={adminStats.campaignStats.scheduledCampaigns}
                icon={<Calendar className="h-5 w-5" />}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Total Campaigns</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {adminStats.campaignStats.totalCampaigns.toLocaleString()}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">Active</p>
                      <p className="mt-2 text-xl font-semibold">
                        {adminStats.campaignStats.activeCampaigns.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">Scheduled</p>
                      <p className="mt-2 text-xl font-semibold">
                        {adminStats.campaignStats.scheduledCampaigns.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Credits Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Credits Allocated</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {adminStats.totalCreditsAllocated.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Review user balances frequently to ensure campaigns continue without interruption.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="numbers" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Virtual Numbers"
                value={adminStats.numberHealth.totalVirtualNumbers}
                icon={<Globe2 className="h-5 w-5" />}
              />
              <StatCard
                title="Primary Status"
                value={adminStats.numberHealth.primaryNumber?.status ?? "Unknown"}
                icon={<HeartPulse className="h-5 w-5" />}
              />
              <StatCard
                title="Primary Quality"
                value={adminStats.numberHealth.primaryNumber?.qualityRating ?? "Unknown"}
                icon={<Activity className="h-5 w-5" />}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(adminStats.numberHealth.statusBreakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="capitalize">{status.replace("_", " ")}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quality Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(adminStats.numberHealth.qualityBreakdown).map(([quality, count]) => (
                    <div key={quality} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="capitalize">{quality}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Recent Webhook Logs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Source</label>
                    <Input
                      placeholder="meta_numbers"
                      value={logFilters.source}
                      onChange={(event) => handleLogFilterChange({ source: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Event Type</label>
                    <Input
                      placeholder="quality_update"
                      value={logFilters.eventType}
                      onChange={(event) => handleLogFilterChange({ eventType: event.target.value })}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" className="w-full" onClick={() => handleLogFilterChange({ source: "", eventType: "" })}>
                      Clear Filters
                    </Button>
                  </div>
                </div>

                {logs.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No webhook logs available.
                  </div>
                ) : (
                  <ScrollArea className="h-96 rounded-lg border">
                    <div className="divide-y">
                      {logs.map((log) => (
                        <div key={log.id} className="grid gap-2 p-4 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                            <span className="font-medium text-foreground">{log.source}</span>
                            <span>{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {log.eventType && (
                              <Badge variant="outline" className="capitalize">
                                {log.eventType}
                              </Badge>
                            )}
                            {log.status && (
                              <Badge variant="secondary" className="lowercase">
                                {log.status}
                              </Badge>
                            )}
                            {log.referenceId && (
                              <Badge variant="outline">Ref: {log.referenceId}</Badge>
                            )}
                          </div>
                          {log.metadata && (
                            <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-foreground">Welcome, {firstName}!</h1>
        <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90" onClick={handleCreateCampaign}>
          <Plus className="h-5 w-5 mr-2" />
          New Campaign
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Active Campaigns"
          value={stats.activeCampaigns}
          trend={stats.activeCampaignsTrend}
          icon={<Activity className="h-6 w-6" />}
        />
        <StatCard
          title="Sent Today"
          value={stats.sentToday}
          trend={stats.sentTodayTrend}
          icon={<Send className="h-6 w-6" />}
        />
        <StatCard
          title="Delivery Rate"
          value={stats.deliveryRate}
          trend={stats.deliveryRateTrend}
          icon={<CheckCircle2 className="h-6 w-6" />}
        />
      </div>

      <div className="rounded-xl bg-gradient-to-br from-primary via-primary to-purple-600 p-8 text-white shadow-lg">
        <h2 className="text-3xl font-semibold">Welcome back, {firstName}!</h2>
        <p className="mt-2 text-white/90">
          Plan and launch your next WhatsApp campaign in a few clicks.
        </p>
        <Button
          size="lg"
          className="mt-6 bg-white text-primary hover:bg-white/90 font-semibold"
          onClick={handleCreateCampaign}
        >
          Create New Campaign
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Recent Campaigns</h2>
          <Button variant="outline" onClick={() => navigate("/campaigns")}>
            View All
          </Button>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-card">
            <p className="text-muted-foreground mb-4">No campaigns yet</p>
            <Button onClick={handleCreateCampaign} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Campaign
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                name={campaign.name}
                status={campaign.status}
                date={campaign.date}
                icon={iconMap[campaign.icon as keyof typeof iconMap] || <Megaphone className="h-6 w-6" />}
                stats={campaign.stats}
              />
            ))}
          </div>
        )}
      </div>

      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl hover:shadow-2xl"
        onClick={handleCreateCampaign}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Dashboard;
