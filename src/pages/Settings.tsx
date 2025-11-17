import { useEffect, useMemo, useState, ChangeEvent, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  numbersAPI,
  VirtualNumber,
  VirtualNumberQuality,
  VirtualNumberStatus,
  CreateVirtualNumberPayload,
  templatesAPI,
  MessageTemplate,
  TemplatePayloadValidationInput,
  TemplatePayloadValidationResult,
  TemplateSyncSummary,
  TemplateApprovalStatus,
  ProviderValidationStatus,
} from "@/services/api";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  RefreshCcw,
} from "lucide-react";

const STATUS_STYLES: Record<VirtualNumberStatus, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  restricted: "bg-yellow-100 text-yellow-800 border-yellow-200",
  throttled: "bg-amber-100 text-amber-800 border-amber-200",
  banned: "bg-red-100 text-red-800 border-red-200",
  disconnected: "bg-slate-200 text-slate-900 border-slate-300",
};

const QUALITY_STYLES: Record<VirtualNumberQuality, string> = {
  high: "bg-emerald-100 text-emerald-800 border-emerald-200",
  medium: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-orange-100 text-orange-800 border-orange-200",
  unknown: "bg-slate-100 text-slate-700 border-slate-200",
};

const TEMPLATE_APPROVAL_STYLES: Record<TemplateApprovalStatus, string> = {
  approved: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

const PROVIDER_STATUS_STYLES: Record<ProviderValidationStatus, string> = {
  approved: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  not_required: "bg-slate-100 text-slate-700 border-slate-200",
};

type BusinessFormState = {
  businessName: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  accessToken: string;
  autoSwitchEnabled: boolean;
};

const DEFAULT_BUSINESS_FORM: BusinessFormState = {
  businessName: "",
  wabaId: "",
  phoneNumberId: "",
  displayPhoneNumber: "",
  accessToken: "",
  autoSwitchEnabled: true,
};

const DEFAULT_NEW_NUMBER: CreateVirtualNumberPayload = {
  wabaId: "",
  phoneNumberId: "",
  accessToken: "",
  status: "active",
  qualityRating: "unknown",
  isPrimary: false,
};

const Settings = () => {
  const { toast } = useToast();

  const [businessForm, setBusinessForm] = useState<BusinessFormState>(DEFAULT_BUSINESS_FORM);
  const [businessLoading, setBusinessLoading] = useState(true);
  const [businessSaving, setBusinessSaving] = useState(false);

  const [virtualNumbers, setVirtualNumbers] = useState<VirtualNumber[]>([]);
  const [numbersLoading, setNumbersLoading] = useState(true);
  const [numbersRefreshing, setNumbersRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [updatingPrimaryId, setUpdatingPrimaryId] = useState<number | null>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newNumberForm, setNewNumberForm] = useState<CreateVirtualNumberPayload>(DEFAULT_NEW_NUMBER);
  const [creatingNumber, setCreatingNumber] = useState(false);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesRefreshing, setTemplatesRefreshing] = useState(false);
  const [templatesSyncing, setTemplatesSyncing] = useState(false);
  const [templateValidations, setTemplateValidations] = useState<Record<number, TemplatePayloadValidationResult>>({});
  const [validatingTemplateId, setValidatingTemplateId] = useState<number | null>(null);
  const [templateSyncSummaries, setTemplateSyncSummaries] = useState<TemplateSyncSummary[] | null>(null);

  const [activeTab, setActiveTab] = useState<"business" | "virtual" | "templates">("business");

  const primaryNumber = useMemo(() => virtualNumbers.find((item) => item.isPrimary), [virtualNumbers]);

  useEffect(() => {
    void loadBusiness();
    void loadNumbers();
    void loadTemplates();
  }, []);

  const loadBusiness = async () => {
    setBusinessLoading(true);
    try {
      const data = await numbersAPI.getBusinessNumber();
      if (data) {
        setBusinessForm({
          businessName: data.businessName || "",
          wabaId: data.wabaId,
          phoneNumberId: data.phoneNumberId,
          displayPhoneNumber: data.displayPhoneNumber || "",
          accessToken: data.accessToken,
          autoSwitchEnabled: data.autoSwitchEnabled,
        });
      } else {
        setBusinessForm(DEFAULT_BUSINESS_FORM);
      }
    } catch (error: any) {
      toast({
        title: "Failed to load business number",
        description: error.message || "Unable to fetch business number",
        variant: "destructive",
      });
    } finally {
      setBusinessLoading(false);
    }
  };

  const loadNumbers = async (showSpinner = true) => {
    if (showSpinner) {
      setNumbersLoading(true);
    } else {
      setNumbersRefreshing(true);
    }

    try {
      const data = await numbersAPI.getVirtualNumbers();
      setVirtualNumbers(data);
    } catch (error: any) {
      toast({
        title: "Failed to load virtual numbers",
        description: error.message || "Unable to fetch virtual numbers",
        variant: "destructive",
      });
    } finally {
      setNumbersLoading(false);
      setNumbersRefreshing(false);
    }
  };

  const loadTemplates = async (showSpinner = true) => {
    if (showSpinner) {
      setTemplatesLoading(true);
    } else {
      setTemplatesRefreshing(true);
    }

    try {
      const data = await templatesAPI.listAll();
      setTemplates(data);
    } catch (error: any) {
      toast({
        title: "Failed to load templates",
        description: error?.message || "Unable to fetch templates",
        variant: "destructive",
      });
    } finally {
      setTemplatesLoading(false);
      setTemplatesRefreshing(false);
    }
  };

  const handleBusinessChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setBusinessForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveBusiness = async () => {
    if (!businessForm.wabaId || !businessForm.phoneNumberId || !businessForm.accessToken) {
      toast({
        title: "Missing information",
        description: "WABA ID, Phone Number ID and Access Token are required",
        variant: "destructive",
      });
      return;
    }

    setBusinessSaving(true);
    try {
      const updated = await numbersAPI.updateBusinessNumber({
        businessName: businessForm.businessName || undefined,
        wabaId: businessForm.wabaId,
        phoneNumberId: businessForm.phoneNumberId,
        displayPhoneNumber: businessForm.displayPhoneNumber || undefined,
        accessToken: businessForm.accessToken,
        autoSwitchEnabled: businessForm.autoSwitchEnabled,
      });

      setBusinessForm({
        businessName: updated.businessName || "",
        wabaId: updated.wabaId,
        phoneNumberId: updated.phoneNumberId,
        displayPhoneNumber: updated.displayPhoneNumber || "",
        accessToken: updated.accessToken,
        autoSwitchEnabled: updated.autoSwitchEnabled,
      });

      toast({ title: "Business number saved", description: "Configuration updated successfully." });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Unable to update business number",
        variant: "destructive",
      });
    } finally {
      setBusinessSaving(false);
    }
  };

  const handleManualSwitch = async () => {
    setSwitching(true);
    try {
      const switched = await numbersAPI.manualSwitch();
      toast({ title: "Primary switched", description: `Now using ${switched.phoneNumberId}` });
      await loadNumbers();
    } catch (error: any) {
      toast({
        title: "Switch failed",
        description: error.message || "Unable to switch virtual number",
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
    }
  };

  const handleSetPrimary = async (id: number) => {
    setUpdatingPrimaryId(id);
    try {
      await numbersAPI.updateVirtualNumber(id, { isPrimary: true });
      toast({ title: "Primary updated" });
      await loadNumbers();
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Unable to set primary number",
        variant: "destructive",
      });
    } finally {
      setUpdatingPrimaryId(null);
    }
  };

  const handleAddNumberChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setNewNumberForm((prev) => ({ ...prev, [name]: value as any }));
  };

  const handleCreateNumber = async () => {
    if (!newNumberForm.wabaId || !newNumberForm.phoneNumberId || !newNumberForm.accessToken) {
      toast({
        title: "Missing information",
        description: "WABA ID, Phone Number ID and Access Token are required",
        variant: "destructive",
      });
      return;
    }

    setCreatingNumber(true);
    try {
      await numbersAPI.createVirtualNumber(newNumberForm);
      toast({ title: "Number added", description: `${newNumberForm.phoneNumberId} is now available.` });
      setShowAddDialog(false);
      setNewNumberForm(DEFAULT_NEW_NUMBER);
      await loadNumbers();
    } catch (error: any) {
      toast({
        title: "Create failed",
        description: error.message || "Unable to create virtual number",
        variant: "destructive",
      });
    } finally {
      setCreatingNumber(false);
    }
  };

  const handleSyncTemplates = async () => {
    setTemplatesSyncing(true);
    try {
      const summaries = await templatesAPI.sync();
      setTemplateSyncSummaries(summaries);

      const created = summaries.reduce((acc, item) => acc + item.created, 0);
      const updated = summaries.reduce((acc, item) => acc + item.updated, 0);

      toast({
        title: "Template sync completed",
        description: `Created ${created} • Updated ${updated} template(s).`,
      });

      await loadTemplates(false);
    } catch (error: any) {
      toast({
        title: "Template sync failed",
        description: error?.message || "Unable to sync templates",
        variant: "destructive",
      });
    } finally {
      setTemplatesSyncing(false);
    }
  };

  const handleValidateTemplate = async (template: MessageTemplate) => {
    setValidatingTemplateId(template.id);
    try {
      const sampleVariables = template.sampleParameters?.length
        ? template.sampleParameters.reduce((acc, param) => {
          if (param.name) {
            acc[param.name] = param.value ?? "";
          }
          return acc;
        }, {} as Record<string, string | number | boolean | null>)
        : undefined;

      const payload: TemplatePayloadValidationInput = {
        variables: sampleVariables,
        media: template.attachmentUrl
          ? {
            attachmentUrl: template.attachmentUrl,
          }
          : undefined,
      };

      const result = await templatesAPI.validate(template.id, payload);
      setTemplateValidations((prev) => ({ ...prev, [template.id]: result }));

      toast({
        title: result.isValid ? "Template is ready" : "Template validation issues",
        description: result.isValid
          ? `${template.name} passed validation checks.`
          : `${result.errors.length} error(s) detected.`,
        variant: result.isValid ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Validation failed",
        description: error?.message || `Unable to validate ${template.name}`,
        variant: "destructive",
      });
    } finally {
      setValidatingTemplateId(null);
    }
  };

  const lastUsedLabel = primaryNumber?.lastUsedAt
    ? new Date(primaryNumber.lastUsedAt).toLocaleString()
    : "No recent usage";

  return (
    <div className="min-h-screen bg-background p-6">
      <main className="space-y-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your WhatsApp business number and virtual number pool.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setActiveTab("business")}
                variant={activeTab === "business" ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Business
              </Button>
              <Button
                onClick={() => setActiveTab("virtual")}
                variant={activeTab === "virtual" ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                Virtual Numbers
              </Button>
              <Button
                onClick={() => setActiveTab("templates")}
                variant={activeTab === "templates" ? "default" : "outline"}
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Templates
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                void loadBusiness();
                void loadNumbers();
                void loadTemplates();
              }}
              disabled={businessLoading || numbersLoading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {activeTab === "business" && (
          <div className="space-y-6">
            <Card className="min-h-[420px]">
              <CardHeader>
                <CardTitle>Business Number</CardTitle>
                <CardDescription>
                  Configure the primary number used for outbound messaging.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {businessLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading business number...
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="businessName">Business Name</Label>
                        <Input
                          id="businessName"
                          name="businessName"
                          placeholder="Campaigner Inc."
                          value={businessForm.businessName}
                          onChange={handleBusinessChange}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="wabaId">WABA ID</Label>
                        <Input
                          id="wabaId"
                          name="wabaId"
                          placeholder="Enter WhatsApp Business Account ID"
                          value={businessForm.wabaId}
                          onChange={handleBusinessChange}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                        <Input
                          id="phoneNumberId"
                          name="phoneNumberId"
                          placeholder="Enter Phone Number ID"
                          value={businessForm.phoneNumberId}
                          onChange={handleBusinessChange}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="displayPhoneNumber">Display Phone Number (optional)</Label>
                        <Input
                          id="displayPhoneNumber"
                          name="displayPhoneNumber"
                          placeholder="+1 555 0100"
                          value={businessForm.displayPhoneNumber}
                          onChange={handleBusinessChange}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="accessToken">Access Token</Label>
                        <Input
                          id="accessToken"
                          name="accessToken"
                          type="password"
                          placeholder="Enter permanent access token"
                          value={businessForm.accessToken}
                          onChange={handleBusinessChange}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-4">
                      <div>
                        <p className="font-medium">Auto-switch virtual numbers</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically promote a healthy number if the primary is degraded.
                        </p>
                      </div>
                      <Switch
                        checked={businessForm.autoSwitchEnabled}
                        onCheckedChange={(checked) =>
                          setBusinessForm((prev) => ({ ...prev, autoSwitchEnabled: checked }))
                        }
                      />
                    </div>

                    <Button className="w-full sm:w-auto" onClick={handleSaveBusiness} disabled={businessSaving}>
                      {businessSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Business Number
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "virtual" && (
          <div className="space-y-6">
            <Card className="min-h-[420px]">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Virtual Numbers</CardTitle>
                    <CardDescription>
                      Manage active numbers, monitor health, and trigger manual failover.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={handleManualSwitch} disabled={switching}>
                      {switching ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="mr-2 h-4 w-4" />
                      )}
                      Manual Switch
                    </Button>
                    <Dialog
                      open={showAddDialog}
                      onOpenChange={(open) => {
                        setShowAddDialog(open);
                        if (!open) setNewNumberForm(DEFAULT_NEW_NUMBER);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" /> Add Number
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] w-full max-w-[92vw] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Add Virtual Number</DialogTitle>
                          <DialogDescription>
                            Connect an additional number to the virtual pool.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="new-waba">WABA ID</Label>
                            <Input
                              id="new-waba"
                              name="wabaId"
                              value={newNumberForm.wabaId}
                              onChange={handleAddNumberChange}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-phone">Phone Number ID</Label>
                            <Input
                              id="new-phone"
                              name="phoneNumberId"
                              value={newNumberForm.phoneNumberId}
                              onChange={handleAddNumberChange}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-token">Access Token</Label>
                            <Input
                              id="new-token"
                              name="accessToken"
                              type="password"
                              value={newNumberForm.accessToken}
                              onChange={handleAddNumberChange}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-status">Status</Label>
                            <select
                              id="new-status"
                              name="status"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={newNumberForm.status}
                              onChange={handleAddNumberChange}
                            >
                              <option value="active">Active</option>
                              <option value="restricted">Restricted</option>
                              <option value="throttled">Throttled</option>
                              <option value="banned">Banned</option>
                              <option value="disconnected">Disconnected</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="new-quality">Quality Rating</Label>
                            <select
                              id="new-quality"
                              name="qualityRating"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={newNumberForm.qualityRating}
                              onChange={handleAddNumberChange}
                            >
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                              <option value="unknown">Unknown</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                              <p className="text-sm font-medium">Set as primary</p>
                              <p className="text-xs text-muted-foreground">
                                Current primary will be replaced immediately.
                              </p>
                            </div>
                            <Switch
                              checked={Boolean(newNumberForm.isPrimary)}
                              onCheckedChange={(checked) =>
                                setNewNumberForm((prev) => ({ ...prev, isPrimary: checked }))
                              }
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={creatingNumber}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreateNumber} disabled={creatingNumber}>
                            {creatingNumber && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Number
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                {primaryNumber && (
                  <p className="text-sm text-muted-foreground">
                    Current primary: <span className="font-medium">{primaryNumber.phoneNumberId}</span> (last used {lastUsedLabel})
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-muted-foreground">
                        <th className="h-10 px-4 text-left font-medium">Number</th>
                        <th className="h-10 px-4 text-left font-medium">Status</th>
                        <th className="h-10 px-4 text-left font-medium">Quality</th>
                        <th className="h-10 px-4 text-left font-medium">24h Messages</th>
                        <th className="h-10 px-4 text-left font-medium">Last Used</th>
                        <th className="h-10 px-4 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {numbersLoading ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> Loading virtual numbers...
                          </td>
                        </tr>
                      ) : virtualNumbers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            No virtual numbers found. Add a number to get started.
                          </td>
                        </tr>
                      ) : (
                        virtualNumbers.map((number) => (
                          <tr key={number.id} className="border-b">
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-medium">{number.phoneNumberId}</span>
                                <span className="text-xs text-muted-foreground">WABA: {number.wabaId}</span>
                                {number.isPrimary && (
                                  <Badge variant="outline" className="mt-1">Primary</Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className={STATUS_STYLES[number.status]}>
                                {number.status}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className={QUALITY_STYLES[number.qualityRating]}>
                                {number.qualityRating}
                              </Badge>
                            </td>
                            <td className="p-4">{number.messageCount24h}</td>
                            <td className="p-4">
                              {number.lastUsedAt ? new Date(number.lastUsedAt).toLocaleString() : "—"}
                            </td>
                            <td className="p-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetPrimary(number.id)}
                                disabled={number.isPrimary || updatingPrimaryId === number.id}
                              >
                                {updatingPrimaryId === number.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : number.isPrimary ? (
                                  "Primary"
                                ) : (
                                  "Set Primary"
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="space-y-6">
            <Card className="min-h-[420px]">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>Message Templates</CardTitle>
                    <CardDescription>
                      View approval status, sync with providers, and validate before running campaigns.
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSyncTemplates} disabled={templatesSyncing}>
                      {templatesSyncing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="mr-2 h-4 w-4" />
                      )}
                      Sync Providers
                    </Button>
                  </div>
                </div>
                {templateSyncSummaries && templateSyncSummaries.length > 0 && (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Last sync results</p>
                    <div className="mt-2 space-y-1">
                      {templateSyncSummaries.map((summary) => (
                        <div key={summary.provider} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="capitalize font-medium text-foreground">{summary.provider}</span>
                          <span>
                            {summary.created} created • {summary.updated} updated • {summary.skipped} skipped
                          </span>
                          {summary.errors.length ? (
                            <span className="text-destructive">{summary.errors.length} error(s)</span>
                          ) : (
                            <span className="text-emerald-600">OK</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-muted-foreground">
                        <th className="h-10 px-4 text-left font-medium">Template</th>
                        <th className="h-10 px-4 text-left font-medium">Approval</th>
                        <th className="h-10 px-4 text-left font-medium">Providers</th>
                        <th className="h-10 px-4 text-left font-medium">Updated</th>
                        <th className="h-10 px-4 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templatesLoading ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">
                            <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> Loading templates...
                          </td>
                        </tr>
                      ) : templates.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">
                            No templates found. Sync providers to import the latest templates.
                          </td>
                        </tr>
                      ) : (
                        templates.map((template) => {
                          const validation = templateValidations[template.id];
                          return (
                            <Fragment key={template.id}>
                              <tr className="border-b">
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{template.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {template.category ? `${template.category} • ` : ""}
                                      {template.language}
                                    </span>
                                    {template.rejectionReason && (
                                      <span className="mt-1 text-xs text-destructive">{template.rejectionReason}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <Badge variant="outline" className={TEMPLATE_APPROVAL_STYLES[template.approvalStatus]}>
                                    {template.approvalStatus}
                                  </Badge>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-wrap gap-2">
                                    <Badge
                                      variant="outline"
                                      className={PROVIDER_STATUS_STYLES[template.metaStatus]}
                                    >
                                      Meta: {template.metaStatus}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={PROVIDER_STATUS_STYLES[template.dltStatus]}
                                    >
                                      DLT: {template.dltStatus}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={PROVIDER_STATUS_STYLES[template.bspStatus]}
                                    >
                                      BSP: {template.bspStatus}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="p-4">
                                  {template.updatedAt ? new Date(template.updatedAt).toLocaleString() : "—"}
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleValidateTemplate(template)}
                                      disabled={validatingTemplateId === template.id}
                                    >
                                      {validatingTemplateId === template.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                      )}
                                      Validate
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setTemplateValidations((prev) => ({ ...prev, [template.id]: undefined as any }))}
                                      disabled={!validation}
                                    >
                                      Clear
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {validation && (
                                <tr className="bg-muted/40">
                                  <td colSpan={5} className="p-4">
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2 text-sm font-medium">
                                        {validation.isValid ? (
                                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        ) : (
                                          <AlertTriangle className="h-4 w-4 text-destructive" />
                                        )}
                                        <span>
                                          {validation.isValid
                                            ? "Template passed validation"
                                            : "Template validation failed"}
                                        </span>
                                      </div>
                                      <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                          <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                            Required Variables
                                          </p>
                                          <div className="mt-1 text-sm">
                                            {validation.requiredVariables.length ? (
                                              <div className="space-y-1">
                                                {validation.requiredVariables.map((variable) => (
                                                  <div key={variable}>
                                                    {variable}
                                                    {validation.providedVariables.includes(variable) ? (
                                                      <span className="ml-2 text-emerald-600">provided</span>
                                                    ) : (
                                                      <span className="ml-2 text-destructive">missing</span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-muted-foreground">No placeholders detected</span>
                                            )}
                                          </div>
                                        </div>
                                        <div>
                                          <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                            Media Requirement
                                          </p>
                                          <p className="mt-1 text-sm">
                                            {validation.mediaRequirement.required
                                              ? `Requires ${validation.mediaRequirement.expectedType ?? 'media'} asset`
                                              : 'Media is optional for this template.'}
                                          </p>
                                          {validation.warnings.length > 0 && (
                                            <div className="mt-2 space-y-1 text-xs text-amber-600">
                                              {validation.warnings.map((warning, index) => (
                                                <div key={index} className="flex items-start gap-1">
                                                  <AlertTriangle className="mt-0.5 h-3 w-3" />
                                                  <span>{warning}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {validation.errors.length > 0 && (
                                        <div>
                                          <p className="text-xs uppercase tracking-wider text-destructive">Errors</p>
                                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-destructive">
                                            {validation.errors.map((errorMsg, index) => (
                                              <li key={index}>{errorMsg}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Settings;
