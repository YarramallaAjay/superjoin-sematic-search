"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  Search, 
  FileText, 
  MessageSquare, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  Database,
  Bot,
  User,
  Send,
  X,
  Settings,
  Sheet,
  Grid3X3,
  Eye,
  Lightbulb,
  BarChart3,
  Copy,
  Download
} from "lucide-react";
import { apiService, SearchResponse, Workbook, SearchResult } from "./services/api-service";
import { UploadService, UploadResult } from "@/lib/upload-service";
import { BackendJobService, JobStatus } from "@/lib/job-service-backend";
import { useToast } from "./hooks/use-toast";
import { ThemeToggle } from "./components/theme-toggle";

interface UploadStatus {
  fileName?: string;
  isUploading: boolean;
  progress: number;
  message: string;
  tenantId?: string;
  workbookId?: string;
  cellCount?: number;
  jobId?: string;
  canCancel?: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  searchResults?: SearchResponse;
  keyInsights?: string[];
  generatedTable?: string;
}

interface SheetData {
  sheetName: string;
  data: SearchResult[];
  rowCount: number;
  columnCount: number;
  cellCount: number;
}

export default function Home() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    isUploading: false,
    progress: 0,
    message: "Ready to upload",
    canCancel: false
  });
  
  // Store current upload service instance for cancellation
  const [currentUploadService, setCurrentUploadService] = useState<UploadService | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [selectedWorkbook, setSelectedWorkbook] = useState<Workbook | null>(null);
  const [isLoadingWorkbooks, setIsLoadingWorkbooks] = useState(false);
  
  // Chat functionality
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatVisible, setIsChatVisible] = useState(false);
  
  // Table state
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [tableSortBy, setTableSortBy] = useState('semanticString');
  const [tableSortOrder, setTableSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Sheet view state
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [sheetViewMode, setSheetViewMode] = useState<'table' | 'grid'>('table');
  const [showKeyInsights, setShowKeyInsights] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { toast, toasts, dismiss } = useToast();

  // Load workbooks on mount
  useEffect(() => {
    loadWorkbooks();
  }, []);

  // Scroll chat to bottom when new messages added
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const loadWorkbooks = async () => {
    try {
      setIsLoadingWorkbooks(true);
      const response = await apiService.fetchWorkbooks();
      if (response.success) {
        setWorkbooks(response.workbooks);
      } else {
        throw new Error(response.error || 'Failed to fetch workbooks');
      }
    } catch (error) {
      console.error('Error loading workbooks:', error);
      toast({
        title: "Error",
        description: "Failed to load workbooks. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingWorkbooks(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset status
    setUploadStatus({
      fileName: file.name,
      isUploading: true,
      progress: 0,
      message: "Starting enhanced upload...",
      canCancel: true
    });

    try {
      // Create new upload service instance
      const uploadService = new UploadService();
      setCurrentUploadService(uploadService);

      // Step 1: Upload to Supabase Storage (no timeout issues)
      const uploadResult = await uploadService.uploadFileToSupabase(file);
      
      if (!uploadResult.success || !uploadResult.filePath || !uploadResult.fileUrl) {
        throw new Error(uploadResult.error || 'Failed to upload file to storage');
      }

      setUploadStatus(prev => ({
        ...prev,
        progress: 15,
        message: "File uploaded, starting processing...",
      }));

      // Step 2: Create background processing job
      const jobResult = await BackendJobService.processFile(
        file,
        uploadResult.filePath,
        uploadResult.fileUrl,
        {
          userId: 'default-user', // TODO: Replace with actual user ID
          onProgress: (job: JobStatus) => {
            setUploadStatus(prev => ({
              ...prev,
              progress: job.progress,
              message: job.currentStep,
              jobId: job.jobId,
              canCancel: !['completed', 'failed', 'cancelled'].includes(job.status)
            }));
          },
          onComplete: (job: JobStatus) => {
            const isSuccess = job.status === 'completed';
            
            setUploadStatus({
              fileName: file.name,
              isUploading: false,
              progress: 100,
              message: isSuccess 
                ? `Processing completed! ${job.result?.processedRows ? `Processed ${job.result.processedRows} rows.` : ''}`
                : `Processing failed: ${job.error}`,
              jobId: job.jobId,
              canCancel: false,
              cellCount: job.result?.processedRows
            });

            if (isSuccess) {
              toast({
                title: "Success",
                description: `File processed successfully! ${job.result?.embeddingsGenerated ? `Generated ${job.result.embeddingsGenerated} embeddings.` : ''}`,
              });

              // Reload workbooks to include the new one
              loadWorkbooks();
            } else {
              toast({
                title: "Processing Failed",
                description: job.error || 'Unknown processing error',
                variant: "destructive"
              });
            }

            // Clear file input
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }

            // Reset after 5 seconds
            setTimeout(() => {
              setUploadStatus(prev => ({
                ...prev,
                progress: 0,
                message: "Ready to upload"
              }));
            }, 5000);
          },
          onError: (error: string) => {
            setUploadStatus(prev => ({
              ...prev,
              isUploading: false,
              progress: 0,
              message: `Processing failed: ${error}`,
              canCancel: false
            }));

            toast({
              title: "Processing Failed",
              description: error,
              variant: "destructive"
            });
          }
        }
      );

      if (!jobResult.success) {
        throw new Error(jobResult.error || 'Failed to start processing job');
      }

      // Clear service reference after completion
      setCurrentUploadService(null);

    } catch (error) {
      console.error('Upload error:', error);
      setCurrentUploadService(null);
      
      setUploadStatus(prev => ({
        ...prev,
        isUploading: false,
        progress: 0,
        message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        canCancel: false
      }));

      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    }
  };

  // Cancel upload function
  const handleCancelUpload = async () => {
    if (currentUploadService) {
      currentUploadService.cancel();
    }

    // Cancel backend job if exists
    if (uploadStatus.jobId) {
      try {
        await BackendJobService.cancelJob(uploadStatus.jobId);
      } catch (error) {
        console.error('Error cancelling backend job:', error);
      }
    }

    setUploadStatus(prev => ({
      ...prev,
      isUploading: false,
      progress: 0,
      message: "Upload cancelled",
      canCancel: false
    }));
    
    setCurrentUploadService(null);
    
    toast({
      title: "Upload Cancelled",
      description: "File upload and processing has been cancelled successfully."
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter a search query",
        variant: "destructive"
      });
      return;
    }

    if (!selectedWorkbook) {
      toast({
        title: "Error",
        description: "Please select a workbook first",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSearching(true);
      
      // Add user message to chat
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: searchQuery,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, userMessage]);
      
      // Add loading message
      const loadingMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: "Searching your data...",
        timestamp: new Date(),
        isLoading: true
      };
      setChatMessages(prev => [...prev, loadingMessage]);
      setIsChatVisible(true);

      const results = await apiService.searchWithWorkbook(
        searchQuery,
        selectedWorkbook.id,
        selectedWorkbook.tenantId,
        50
      );
      
      setSearchResults(results);
      
      // Remove loading message and add real response
      setChatMessages(prev => prev.filter(msg => !msg.isLoading));
      
      if (results.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: results.llmResponse?.answer || "Found data matching your query. Check the results table below.",
          timestamp: new Date(),
          searchResults: results,
          keyInsights: results.llmResponse?.keyInsights ? [results.llmResponse.keyInsights] : undefined,
          generatedTable: results.llmResponse?.generatedTable || results.generatedTable
        };
        setChatMessages(prev => [...prev, assistantMessage]);

        toast({
          title: "Search Complete",
          description: `Found ${results.structuredData?.length || 0} results`,
        });
      } else {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: 'assistant',
          content: "Sorry, I couldn't find any results for your query. Please try a different search.",
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, errorMessage]);
      }

      setSearchQuery("");
    } catch (error) {
      console.error('Search error:', error);
      
      // Remove loading message
      setChatMessages(prev => prev.filter(msg => !msg.isLoading));
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'assistant',
        content: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);

      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    setSearchQuery(chatInput);
    setChatInput("");
    handleSearch();
  };

  // Computed filtered and sorted table data
  const filteredTableData = useMemo(() => {
    if (!searchResults?.structuredData) return [];
    
    let filtered = searchResults.structuredData.filter(item => item.sheetName !== "AI Analysis Results");
    
    if (tableSearchTerm) {
      const searchLower = tableSearchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        Object.values(item).some(value => 
          value && value.toString().toLowerCase().includes(searchLower)
        )
      );
    }
    
    filtered.sort((a, b) => {
      let aValue = a[tableSortBy as keyof typeof a];
      let bValue = b[tableSortBy as keyof typeof b];
      
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (tableSortOrder === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
    
    return filtered;
  }, [searchResults?.structuredData, tableSearchTerm, tableSortBy, tableSortOrder]);

  // Sheet-wise data organization
  const sheetWiseData = useMemo(() => {
    if (!searchResults?.structuredData) return [];
    
    const sheetMap = new Map<string, SheetData>();
    
    searchResults.structuredData.forEach(item => {
      if (item.sheetName === "AI Analysis Results") return;
      
      if (!sheetMap.has(item.sheetName)) {
        sheetMap.set(item.sheetName, {
          sheetName: item.sheetName,
          data: [],
          rowCount: 0,
          columnCount: 0,
          cellCount: 0
        });
      }
      
      const sheet = sheetMap.get(item.sheetName)!;
      sheet.data.push(item);
      sheet.cellCount++;
      
      // Extract row and column from cellAddress (e.g., "A1" -> row 1, col A)
      if (item.cellAddress) {
        const match = item.cellAddress.match(/([A-Z]+)(\d+)/);
        if (match) {
          const col = match[1];
          const row = parseInt(match[2]);
          
          // Convert column letter to number (A=1, B=2, etc.)
          const colNum = col.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0);
          
          sheet.rowCount = Math.max(sheet.rowCount, row);
          sheet.columnCount = Math.max(sheet.columnCount, colNum);
        }
      }
    });
    
    return Array.from(sheetMap.values()).sort((a, b) => a.sheetName.localeCompare(b.sheetName));
  }, [searchResults?.structuredData]);

  // Get unique sheets for filtering
  const availableSheets = useMemo(() => {
    return sheetWiseData.map(sheet => sheet.sheetName);
  }, [sheetWiseData]);

  // Filter data by selected sheet
  const sheetFilteredData = useMemo(() => {
    if (!selectedSheet) return filteredTableData;
    return filteredTableData.filter(item => item.sheetName === selectedSheet);
  }, [filteredTableData, selectedSheet]);

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            <h1 className="text-lg font-semibold">SuperJoin Semantic Search</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Toast Container */}
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
              toast.variant === 'destructive' 
                ? 'bg-destructive text-destructive-foreground' 
                : 'bg-primary text-primary-foreground'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{toast.title}</div>
                <div className="text-sm opacity-90">{toast.description}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismiss(toast.id)}
                className="text-current hover:text-current/80"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <main className="container mx-auto p-6 space-y-6">
        {/* Workbook Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Workbook Selection
            </CardTitle>
            <CardDescription>
              Choose a workbook to search in or upload a new Excel file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select
                value={selectedWorkbook?.id || ""}
                onValueChange={(value) => {
                  const workbook = workbooks.find(w => w.id === value);
                  setSelectedWorkbook(workbook || null);
                }}
                disabled={isLoadingWorkbooks}
              >
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Select a workbook" />
                </SelectTrigger>
                <SelectContent>
                  {workbooks.map((workbook) => (
                    <SelectItem key={workbook.id} value={workbook.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{workbook.name}</span>
                        <span className="text-sm text-muted-foreground">
                          Tenant: {workbook.tenantName}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={loadWorkbooks}
                disabled={isLoadingWorkbooks}
                variant="outline"
                size="sm"
              >
                {isLoadingWorkbooks ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>

            {/* Selected Workbook Status */}
            {selectedWorkbook && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200 font-medium">
                  <CheckCircle className="h-5 w-5" />
                  Selected Workbook
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-700 dark:text-green-300 font-medium">Name:</span>
                    <div className="text-green-800 dark:text-green-200">{selectedWorkbook.name}</div>
                  </div>
                  <div>
                    <span className="text-green-700 dark:text-green-300 font-medium">Tenant:</span>
                    <div className="text-green-800 dark:text-green-200">{selectedWorkbook.tenantName}</div>
                  </div>
                  <div>
                    <span className="text-green-700 dark:text-green-300 font-medium">ID:</span>
                    <div className="text-green-800 dark:text-green-200 font-mono text-xs">{selectedWorkbook.id.slice(-8)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* No Workbooks Status */}
            {!isLoadingWorkbooks && workbooks.length === 0 && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">No workbooks available</span>
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Upload an Excel file below to create your first workbook.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload & Process
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Search & Chat
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Excel File
                </CardTitle>
                <CardDescription>
                  Upload an Excel file to process and create embeddings for semantic search
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    disabled={uploadStatus.isUploading}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadStatus.isUploading}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Choose File
                    </Button>
                    
                    {uploadStatus.canCancel && (
                      <Button
                        onClick={handleCancelUpload}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Upload Progress */}
                {(uploadStatus.isUploading || uploadStatus.progress > 0) && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {uploadStatus.isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {uploadStatus.message}
                      </span>
                      <Badge variant={uploadStatus.progress === 100 ? "default" : "secondary"}>
                        {uploadStatus.progress}%
                      </Badge>
                    </div>
                    <Progress value={uploadStatus.progress} className="w-full" />
                  </div>
                )}

                {/* Upload Results */}
                {uploadStatus.tenantId && uploadStatus.workbookId && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 mb-3">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Upload Successful!</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-700 dark:text-blue-300">Tenant ID:</span>
                        <div className="font-mono text-xs bg-blue-100 dark:bg-blue-900 p-2 rounded mt-1 break-all">
                          {uploadStatus.tenantId}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700 dark:text-blue-300">Workbook ID:</span>
                        <div className="font-mono text-xs bg-blue-100 dark:bg-blue-900 p-2 rounded mt-1 break-all">
                          {uploadStatus.workbookId}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700 dark:text-blue-300">Cells Processed:</span>
                        <div className="text-2xl font-bold text-blue-800 dark:text-blue-200 mt-1">
                          {uploadStatus.cellCount?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {uploadStatus.message.includes('failed') && (
                  <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Upload Failed</span>
                    </div>
                    <div className="text-red-700 dark:text-red-300 text-sm mt-1">
                      {uploadStatus.message}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search & Chat Tab */}
          <TabsContent value="search" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Search & Chat */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      AI Chat Interface
                    </CardTitle>
                    <CardDescription>
                      Ask questions about your data in natural language
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Quick Search */}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Ask a question about your data..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        disabled={!selectedWorkbook || isSearching}
                      />
                      <Button
                        onClick={handleSearch}
                        disabled={!selectedWorkbook || !searchQuery.trim() || isSearching}
                      >
                        {isSearching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        Search
                      </Button>
                    </div>

                    {!selectedWorkbook && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                          <AlertCircle className="h-4 w-4" />
                          <span>Please select a workbook above to enable search</span>
                        </div>
                      </div>
                    )}

                    {/* Chat Window */}
                    {chatMessages.length > 0 && (
                      <Card className="border-2">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Bot className="h-4 w-4" />
                              Chat History
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setChatMessages([])}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-64" ref={chatScrollRef}>
                            <div className="space-y-4">
                              {chatMessages.map((message) => (
                                <div
                                  key={message.id}
                                  className={`flex items-start gap-3 ${
                                    message.type === 'user' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  {message.type === 'assistant' && (
                                    <div className="flex-shrink-0">
                                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                        <Bot className="h-4 w-4 text-primary-foreground" />
                                      </div>
                                    </div>
                                  )}
                                  <div
                                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                                      message.type === 'user'
                                        ? 'bg-primary text-primary-foreground ml-auto'
                                        : 'bg-muted'
                                    }`}
                                  >
                                    <div className="text-sm">
                                      {message.isLoading ? (
                                        <div className="flex items-center gap-2">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          {message.content}
                                        </div>
                                      ) : (
                                        <>
                                          {message.content}
                                          
                                          {/* Key Insights */}
                                          {message.keyInsights && message.keyInsights.length > 0 && (
                                            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                              <div className="flex items-center gap-2 mb-2">
                                                <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                                <span className="font-medium text-yellow-800 dark:text-yellow-200">Key Insights</span>
                                              </div>
                                              <div className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                                                {message.keyInsights.map((insight, idx) => (
                                                  <div key={idx} className="whitespace-pre-wrap">{insight}</div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          
                                          {/* Generated Table */}
                                          {message.generatedTable && (
                                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                                              <div className="flex items-center gap-2 mb-2">
                                                <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                <span className="font-medium text-blue-800 dark:text-blue-200">Generated Analysis</span>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => {
                                                    navigator.clipboard.writeText(message.generatedTable || '');
                                                    toast({
                                                      title: "Copied",
                                                      description: "Analysis copied to clipboard"
                                                    });
                                                  }}
                                                  className="ml-auto h-6 w-6 p-1"
                                                >
                                                  <Copy className="h-3 w-3" />
                                                </Button>
                                              </div>
                                              <pre className="text-xs text-blue-700 dark:text-blue-300 whitespace-pre-wrap font-mono bg-blue-100 dark:bg-blue-900 p-2 rounded max-h-32 overflow-y-auto">
                                                {message.generatedTable}
                                              </pre>
                                            </div>
                                          )}
                                          
                                          {/* Search Results Summary */}
                                          {message.searchResults && (
                                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                                              <div className="flex items-center gap-2 mb-2">
                                                <Database className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                <span className="font-medium text-green-800 dark:text-green-200">Data Summary</span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-300">
                                                <div>Results: {message.searchResults.structuredData?.length || 0}</div>
                                                <div>Confidence: {message.searchResults.llmResponse?.confidence ? `${(message.searchResults.llmResponse.confidence * 100).toFixed(1)}%` : 'N/A'}</div>
                                                <div>Data Points: {message.searchResults.llmResponse?.dataPoints || 0}</div>
                                                <div>Sources: {message.searchResults.llmResponse?.sources?.length || 0}</div>
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    <div className="text-xs opacity-60 mt-1">
                                      {message.timestamp.toLocaleTimeString()}
                                    </div>
                                  </div>
                                  {message.type === 'user' && (
                                    <div className="flex-shrink-0">
                                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                                        <User className="h-4 w-4" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                          
                          {/* Chat Input */}
                          <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                            <Input
                              placeholder="Continue the conversation..."
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                              disabled={!selectedWorkbook || isSearching}
                            />
                            <Button
                              onClick={handleChatSubmit}
                              disabled={!selectedWorkbook || !chatInput.trim() || isSearching}
                              size="sm"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Results Summary */}
              <div className="space-y-4">
                {searchResults && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Search Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="font-medium">Query:</span>
                          <div className="text-muted-foreground">{searchResults.query}</div>
                        </div>
                        {searchResults.vectorResults && (
                          <div>
                            <span className="font-medium">Results Found:</span>
                            <div className="text-muted-foreground">{searchResults.vectorResults.length}</div>
                          </div>
                        )}
                        {searchResults.llmResponse?.confidence && (
                          <div>
                            <span className="font-medium">Confidence:</span>
                            <div className="text-muted-foreground">
                              {(searchResults.llmResponse.confidence * 100).toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Results Table */}
            {/* Sheet Overview */}
            {sheetWiseData.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sheet className="h-5 w-5" />
                    Sheet Overview
                  </CardTitle>
                  <CardDescription>
                    Analysis of {sheetWiseData.length} sheets in your workbook
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sheetWiseData.map((sheet) => (
                      <div
                        key={sheet.sheetName}
                        className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                          selectedSheet === sheet.sheetName
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        }`}
                        onClick={() => setSelectedSheet(selectedSheet === sheet.sheetName ? null : sheet.sheetName)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium truncate">{sheet.sheetName}</h3>
                          <Eye className={`h-4 w-4 ${selectedSheet === sheet.sheetName ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Grid3X3 className="h-3 w-3" />
                            {sheet.rowCount} × {sheet.columnCount}
                          </div>
                          <div className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {sheet.cellCount} cells
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredTableData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Table className="h-5 w-5" />
                    {selectedSheet ? `${selectedSheet} Data` : 'Data Results'}
                  </CardTitle>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Input
                      placeholder="Filter results..."
                      value={tableSearchTerm}
                      onChange={(e) => setTableSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                    
                    {/* Sheet Filter */}
                    <Select
                      value={selectedSheet || "all"}
                      onValueChange={(value) => setSelectedSheet(value === "all" ? null : value)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="All sheets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sheets</SelectItem>
                        {availableSheets.map(sheet => (
                          <SelectItem key={sheet} value={sheet}>{sheet}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={tableSortBy} onValueChange={setTableSortBy}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanticString">Semantic String</SelectItem>
                        <SelectItem value="sheetName">Sheet Name</SelectItem>
                        <SelectItem value="cellAddress">Cell Address</SelectItem>
                        <SelectItem value="value">Value</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {tableSortOrder === 'asc' ? '↑' : '↓'}
                    </Button>
                    
                    {/* View Mode Toggle */}
                    <div className="flex items-center border rounded-md">
                      <Button
                        variant={sheetViewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setSheetViewMode('table')}
                        className="rounded-r-none"
                      >
                        <Table className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={sheetViewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setSheetViewMode('grid')}
                        className="rounded-l-none"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {sheetViewMode === 'table' ? (
                    <ScrollArea className="h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sheet</TableHead>
                            <TableHead>Cell</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Semantic Context</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sheetFilteredData.slice(0, 100).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{item.sheetName}</TableCell>
                              <TableCell className="font-mono text-sm">{item.cellAddress}</TableCell>
                              <TableCell>{item.value instanceof Date ? item.value.toLocaleDateString() : String(item.value ?? '')}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.semanticString}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    /* Grid View */
                    <ScrollArea className="h-96">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sheetFilteredData.slice(0, 50).map((item, index) => (
                          <Card key={index} className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="text-xs">
                                {item.sheetName}
                              </Badge>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {item.cellAddress}
                              </code>
                            </div>
                            <div className="text-sm font-medium">
                              {item.value instanceof Date ? item.value.toLocaleDateString() : String(item.value ?? '')}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {item.semanticString}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  
                  {sheetFilteredData.length > (sheetViewMode === 'table' ? 100 : 50) && (
                    <div className="text-center text-sm text-muted-foreground mt-4">
                      Showing first {sheetViewMode === 'table' ? 100 : 50} results of {sheetFilteredData.length}
                      {selectedSheet && ` from ${selectedSheet}`}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}