import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, Loader2, MessageSquare, TrendingUp, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportsAPI, CampaignReportResponse, CampaignReportsOverview } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { exportCampaignReportToCSV, exportOverviewToCSV } from "@/lib/exporters";

const Reports = () => {
  const { toast } = useToast();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  const overviewQuery = useQuery<CampaignReportsOverview, Error>({
    queryKey: ["reports", "overview"],
    queryFn: reportsAPI.getOverview,
  });

  const selectedCampaignQuery = useQuery<CampaignReportResponse, Error>({
    queryKey: ["reports", "campaign", selectedCampaignId],
    queryFn: () => reportsAPI.getCampaignReport(selectedCampaignId as number),
    enabled: selectedCampaignId !== null,
  });

  useEffect(() => {
    if (overviewQuery.isError) {
      toast({
        title: "Failed to load reports",
        description: overviewQuery.error.message,
        variant: "destructive",
      });
    }
  }, [overviewQuery.isError, overviewQuery.error, toast]);

  useEffect(() => {
    if (selectedCampaignQuery.isError) {
      toast({
        title: "Unable to load campaign report",
        description: selectedCampaignQuery.error.message,
        variant: "destructive",
      });
    }
  }, [selectedCampaignQuery.isError, selectedCampaignQuery.error, toast]);

  const cardsData = useMemo(() => {
    const format = (value: number) => value ?? 0;

    if (selectedCampaignId !== null && selectedCampaignQuery.data) {
      const report = selectedCampaignQuery.data;
      return [
        {
          label: "Total Sent",
          value: format(report.total),
          icon: MessageSquare,
          tone: "primary" as const,
        },
        {
          label: "Delivered",
          value: format(report.delivered),
          icon: CheckCircle2,
          tone: "success" as const,
        },
        {
          label: "Failed",
          value: format(report.failed),
          icon: XCircle,
          tone: "destructive" as const,
        },
        {
          label: "Success Rate",
          value: `${report.deliveryRate.toFixed(2)}%`,
          icon: TrendingUp,
          tone: "success" as const,
        },
      ];
    }

    const totals = overviewQuery.data?.totals;
    return [
      {
        label: "Total Sent",
        value: format(totals?.total ?? 0),
        icon: MessageSquare,
        tone: "primary" as const,
      },
      {
        label: "Delivered",
        value: format(totals?.delivered ?? 0),
        icon: CheckCircle2,
        tone: "success" as const,
      },
      {
        label: "Failed",
        value: format(totals?.failed ?? 0),
        icon: XCircle,
        tone: "destructive" as const,
      },
      {
        label: "Success Rate",
        value: totals ? `${totals.deliveryRate.toFixed(2)}%` : "0%",
        icon: TrendingUp,
        tone: "success" as const,
      },
    ];
  }, [selectedCampaignId, selectedCampaignQuery.data, overviewQuery.data]);

  const cardsLoading = overviewQuery.isLoading || (selectedCampaignId !== null && selectedCampaignQuery.isLoading);
  const campaigns = overviewQuery.data?.campaigns ?? [];

  const handleCampaignToggle = (campaignId: number) => {
    setSelectedCampaignId((current) => (current === campaignId ? null : campaignId));
  };

  const handleExport = () => {
    if (selectedCampaignId !== null) {
      if (selectedCampaignQuery.isFetching || !selectedCampaignQuery.data) {
        toast({
          title: "Hold on",
          description: "Still fetching the latest campaign report.",
        });
        return;
      }

      exportCampaignReportToCSV(selectedCampaignQuery.data, `campaign-${selectedCampaignId}-report.csv`);
      return;
    }

    if (overviewQuery.data) {
      exportOverviewToCSV(overviewQuery.data, "campaign-overview.csv");
    }
  };

  const exportDisabled = !overviewQuery.data || (selectedCampaignId !== null && selectedCampaignQuery.isFetching);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="mt-1 text-muted-foreground">Campaign performance and analytics</p>
        </div>
        <Button onClick={handleExport} className="w-full sm:w-auto" disabled={exportDisabled}>
          {selectedCampaignId !== null && selectedCampaignQuery.isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export Report
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cardsData.map((item) => {
          const Icon = item.icon;
          const toneClasses =
            item.tone === "success"
              ? "bg-success/10 text-success"
              : item.tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary";

          return (
            <Card key={item.label} className="p-6 border-border">
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-3 ${toneClasses}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <h3 className="text-2xl font-bold text-foreground">
                    {cardsLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : typeof item.value === "number" ? (
                      item.value.toLocaleString()
                    ) : (
                      item.value
                    )}
                  </h3>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">Campaign Performance</h2>
            <p className="text-sm text-muted-foreground">
              {selectedCampaignId !== null
                ? "Showing live metrics for the selected campaign"
                : "Select a campaign to focus its metrics"}
            </p>
          </div>
        </div>

        {overviewQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-muted-foreground">
            No campaign reports available yet.
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const isSelected = campaign.campaignId === selectedCampaignId;
              const successRate = campaign.deliveryRate;
              const sent = campaign.total;
              const delivered = campaign.delivered;
              const failed = campaign.failed;
              const progress = sent > 0 ? (delivered / sent) * 100 : 0;

              return (
                <div
                  key={campaign.campaignId}
                  className={`rounded-lg border border-border bg-background/80 p-4 transition-colors ${
                    isSelected ? "border-primary bg-primary/10" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{campaign.campaignName}</h3>
                      <p className="text-xs text-muted-foreground">ID: {campaign.campaignId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-success">{successRate.toFixed(2)}%</span>
                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => handleCampaignToggle(campaign.campaignId)}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Sent</p>
                      <p className="font-medium text-foreground">{sent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Delivered</p>
                      <p className="font-medium text-success">{delivered.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Failed</p>
                      <p className="font-medium text-destructive">{failed.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Reports;
