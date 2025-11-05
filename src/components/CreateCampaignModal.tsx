import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { campaignsAPI, contactsAPI } from "@/services/api";
import { useNavigate } from "react-router-dom";
import { WHATSAPP_NUMBERS } from "@/config/app";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (campaign: any) => void;
}

// Optimized CSV parsing with chunking for large files (lakhs of contacts)
// Returns estimated count quickly without parsing entire file
function estimateContactsFromCsv(file: File): Promise<number> {
  return new Promise((resolve) => {
    // For very large files, we'll sample and estimate
    const maxSampleSize = 500 * 1024; // 500KB sample
    const fileSize = file.size;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const sample = e.target?.result as string || "";
      const lines = sample.split(/\r?\n/).filter(Boolean);
      
      if (lines.length === 0) {
        resolve(0);
        return;
      }
      
      // Check if first line is header
      const isHeader = /[a-zA-Z]/.test(lines[0]);
      const dataLines = isHeader ? lines.slice(1) : lines;
      
      // Calculate average line length
      const totalLength = sample.length;
      const avgLineLength = totalLength / lines.length;
      
      // Estimate total lines in full file
      let estimatedLines = Math.floor(fileSize / avgLineLength);
      
      // Cap at reasonable number to avoid UI issues
      estimatedLines = Math.min(estimatedLines, 1000000);
      
      // If we read the whole file, return exact count
      if (fileSize <= maxSampleSize) {
        resolve(dataLines.length);
      } else {
        // Otherwise return estimate
        const estimatedDataLines = isHeader 
          ? estimatedLines - 1 
          : estimatedLines;
        resolve(estimatedDataLines);
      }
    };
    
    // Read only a sample for large files
    if (fileSize > maxSampleSize) {
      const blob = file.slice(0, maxSampleSize);
      reader.readAsText(blob);
    } else {
      reader.readAsText(file);
    }
  });
}

export default function CreateCampaignModal({ open, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [mode, setMode] = useState<"template" | "custom">("custom");
  const [template, setTemplate] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | null>(null);
  const [numberId, setNumberId] = useState("");
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [contactsFile, setContactsFile] = useState<File | null>(null);
  const [contactsCount, setContactsCount] = useState(0);
  const [runNow, setRunNow] = useState(true);
  
  // Contact selection
  const [useExistingContacts, setUseExistingContacts] = useState(false);
  const [contactFiles, setContactFiles] = useState<{filename: string, count: number}[]>([]);
  const [selectedContactFile, setSelectedContactFile] = useState<string | null>(null);

  // Fetch available contact files
  useEffect(() => {
    const fetchContactFiles = async () => {
      try {
        const files = await contactsAPI.getFiles();
        setContactFiles(files);
      } catch (err) {
        console.error("Error fetching contact files:", err);
      }
    };
    
    fetchContactFiles();
  }, []);

  useEffect(() => {
    if (!mediaFile) {
      setMediaPreview(null);
      setMediaType(null);
      return;
    }
    
    // Determine media type
    const fileType = mediaFile.type.split('/')[0];
    const fileExt = mediaFile.name.split('.').pop()?.toLowerCase();
    
    if (fileType === 'image') {
      setMediaType('image');
      const url = URL.createObjectURL(mediaFile);
      setMediaPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (fileType === 'video') {
      setMediaType('video');
      const url = URL.createObjectURL(mediaFile);
      setMediaPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (
      fileType === 'application' || 
      ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(fileExt || '')
    ) {
      setMediaType('document');
      setMediaPreview(null); // No preview for documents
    } else {
      setMediaType(null);
      setMediaPreview(null);
    }
  }, [mediaFile]);

  const canSubmit = useMemo(() => {
    if (!campaignName) return false;
    if (!numberId) return false;
    if (mode === "template" && !template) return false;
    // For custom mode, either caption or media is required (or both)
    if (mode === "custom" && !caption && !mediaFile) return false;
    
    // Check contacts
    if (useExistingContacts && !selectedContactFile) return false;
    if (!useExistingContacts && !contactsFile) return false;
    
    return true;
  }, [campaignName, numberId, mode, template, caption, mediaFile, useExistingContacts, selectedContactFile, contactsFile]);

  const handleContactsChange = async (file: File | null) => {
    setContactsFile(file);
    setContactsCount(0);
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".csv")) {
      try {
        // Show loading state
        toast({ title: "Processing contacts", description: "Analyzing contact file...", duration: 2000 });
        
        // Estimate count without loading entire file
        const estimatedCount = await estimateContactsFromCsv(file);
        setContactsCount(estimatedCount);
        
        if (estimatedCount > 100000) {
          toast({ 
            title: "Large contact list detected", 
            description: `Estimated ${estimatedCount.toLocaleString()} contacts. Processing may take time.`,
            duration: 5000
          });
        }
      } catch (err) {
        toast({ title: "Error processing contacts", description: "Please try a different file format.", variant: "destructive" });
      }
    } else if (file.name.toLowerCase().match(/\.xlsx?$|\.xls$/)) {
      toast({ title: "Excel supported soon", description: "For now, upload CSV. We'll add Excel parsing next.", variant: "default" });
    } else {
      toast({ title: "Unsupported file", description: "Upload CSV (comma or tab separated).", variant: "destructive" });
    }
  };

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      
      // For large contact lists, show a warning
      if (contactsCount > 50000) {
        toast({
          title: "Processing large campaign",
          description: `Preparing to process ${contactsCount.toLocaleString()} contacts. This may take some time.`,
          duration: 5000
        });
      }
      // Note: media upload endpoint not wired yet; send empty media_url for now
      const payload: any = {
        campaign_name: campaignName,
        caption: mode === "custom" ? caption : undefined,
        media_url: undefined,
        media_type: mediaFile ? mediaType : undefined,
        media_name: mediaFile ? mediaFile.name : undefined,
        scheduled_start: startAt || undefined,
        scheduled_end: endAt || undefined,
        contact_file: useExistingContacts ? selectedContactFile : undefined,
        // status remains draft by default; a future action will start and move to Active
      };
      const created = await campaignsAPI.create(payload);

      toast({ title: "Campaign created", description: `${created.campaign_name} saved${contactsCount ? ` with ${contactsCount} contacts (local)` : ''}.` });
      onCreated?.(created);

      if (runNow) {
        // persist a running campaign locally so Active Campaigns can show it immediately
        const storeKey = "running_campaigns";
        const existing: any[] = JSON.parse(localStorage.getItem(storeKey) || "[]");
        // Get contact count based on selection method
        let totalContactCount = contactsCount;
        if (useExistingContacts && selectedContactFile) {
          const selectedFile = contactFiles.find(f => f.filename === selectedContactFile);
          if (selectedFile) {
            totalContactCount = selectedFile.count;
          }
        }
        
        const running = {
          id: created.id,
          name: created.campaign_name,
          progress: 0,
          sent: 0,
          failed: 0,
          retries: 0,
          startedAt: new Date().toLocaleString(),
          status: "running",
          template: mode === "template" ? template : "custom",
          totalContacts: totalContactCount || 100, // fallback estimate
          numberId,
          // Include media information for ActiveCampaigns display
          media_type: mediaFile ? mediaType : undefined,
          media_name: mediaFile ? mediaFile.name : undefined,
          caption: mode === "custom" ? caption : undefined,
          contact_file: useExistingContacts ? selectedContactFile : undefined,
        };
        
        // Limit localStorage size by keeping only recent campaigns
        const maxCampaigns = 10;
        const updatedCampaigns = [running, ...existing].slice(0, maxCampaigns);
        localStorage.setItem(storeKey, JSON.stringify(updatedCampaigns));
        navigate("/active-campaigns");
      }

      onClose();
    } catch (e: any) {
      toast({ title: "Failed to create campaign", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && (o ? null : onClose())}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input placeholder="e.g. Summer Sale" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </div>
          
          <div className="grid gap-2">
            <Label>WhatsApp Number</Label>
            <Select value={numberId} onValueChange={setNumberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select number" />
              </SelectTrigger>
              <SelectContent>
                {WHATSAPP_NUMBERS.map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Message Type</Label>
            <div className="flex gap-2">
              <Button type="button" variant={mode === "custom" ? "default" : "outline"} onClick={() => setMode("custom")}>Custom</Button>
              <Button type="button" variant={mode === "template" ? "default" : "outline"} onClick={() => setMode("template")}>Template</Button>
            </div>
          </div>

          {mode === "template" ? (
            <div className="grid gap-2">
              <Label>Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order_update">Order Update</SelectItem>
                  <SelectItem value="promo_summer">Promo - Summer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="use-existing" 
                  checked={useExistingContacts}
                  onCheckedChange={(checked) => {
                    setUseExistingContacts(checked === true);
                    if (checked === true) {
                      setContactsFile(null);
                      setContactsCount(0);
                    } else {
                      setSelectedContactFile(null);
                    }
                  }}
                />
                <Label htmlFor="use-existing">Use existing contacts</Label>
              </div>
              
              {useExistingContacts ? (
                <div className="grid gap-2">
                  <Label>Select Contact File</Label>
                  {contactFiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-4 border rounded-md">
                      No contact files available. Please upload contacts first.
                    </div>
                  ) : (
                    <div className="grid gap-2 max-h-[200px] overflow-y-auto p-2 border rounded-md">
                      {contactFiles.map((file) => (
                        <div 
                          key={file.filename}
                          className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${selectedContactFile === file.filename ? 'bg-primary/10' : 'hover:bg-accent'}`}
                          onClick={() => setSelectedContactFile(file.filename)}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">{file.filename}</span>
                          </div>
                          <Badge variant="outline">{file.count} contacts</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="contacts">Upload Contacts CSV</Label>
                  <Input
                    id="contacts"
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleContactsChange(e.target.files?.[0] || null)}
                  />
                  {contactsCount > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {contactsCount.toLocaleString()} contacts detected
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === "custom" && (
            <>
              <div className="grid gap-2">
                <Label>Caption</Label>
                <Textarea rows={4} placeholder="Write your message" value={caption} onChange={(e) => setCaption(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Attachment (optional)</Label>
                <Input 
                  type="file" 
                  accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain" 
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)} 
                />
                {mediaFile && (
                  <div className="text-xs text-muted-foreground">
                    Selected file: {mediaFile.name} ({(mediaFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                {mediaType === 'image' && mediaPreview && (
                  <div className="border rounded p-2">
                    <img src={mediaPreview} alt="preview" className="max-h-40 object-contain" />
                  </div>
                )}
                {mediaType === 'video' && mediaPreview && (
                  <div className="border rounded p-2">
                    <video src={mediaPreview} controls className="max-h-40 max-w-full" />
                  </div>
                )}
                {mediaType === 'document' && (
                  <div className="border rounded p-2 flex items-center justify-center py-4">
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="mt-2 text-sm">Document preview not available</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Start</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>End</Label>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input id="run-now" type="checkbox" className="h-4 w-4" checked={runNow} onChange={(e) => setRunNow(e.target.checked)} />
            <Label htmlFor="run-now">Run this campaign now</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submitting}>{submitting ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
