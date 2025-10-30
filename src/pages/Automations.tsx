import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Cake, PartyPopper, Clock, Play, Pause } from "lucide-react";

const automations = [
  {
    id: 1,
    name: "Birthday Messages",
    type: "Birthday",
    icon: <Cake className="h-6 w-6" />,
    schedule: "Daily at 9:00 AM",
    status: "active" as const,
    lastRun: "Today at 9:00 AM",
    nextRun: "Tomorrow at 9:00 AM",
    sent: 24,
  },
  {
    id: 2,
    name: "Festival Greetings",
    type: "Festival",
    icon: <PartyPopper className="h-6 w-6" />,
    schedule: "On festival dates",
    status: "active" as const,
    lastRun: "15 June 2024",
    nextRun: "4 July 2024",
    sent: 1250,
  },
  {
    id: 3,
    name: "Payment Reminders",
    type: "Reminder",
    icon: <Clock className="h-6 w-6" />,
    schedule: "Weekly on Monday",
    status: "paused" as const,
    lastRun: "12 June 2024",
    nextRun: "Paused",
    sent: 180,
  },
  {
    id: 4,
    name: "Follow-up Messages",
    type: "Reminder",
    icon: <Calendar className="h-6 w-6" />,
    schedule: "Daily at 2:00 PM",
    status: "active" as const,
    lastRun: "Today at 2:00 PM",
    nextRun: "Tomorrow at 2:00 PM",
    sent: 45,
  },
];

const Automations = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Automations</h1>
            <p className="mt-1 text-muted-foreground">Scheduled campaigns and automated messages</p>
          </div>
          <Button className="w-full sm:w-auto bg-primary hover:bg-primary/90">
            <Plus className="h-5 w-5 mr-2" />
            New Automation
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-success/10 p-3">
                <Play className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Automations</p>
                <h3 className="text-2xl font-bold text-foreground">3</h3>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled Today</p>
                <h3 className="text-2xl font-bold text-foreground">2</h3>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-warning/10 p-3">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                <h3 className="text-2xl font-bold text-foreground">1,499</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className="rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {automation.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-foreground">{automation.name}</h3>
                      <Badge
                        variant="outline"
                        className={
                          automation.status === "active"
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-warning/10 text-warning border-warning/20"
                        }
                      >
                        {automation.status === "active" ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{automation.schedule}</p>
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Last Run</p>
                        <p className="font-medium text-foreground">{automation.lastRun}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Next Run</p>
                        <p className="font-medium text-foreground">{automation.nextRun}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Messages Sent</p>
                        <p className="font-medium text-foreground">{automation.sent}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    {automation.status === "active" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl hover:shadow-2xl"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Automations;
