import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Upload, Download, Users, Tag, Trash2, FileText, X, Edit, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { contactsAPI } from "@/services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Contact {
  id: number;
  phone: string;
  source_file: string | null;
  is_active: boolean;
  created_at: string;
}

interface ContactFile {
  filename: string;
  count: number;
}

const Contacts = () => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactFiles, setContactFiles] = useState<ContactFile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [totalContacts, setTotalContacts] = useState(0);
  const [activeContacts, setActiveContacts] = useState(0);
  const [fileCount, setFileCount] = useState(0);
  
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [openFileDialog, setOpenFileDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContacts, setFileContacts] = useState<Contact[]>([]);
  
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editedPhone, setEditedPhone] = useState("");
  
  // Fetch all contacts and files
  useEffect(() => {
    fetchContacts();
    fetchContactFiles();
  }, []);
  
  // Fetch files when dialog opens
  useEffect(() => {
    if (openFileDialog) {
      console.log('Dialog opened, fetching file data...');
      fetchContactFiles();
    }
  }, [openFileDialog]);
  
  // Update statistics whenever contacts change
  useEffect(() => {
    setTotalContacts(contacts.length);
    setActiveContacts(contacts.filter(c => c.is_active).length);
    console.log(`Updated contact stats: ${contacts.length} total, ${contacts.filter(c => c.is_active).length} active`);
  }, [contacts]);
  
  // Update file count when contactFiles changes
  useEffect(() => {
    // Count all files, not just those with contacts
    setFileCount(contactFiles.length);
    console.log(`Updated file count: ${contactFiles.length} total files`);
  }, [contactFiles]);
  
  // Force refresh of data on component mount
  useEffect(() => {
    const initialLoad = async () => {
      console.log('Initial data load');
      await fetchContacts();
      await fetchContactFiles();
    };
    
    initialLoad();
  }, []);
  
  // Periodically refresh file count
  useEffect(() => {
    // Refresh file count every 30 seconds
    const intervalId = setInterval(async () => {
      console.log('Auto-refreshing file count...');
      try {
        const updatedFiles = await contactsAPI.getFiles(`?t=${new Date().getTime()}`);
        if (Array.isArray(updatedFiles) && 
            updatedFiles.length !== contactFiles.length) {
          console.log(`File count changed: ${contactFiles.length} -> ${updatedFiles.length}`);
          setContactFiles(updatedFiles);
          setFileCount(updatedFiles.length);
        }
      } catch (err) {
        console.error('Error auto-refreshing file count:', err);
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(intervalId);
  }, [contactFiles.length]);
  
  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await contactsAPI.getAll();
      setContacts(data);
      setTotalContacts(data.length);
      setActiveContacts(data.filter(c => c.is_active).length);
    } catch (err) {
      toast({
        title: "Error fetching contacts",
        description: "Failed to load contact data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchContactFiles = async () => {
    try {
      // Only set loading state if we're not already loading
      if (!loadingFiles) {
        setLoadingFiles(true);
      }
      
      console.log('Fetching contact files...');
      
      // Add a timestamp to prevent caching
      const timestamp = new Date().getTime();
      const data = await contactsAPI.getFiles(`?t=${timestamp}`);
      
      // Make sure we have valid data
      if (Array.isArray(data)) {
        console.log(`Received ${data.length} contact files:`, data);
        
        // Only update state if the data has actually changed
        const currentFilenames = contactFiles.map(f => f.filename).sort().join(',');
        const newFilenames = data.map(f => f.filename).sort().join(',');
        
        if (currentFilenames !== newFilenames || 
            contactFiles.length !== data.length) {
          console.log('Contact files have changed, updating state');
          setContactFiles(data);
          
          // Update the contact files count in the stats - show all files
          console.log(`Found ${data.length} total files`);
          setFileCount(data.length);
        } else {
          console.log('Contact files unchanged, no state update needed');
        }
      } else {
        console.error('Received invalid data format for contact files:', data);
        setContactFiles([]);
        setFileCount(0);
      }
    } catch (err) {
      console.error('Error fetching contact files:', err);
      toast({
        title: "Error fetching contact files",
        description: "Failed to load file data.",
        variant: "destructive",
      });
      setContactFiles([]);
      setFileCount(0);
    } finally {
      setLoadingFiles(false);
    }
  };
  
  const handleUpload = async () => {
    if (!uploadFile) return;
    
    try {
      setUploading(true);
      
      // Check if file is a supported format
      const fileExt = uploadFile.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !['csv', 'txt', 'xls', 'xlsx'].includes(fileExt)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV, TXT, XLS, or XLSX file.",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size
      if (uploadFile.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      const result = await contactsAPI.uploadFile(uploadFile);
      
      if (result.unique > 0) {
        toast({
          title: "File uploaded successfully",
          description: `Added ${result.unique} unique contacts from ${result.originalname}`,
        });
      } else {
        toast({
          title: "File processed",
          description: `No contacts found in ${result.originalname}. Please make sure your file contains phone numbers in the first column or in a column with a header containing 'phone', 'number', 'mobile', etc.`,
          variant: "destructive",
          duration: 6000,
        });
      }
      
      setOpenUploadDialog(false);
      setUploadFile(null);
      
      // Refresh data and update file count immediately
      await fetchContacts();
      await fetchContactFiles();
      
      // Force an immediate update of the file count
      const updatedFiles = await contactsAPI.getFiles(`?t=${new Date().getTime()}`);
      if (Array.isArray(updatedFiles)) {
        console.log(`Immediate file count update: ${updatedFiles.length} files`);
        setFileCount(updatedFiles.length);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({
        title: "Upload failed",
        description: err?.response?.data?.message || "There was an error uploading your file.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };
  
  const handleViewFile = async (filename: string) => {
    console.log(`Viewing file: ${filename}`);
    setSelectedFile(filename);
    try {
      const data = await contactsAPI.getContactsByFile(filename);
      console.log(`Received ${data.length} contacts for file ${filename}:`, data);
      setFileContacts(data);
      setOpenFileDialog(true);
    } catch (err: any) {
      console.error(`Error loading contacts from file ${filename}:`, err);
      toast({
        title: "Error",
        description: err?.response?.data?.message || "Failed to load contacts from file.",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    
    try {
      setLoadingFiles(true);
      console.log(`Deleting file ${fileToDelete} and all associated contacts...`);
      
      const result = await contactsAPI.removeContactsByFile(fileToDelete);
      
      console.log(`Deletion result:`, result);
      
      toast({
        title: "File deleted",
        description: `All ${result.count} contacts from ${fileToDelete} have been removed.`,
      });
      
      // Close dialogs and reset state
      setOpenDeleteDialog(false);
      setFileToDelete(null);
      setSelectedFile(null);
      setFileContacts([]);
      
      // Refresh data with a slight delay to ensure backend has processed everything
      setTimeout(async () => {
        try {
          // First refresh contacts
          await fetchContacts();
          
          // Then refresh files
          await fetchContactFiles();
          
          // Force an immediate update of the file count with a third request
          // This ensures the UI is updated even if the backend is slow
          const updatedFiles = await contactsAPI.getFiles(`?t=${new Date().getTime()}`);
          if (Array.isArray(updatedFiles)) {
            console.log(`Immediate file count update after deletion: ${updatedFiles.length} files`);
            setFileCount(updatedFiles.length);
            
            // Also update the contact files list
            setContactFiles(updatedFiles);
          }
        } catch (refreshError) {
          console.error('Error refreshing data after deletion:', refreshError);
        } finally {
          setLoadingFiles(false);
        }
      }, 500);
    } catch (err: any) {
      console.error('Delete file error:', err);
      setLoadingFiles(false);
      toast({
        title: "Error",
        description: err?.response?.data?.message || "Failed to delete contacts.",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteContact = async (id: number) => {
    try {
      // Find the contact to be deleted to get its source_file
      const contactToDelete = contacts.find(c => c.id === id);
      const sourceFile = contactToDelete?.source_file;
      
      await contactsAPI.remove(id);
      
      toast({
        title: "Contact deleted",
        description: "Contact has been removed.",
      });
      
      // Refresh all data
      await fetchContacts();
      
      // If we're viewing a specific file, refresh its contacts
      if (selectedFile) {
        const data = await contactsAPI.getContactsByFile(selectedFile);
        setFileContacts(data);
      }
      
      // If the deleted contact was from a file, refresh the file list
      if (sourceFile) {
        await fetchContactFiles();
      }
    } catch (err: any) {
      console.error('Delete contact error:', err);
      toast({
        title: "Error",
        description: err?.response?.data?.message || "Failed to delete contact.",
        variant: "destructive",
      });
    }
  };
  
  const handleEditContact = async () => {
    if (!editContact) return;
    
    try {
      await contactsAPI.update(editContact.id, { 
        phone: editedPhone 
      });
      
      toast({
        title: "Contact updated",
        description: "Phone number has been updated.",
      });
      
      setEditContact(null);
      fetchContacts();
      if (selectedFile) {
        const data = await contactsAPI.getContactsByFile(selectedFile);
        setFileContacts(data);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update contact.",
        variant: "destructive",
      });
    }
  };
  
  const filteredContacts = contacts.filter(contact => 
    contact.phone.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Contacts</h1>
            <p className="mt-1 text-muted-foreground">Manage your contact lists</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none"
              onClick={() => {
                setOpenFileDialog(true);
                fetchContactFiles();
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Manage Files
            </Button>
            <Button 
              className="flex-1 sm:flex-none bg-primary hover:bg-primary/90"
              onClick={() => setOpenUploadDialog(true)}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                <h3 className="text-2xl font-bold text-foreground">{totalContacts.toLocaleString()}</h3>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-success/10 p-3">
                <Users className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Contacts</p>
                <h3 className="text-2xl font-bold text-foreground">{activeContacts.toLocaleString()}</h3>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-warning/10 p-3">
                  <FileText className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contact Files</p>
                  <h3 className="text-2xl font-bold text-foreground">{fileCount}</h3>
                </div>
              </div>
              <button 
                className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent/50 transition-colors"
                onClick={async () => {
                  console.log('Refreshing file count...');
                  await fetchContactFiles();
                  const updatedFiles = await contactsAPI.getFiles(`?t=${new Date().getTime()}`);
                  if (Array.isArray(updatedFiles)) {
                    setFileCount(updatedFiles.length);
                  }
                }}
                title="Refresh file count"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              className="pl-9 bg-card border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={fetchContacts}
          >
            <Users className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Phone Number</TableHead>
                <TableHead>Source File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading contacts...v
                  </TableCell>
                </TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No contacts found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className="border-border">
                    <TableCell className="font-medium">{contact.phone}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.source_file ? (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {contact.source_file}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Manual entry</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={contact.is_active ? "default" : "secondary"} className={`text-xs ${contact.is_active ? "text-green-600" : ""}`}>
                        {contact.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(contact.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setEditContact(contact);
                            setEditedPhone(contact.phone);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

      <Button
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl hover:shadow-2xl"
        onClick={() => {
          setEditContact(null);
          setEditedPhone("");
        }}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Upload Dialog */}
      <Dialog open={openUploadDialog} onOpenChange={setOpenUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
            <DialogDescription>
              Upload a file with contact information (CSV, TXT, XLS, XLSX).
              The file should have a column with phone numbers or have phone numbers in the first column.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Label htmlFor="contacts-file">Contact File</Label>
            <Input 
              id="contacts-file" 
              type="file" 
              accept=".csv,.txt,.xls,.xlsx" 
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
            {uploadFile && (
              <p className="text-sm text-muted-foreground">
                Selected file: {uploadFile.name} ({Math.round(uploadFile.size / 1024)} KB)
              </p>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenUploadDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleUpload} 
              disabled={!uploadFile || uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Files Dialog */}
      <Dialog open={openFileDialog} onOpenChange={(open) => {
        // Only update if we're closing the dialog
        if (!open) {
          setOpenFileDialog(false);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle>Manage Contact Files</DialogTitle>
                <DialogDescription>
                  View and manage your uploaded contact files.
                </DialogDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchContactFiles()}
                disabled={loadingFiles}
              >
                {loadingFiles ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-1"></div>
                    Refreshing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
                    Refresh Files
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>
          
          <div className="py-4">
            {selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <h3 className="font-medium">{selectedFile}</h3>
                    <Badge variant="outline">{fileContacts.length} contacts</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                    <X className="h-4 w-4" />
                    Close
                  </Button>
                </div>
                
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Added Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fileContacts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4">
                            No contacts in this file.
                          </TableCell>
                        </TableRow>
                      ) : (
                        fileContacts.map((contact) => (
                          <TableRow key={contact.id}>
                            <TableCell>{contact.phone}</TableCell>
                            <TableCell>
                              <Badge variant={contact.is_active ? "default" : "secondary"} className="text-xs text-green-600">
                                {contact.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(contact.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteContact(contact.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                <div className="flex justify-between">
                  <Button 
                    variant="destructive" 
                    onClick={() => {
                      setFileToDelete(selectedFile);
                      setOpenDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All Contacts
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedFile(null)}>Back to Files</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {loadingFiles ? (
                  <div className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="text-muted-foreground">Loading contact files...</p>
                    </div>
                  </div>
                ) : contactFiles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No contact files found.</p>
                    <div className="flex flex-col gap-2 mt-4 items-center">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setOpenFileDialog(false);
                          setOpenUploadDialog(true);
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Contacts
                      </Button>
                      <Button 
                        variant="secondary"
                        onClick={() => {
                          console.log('Current contact files:', contactFiles);
                          fetchContactFiles();
                        }}
                      >
                        Debug File Data
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {contactFiles.map((file) => (
                      <div 
                        key={file.filename} 
                        className="border rounded-lg p-4 flex justify-between items-center hover:bg-accent/50 cursor-pointer"
                        onClick={() => handleViewFile(file.filename)}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-medium">{file.filename}</p>
                            <p className="text-sm text-muted-foreground">{file.count} contacts</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all contacts from the file "{fileToDelete}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input 
                id="phone-number" 
                value={editedPhone} 
                onChange={(e) => setEditedPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditContact(null)}>Cancel</Button>
            <Button onClick={handleEditContact}>
              <Check className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contacts;
