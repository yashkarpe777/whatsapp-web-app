import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, TrendingUp, MessageSquare, CheckCircle2, XCircle } from "lucide-react";

const Reports = () => {
  const campaignData = [
    { name: "Summer Sale", sent: 10500, delivered: 10342, failed: 158, rate: "98.5%" },
    { name: "New Feature", sent: 8200, delivered: 8100, failed: 100, rate: "98.8%" },
    { name: "Holiday Greetings", sent: 15000, delivered: 14850, failed: 150, rate: "99.0%" },
    { name: "Support Follow-up", sent: 3200, delivered: 3180, failed: 20, rate: "99.4%" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports</h1>
            <p className="mt-1 text-muted-foreground">Campaign performance and analytics</p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6 border-border">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                <h3 className="text-2xl font-bold text-foreground">36,900</h3>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-border">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-success/10 p-3">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivered</p>
                <h3 className="text-2xl font-bold text-foreground">36,472</h3>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-border">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-destructive/10 p-3">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                <h3 className="text-2xl font-bold text-foreground">428</h3>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-border">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-success/10 p-3">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <h3 className="text-2xl font-bold text-foreground">98.8%</h3>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 border-border">
          <h2 className="text-xl font-bold text-foreground mb-6">Campaign Performance</h2>
          <div className="space-y-4">
            {campaignData.map((campaign, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                  <span className="text-sm font-medium text-success">{campaign.rate}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sent</p>
                    <p className="font-medium text-foreground">{campaign.sent.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Delivered</p>
                    <p className="font-medium text-success">{campaign.delivered.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Failed</p>
                    <p className="font-medium text-destructive">{campaign.failed}</p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-success"
                    style={{
                      width: `${(campaign.delivered / campaign.sent) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
    </div>
  );
};

export default Reports;
