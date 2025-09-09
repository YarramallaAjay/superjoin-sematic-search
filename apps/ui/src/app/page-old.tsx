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
  Settings
} from "lucide-react";
import { apiService, UploadResponse, SearchResponse, Workbook } from "./services/api-service";
import { useToast } from "./hooks/use-toast";
import { ThemeToggle } from "./components/theme-toggle";

interface UploadStatus {
  fileName?: string;
  isUploading: boolean;
  isProcessing: boolean;
  progress: number;
  message: string;
  tenantId?: string;
  workbookId?: string;
  cellCount?: number;
  timestamp?: string;
}

export default function Home() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    isUploading: false,
    isProcessing: false,
    progress: 0,
    message: "Ready to upload"
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  
  // Simple loading state management
  const [selectedWorkbook, setSelectedWorkbook] = useState<Workbook | null>(null);
  const [isLoadingWorkbooks, setIsLoadingWorkbooks] = useState(false);
  
  // Effect to manage loading state when search results are received
  useEffect(() => {
    if (searchResults?.llmResponse) {
      setIsLoadingResponse(false);
    }
  }, [searchResults?.llmResponse]);
  
  // Table state variables
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [tableSortBy, setTableSortBy] = useState('semanticString');
  const [tableSortOrder, setTableSortOrder] = useState<'asc' | 'desc'>('asc');
  
  
  // Computed filtered and sorted table data (excluding AI-generated data)
  const filteredTableData = useMemo(() => {
    if (!searchResults?.structuredData) return [];
    
    // Filter out AI-generated data for the main table
    let filtered = searchResults.structuredData.filter(item => item.sheetName !== "AI Analysis Results");
    
    // Apply search filter
    if (tableSearchTerm) {
      const searchLower = tableSearchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        Object.values(item).some(value => 
          value && value.toString().toLowerCase().includes(searchLower)
        )
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[tableSortBy as keyof typeof a];
      let bValue = b[tableSortBy as keyof typeof b];
      
      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';
      
      // Convert to strings for comparison
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, toasts, dismiss } = useToast();

  // Load workbooks on component mount
  useEffect(() => {
    loadWorkbooks();
  }, []);

  const loadWorkbooks = async () => {
    try {
      setIsLoadingWorkbooks(true);
      const response = await apiService.fetchWorkbooks();
      
      if (response.success) {
        setWorkbooks(response.workbooks);
      } else {
        toast({
          title: "Error",
          description: `Failed to load workbooks: ${response.error}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to load available workbooks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingWorkbooks(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset status and start progress simulation
    setUploadStatus({
      fileName: file.name,
      isUploading: true,
      isProcessing: false,
      progress: 0,
      message: "Starting upload..."
    });

    // Simulate realistic progress updates
    const progressUpdates = [
      { progress: 5, message: "Validating file...", delay: 200 },
      { progress: 15, message: "Uploading file to server...", delay: 800 },
      { progress: 35, message: "Processing Excel data...", delay: 1500 },
      { progress: 55, message: "Extracting cell data...", delay: 2000 },
      { progress: 75, message: "Generating embeddings...", delay: 3000 },
      { progress: 90, message: "Storing in database...", delay: 1000 },
    ];

    // Start progress simulation
    const updateProgress = async () => {
      for (const update of progressUpdates) {
        await new Promise(resolve => setTimeout(resolve, update.delay));
        setUploadStatus(prev => ({
          ...prev,
          progress: update.progress,
          message: update.message
        }));
      }
    };

    // Start progress updates in parallel with actual upload
    updateProgress();

    try {
      // Perform the actual upload
      const uploadResult = await apiService.uploadExcelFile(file);
      
      if (uploadResult.success) {
        // Final progress update
        setUploadStatus(prev => ({
          ...prev,
          progress: 100,
          message: "Upload completed successfully!",
          isUploading: false,
          isProcessing: false,
          tenantId: uploadResult.tenantId,
          workbookId: uploadResult.workbookId,
          cellCount: uploadResult.cellCount
        }));

        // Reload workbooks to include the new one
        await loadWorkbooks();

        toast({
          title: "Success",
          description: `File uploaded successfully! Processed ${uploadResult.cellCount} cells.`,
        });

        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Reset progress after 3 seconds
        setTimeout(() => {
          setUploadStatus(prev => ({
            ...prev,
            progress: 0,
            message: "Ready to upload"
          }));
        }, 3000);
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(prev => ({
        ...prev,
        isUploading: false,
        isProcessing: false,
        progress: 0,
        message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));

      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    }
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
      setIsLoadingResponse(true);
      const results = await apiService.searchWithWorkbook(
        searchQuery,
        selectedWorkbook.id,
        selectedWorkbook.tenantId
      );
      
      setSearchResults(results);
      
      if (results.success) {
        toast({
          title: "Search Complete",
          description: `Found ${results.structuredData?.length || 0} results`,
        });
      } else {
        toast({
          title: "Search Failed",
          description: results.error || 'Search failed',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleWorkbookSelect = (workbookId: string) => {
    const workbook = workbooks.find(wb => wb.id === workbookId);
    setSelectedWorkbook(workbook || null);
    
    if (workbook) {
      toast({
        title: "Workbook Selected",
        description: `Selected: ${workbook.name} (${workbook.tenantName})`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
              toast.variant === 'destructive' 
                ? 'bg-red-500 text-white' 
                : 'bg-green-500 text-white'
            }`}
          >
            <div className="font-semibold">{toast.title}</div>
            <div className="text-sm opacity-90">{toast.description}</div>
            <button
              onClick={() => dismiss(toast.id)}
              className="absolute top-2 right-2 text-white opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">SuperJoin Semantic Search</h1>
          <p className="text-gray-600">Upload Excel files and search with AI-powered semantic understanding</p>
        </div>

        {/* Global Workbook Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Select Workbook
            </CardTitle>
            <CardDescription>
              Choose a workbook to search in. Upload a new file to create a new workbook.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select
                value={selectedWorkbook?.id || ""}
                onValueChange={handleWorkbookSelect}
                disabled={isLoadingWorkbooks}
              >
                <SelectTrigger className="w-80">
                  <SelectValue placeholder={
                    isLoadingWorkbooks ? "Loading workbooks..." : "Select a workbook"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {workbooks.map((workbook) => (
                    <SelectItem key={workbook.id} value={workbook.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{workbook.name}</span>
                        <span className="text-sm text-gray-500">
                          Tenant: {workbook.tenantName}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                onClick={loadWorkbooks}
                variant="outline"
                size="sm"
                disabled={isLoadingWorkbooks}
              >
                {isLoadingWorkbooks ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
            
            {selectedWorkbook && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Selected:</span>
                  <span>{selectedWorkbook.name}</span>
                  <span className="text-sm">({selectedWorkbook.tenantName})</span>
                </div>
                <div className="text-sm text-green-600 mt-1">
                  Workbook ID: {selectedWorkbook.id.slice(-8)} | 
                  Tenant ID: {selectedWorkbook.tenantId.slice(-8)}
                </div>
              </div>
            )}

            {!isLoadingWorkbooks && workbooks.length === 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">No workbooks available</span>
                </div>
                <div className="text-sm text-yellow-600 mt-1">
                  Upload an Excel file to create your first workbook, or check if the database connection is working.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload & Process</TabsTrigger>
            <TabsTrigger value="search">Search & Chat</TabsTrigger>
          </TabsList>

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
                    disabled={uploadStatus.isUploading || uploadStatus.isProcessing}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadStatus.isUploading || uploadStatus.isProcessing}
                  >
                    Choose File
                  </Button>
                </div>

                {/* Upload Progress */}
                {uploadStatus.isUploading || uploadStatus.isProcessing ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>{uploadStatus.message}</span>
                      <span>{uploadStatus.progress}%</span>
                    </div>
                    <Progress value={uploadStatus.progress} className="w-full" />
                  </div>
                ) : null}

                {/* Upload Results */}
                {uploadStatus.tenantId && uploadStatus.workbookId && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center gap-2 text-blue-800 mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Upload Successful!</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Tenant ID:</span>
                        <div className="font-mono text-xs bg-blue-100 p-1 rounded mt-1">
                          {uploadStatus.tenantId}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Workbook ID:</span>
                        <div className="font-mono text-xs bg-blue-100 p-1 rounded mt-1">
                          {uploadStatus.workbookId}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium">Cells Processed:</span>
                        <div className="text-lg font-bold text-blue-600">
                          {uploadStatus.cellCount}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {uploadStatus.message.includes('failed') && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{uploadStatus.message}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Semantic Search
                </CardTitle>
                <CardDescription>
                  Search your uploaded data using natural language queries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
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
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertCircle className="h-4 w-4" />
                      <span>Please select a workbook above to enable search</span>
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {searchResults && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      <h3 className="text-lg font-semibold">Search Results</h3>
                    </div>

                    {searchResults.llmResponse && (
                      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-green-800 flex items-center gap-2">
                                <span className="text-2xl">🤖</span>
                                AI Analysis & Response
                                {isLoadingResponse && <Loader2 className="h-4 w-4 animate-spin text-green-600" />}
                              </CardTitle>
                              <CardDescription>
                                {isLoadingResponse ? "AI is analyzing and generating response..." : "Complete AI analysis including answer, reasoning, and key insights"}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {/* Main Answer */}
                          <div className="bg-white p-4 rounded-lg border border-green-100">
                            <h4 className="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
                              <span className="text-xl">💡</span>
                              Answer
                            </h4>
                            <div className="text-green-900 whitespace-pre-wrap leading-relaxed">
                              {searchResults.llmResponse.answer}
                            </div>
                          </div>

                          {/* Reasoning */}
                          {searchResults.llmResponse.reasoning && (
                            <div className="bg-white p-4 rounded-lg border border-blue-100">
                              <h4 className="text-lg font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                <span className="text-xl">🧠</span>
                                Reasoning
                              </h4>
                              <div className="text-blue-900 whitespace-pre-wrap leading-relaxed">
                                {searchResults.llmResponse.reasoning}
                              </div>
                            </div>
                          )}

                          {/* Key Insights */}
                          {searchResults.llmResponse.keyInsights && (
                            <div className="bg-white p-4 rounded-lg border border-purple-100">
                              <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                                <span className="text-xl">🔍</span>
                                Key Insights
                              </h4>
                              <div className="text-purple-900 whitespace-pre-wrap leading-relaxed">
                                {searchResults.llmResponse.keyInsights}
                              </div>
                            </div>
                          )}

                          {/* Sources */}
                          {searchResults.llmResponse.sources && searchResults.llmResponse.sources.length > 0 && (
                            <div className="bg-white p-4 rounded-lg border border-orange-100">
                              <h4 className="text-lg font-semibold text-orange-800 mb-3 flex items-center gap-2">
                                <span className="text-xl">📚</span>
                                Sources
                              </h4>
                              <div className="space-y-2">
                                {searchResults.llmResponse.sources.map((source, index) => (
                                  <div key={index} className="text-orange-900 whitespace-pre-wrap leading-relaxed p-3 bg-orange-50 rounded-lg border border-orange-100">
                                    {source}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="bg-white p-4 rounded-lg border border-gray-100">
                            <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                              <span className="text-xl">📊</span>
                              Analysis Metadata
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">
                                  {Math.round(searchResults.llmResponse.confidence * 100)}%
                                </div>
                                <div className="text-sm text-gray-600">Confidence</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                  {searchResults.llmResponse.dataPoints}
                                </div>
                                <div className="text-sm text-gray-600">Data Points</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">
                                  {searchResults.llmResponse.sources?.length || 0}
                                </div>
                                <div className="text-sm text-gray-600">Sources</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-orange-600">
                                  {searchResults.llmResponse.answer.length}
                                </div>
                                <div className="text-sm text-gray-600">Characters</div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* AI Analysis Results */}
                    {searchResults.structuredData && searchResults.structuredData.some(item => item.sheetName === "AI Analysis Results") && (
                      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                        <CardHeader>
                          <CardTitle className="text-purple-800 flex items-center gap-2">
                            <span className="text-2xl">🤖</span>
                            AI Analysis Results
                          </CardTitle>
                          <CardDescription>
                            Structured analysis results generated by AI including calculations, comparisons, and insights
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {(() => {
                            // Filter AI-generated data
                            const aiData = searchResults.structuredData.filter(item => item.sheetName === "AI Analysis Results");
                            
                            
                            if (aiData.length === 0) {
                              
                              // Create fallback categories from LLM response
                              const fallbackCategories = [];
                              
                              if (searchResults.llmResponse?.answer) {
                                fallbackCategories.push({
                                  _id: "fallback_answer",
                                  metric: "AI Answer",
                                  rowName: "Response",
                                  colName: "Content",
                                  value: searchResults.llmResponse.answer.substring(0, 200) + "...",
                                  dataType: "string"
                                });
                              }
                              
                              if (searchResults.llmResponse?.reasoning) {
                                fallbackCategories.push({
                                  _id: "fallback_reasoning",
                                  metric: "AI Reasoning",
                                  rowName: "Analysis",
                                  colName: "Process",
                                  value: searchResults.llmResponse.reasoning.substring(0, 200) + "...",
                                  dataType: "string"
                                });
                              }
                              
                              if (searchResults.llmResponse?.sources && searchResults.llmResponse.sources.length > 0) {
                                searchResults.llmResponse.sources.forEach((source, index) => {
                                  fallbackCategories.push({
                                    _id: `fallback_insight_${index}`,
                                    metric: "Key Insights",
                                    rowName: `Insight ${index + 1}`,
                                    colName: "Finding",
                                    value: source.substring(0, 150) + "...",
                                    dataType: "string"
                                  });
                                });
                              }
                              
                              if (fallbackCategories.length > 0) {
                                // Use fallback categories
                                const fallbackGroups = new Map<string, any[]>();
                                fallbackCategories.forEach(item => {
                                  if (!fallbackGroups.has(item.metric)) {
                                    fallbackGroups.set(item.metric, []);
                                  }
                                  fallbackGroups.get(item.metric)!.push(item);
                                });
                                
                                return (
                                  <div className="space-y-6">
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                      <div className="flex items-center gap-2 text-yellow-800">
                                        <span className="text-xl">⚠️</span>
                                        <span className="font-medium">Fallback Analysis</span>
                          </div>
                                      <div className="text-sm text-yellow-700 mt-1">
                                        AI didn't generate structured data, showing analysis from text response
                                      </div>
                                    </div>
                                    
                                    {Array.from(fallbackGroups.entries()).map(([groupName, items]) => (
                                      <div key={groupName} className="bg-white p-4 rounded-lg border border-purple-100">
                                        <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                                          <span className="text-xl">📊</span>
                                          {groupName}
                                        </h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                          {items.map((item, index) => (
                                            <div key={item._id || index} className="bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                                              <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-purple-700">
                                                  {item.rowName || "Analysis Point"}
                                                </span>
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                  {item.dataType}
                                                </span>
                                              </div>
                                              
                                              <div className="text-sm text-purple-800 mb-1">
                                                {String(item.value)}
                                              </div>
                                              
                                              <div className="text-xs text-purple-600">
                                                {item.colName || "Value"}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              
                              return (
                                <div className="text-center py-8 text-gray-500">
                                  <div className="text-4xl mb-4">🤖</div>
                                  <div className="text-lg font-medium mb-2">No AI Analysis Data</div>
                                  <div className="text-sm">The AI didn't generate structured analysis data. Check the console for debugging information.</div>
                                </div>
                              );
                            }
                            
                            // Improved grouping logic - group by analysis type with better categorization
                            const analysisGroups = new Map<string, any[]>();
                            
                            aiData.forEach((item) => {
                              // Create more meaningful group keys based on the data
                              let groupKey = "General Analysis";
                              
                              if (item.metric) {
                                // Use metric as primary grouping
                                groupKey = item.metric;
                              } else if ((item as any).rowName && (item as any).colName) {
                                // Create group from row and column names
                                groupKey = `${(item as any).rowName} Analysis`;
                              } else if ((item as any).rowName) {
                                groupKey = `${(item as any).rowName} Analysis`;
                              } else if ((item as any).colName) {
                                groupKey = `${(item as any).colName} Analysis`;
                              }
                              
                              // Categorize by data type for better organization
                              if ((item as any).dataType === 'number' && typeof item.value === 'number') {
                                if (item.value > 1000000) {
                                  groupKey = "Financial Metrics";
                                } else if (item.value < 1 && item.value > 0) {
                                  groupKey = "Ratios & Percentages";
                                } else {
                                  groupKey = "Numerical Analysis";
                                }
                              } else if ((item as any).dataType === 'percent') {
                                groupKey = "Percentage Analysis";
                              } else if ((item as any).dataType === 'date') {
                                groupKey = "Time-based Analysis";
                              } else if ((item as any).dataType === 'string') {
                                groupKey = "Text Analysis";
                              }
                              
                              if (!analysisGroups.has(groupKey)) {
                                analysisGroups.set(groupKey, []);
                              }
                              analysisGroups.get(groupKey)!.push(item);
                            });
                            
                            
                            return (
                              <div className="space-y-6">
                                {Array.from(analysisGroups.entries()).map(([groupName, items]) => (
                                  <div key={groupName} className="bg-white p-4 rounded-lg border border-purple-100">
                                    <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                                      <span className="text-xl">📊</span>
                                      {groupName}
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                      {items.map((item, index) => (
                                        <div key={item._id || index} className="bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-purple-700">
                                              {(item as any).rowName || "Analysis Point"}
                                            </span>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                              (item as any).dataType === 'number' ? 'bg-green-100 text-green-700' :
                                              (item as any).dataType === 'percent' ? 'bg-purple-100 text-purple-700' :
                                              (item as any).dataType === 'date' ? 'bg-blue-100 text-blue-700' :
                                              'bg-gray-100 text-gray-700'
                                            }`}>
                                              {(item as any).dataType}
                                            </span>
                                          </div>
                                          
                                          <div className="text-2xl font-bold text-purple-800 mb-1">
                                            {(item as any).dataType === 'percent' && typeof item.value === 'number' ? 
                                              `${(item.value * 100).toFixed(2)}%` :
                                              typeof item.value === 'number' ? 
                                                new Intl.NumberFormat('en-IN').format(item.value) :
                                                String(item.value)
                                            }
                                          </div>
                                          
                                          <div className="text-sm text-purple-600">
                                            {(item as any).colName || "Value"}
                                          </div>
                                          
                                          {item.unit && item.unit !== 'N/A' && (
                                            <div className="text-xs text-purple-500 mt-1">
                                              Unit: {item.unit}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    )}

                    

                    {/* Original Search Results Table */}
                    {searchResults.structuredData && searchResults.structuredData.filter(item => item.sheetName !== "AI Analysis Results").length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800">
                          Original Search Results ({searchResults.structuredData.filter(item => item.sheetName !== "AI Analysis Results").length} items)
                        </h3>
                        
                        {/* Search and Filter Controls */}
                        <div className="mb-4 flex flex-wrap gap-4 items-center">
                          <div className="flex-1 min-w-64">
                            <input
                              type="text"
                              placeholder="Search in results..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={tableSearchTerm}
                              onChange={(e) => setTableSearchTerm(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2">
                                                         <select
                               value={tableSortBy}
                               onChange={(e) => setTableSortBy(e.target.value)}
                               className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                             >
                               <option value="semanticString">Sort by Row</option>
                               <option value="metric">Sort by Column</option>
                               <option value="value">Sort by Value</option>
                               <option value="sheetName">Sort by Sheet</option>
                               <option value="score">Sort by Score</option>
                             </select>
                            <button
                              onClick={() => setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc')}
                              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {tableSortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                          </div>
                        </div>

                                                 {/* Summary Statistics */}
                         <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                           <div className="bg-blue-50 p-3 rounded-lg">
                             <div className="text-sm text-blue-600 font-medium">Total Results</div>
                             <div className="text-2xl font-bold text-blue-800">{filteredTableData.length}</div>
                           </div>
                           <div className="bg-green-50 p-3 rounded-lg">
                             <div className="text-sm text-green-600 font-medium">Unique Sheets</div>
                             <div className="text-2xl font-bold text-green-800">
                               {Array.from(new Set(filteredTableData.map(item => item.sheetName || item.sheetId))).length}
                             </div>
                           </div>
                           <div className="bg-purple-50 p-3 rounded-lg">
                             <div className="text-sm text-purple-600 font-medium">Unique Columns</div>
                             <div className="text-2xl font-bold text-purple-800">
                               {Array.from(new Set(filteredTableData.map(item => item.metric))).length}
                             </div>
                           </div>
                           <div className="bg-orange-50 p-3 rounded-lg">
                             <div className="text-sm text-orange-600 font-medium">Data Types</div>
                             <div className="text-2xl font-bold text-orange-800">
                               {Array.from(new Set(filteredTableData.map(item => 
                                 typeof item.value === 'number' ? 'Number' : 
                                 (typeof item.value === 'string' && item.value.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) ? 'Date' : 
                                 'Text'
                               ))).length}
                             </div>
                           </div>
                         </div>

                        {/* Sheet-based Tabbed Interface */}
                        {(() => {
                          // Group data by sheet
                          const sheetData = new Map<string, any[]>();
                          
                          filteredTableData.forEach((item) => {
                            const sheetName = item.sheetName || 'Unknown Sheet';
                            if (!sheetData.has(sheetName)) {
                              sheetData.set(sheetName, []);
                            }
                            sheetData.get(sheetName)!.push(item);
                          });
                          
                          const sheetNames = Array.from(sheetData.keys()).sort();
                          
                          if (sheetNames.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                No data available to display
                              </div>
                            );
                          }
                          
                          return (
                            <Tabs defaultValue={sheetNames[0]} className="w-full">
                              <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                                {sheetNames.map((sheetName) => (
                                  <TabsTrigger 
                                    key={sheetName} 
                                    value={sheetName}
                                    className="text-xs truncate"
                                  >
                                    {sheetName}
                                  </TabsTrigger>
                                ))}
                              </TabsList>
                              
                              {sheetNames.map((sheetName) => {
                                const sheetItems = sheetData.get(sheetName) || [];
                                
                                // Create pivot table for this sheet
                                const pivotData = new Map<string, Map<string, any>>();
                                const allRows = new Set<string>();
                                const allColumns = new Set<string>();
                                
                                sheetItems.forEach((item) => {
                                  const rowName = item.rowName || 'Unknown Row';
                                  const colName = item.colName || item.metric || 'Unknown Column';
                                  
                                  allRows.add(rowName);
                                  allColumns.add(colName);
                                  
                                  if (!pivotData.has(rowName)) {
                                    pivotData.set(rowName, new Map());
                                  }
                                  
                                  // Handle values properly based on data type
                            let displayValue = item.value;
                            if (item.value !== null && item.value !== undefined) {
                                    if (item.dataType === 'date') {
                                      // Only format as date if explicitly marked as date type
                                      if (typeof item.value === 'string' && item.value.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
                                displayValue = item.value;
                              } else {
                                        displayValue = String(item.value);
                                      }
                                    } else if (item.dataType === 'percent') {
                                      // Format percentage values
                                      displayValue = typeof item.value === 'number' ? 
                                        `${(item.value * 100).toFixed(2)}%` : 
                                        String(item.value);
                                    } else if (item.dataType === 'number') {
                                      // Format numeric values
                                displayValue = typeof item.value === 'number' ? 
                                  new Intl.NumberFormat('en-IN').format(item.value) : 
                                  String(item.value);
                                    } else {
                                      // String values
                                      displayValue = String(item.value);
                              }
                            } else {
                              displayValue = 'N/A';
                            }
                                  
                                  pivotData.get(rowName)!.set(colName, {
                                    value: displayValue,
                                    originalValue: item.value,
                                    sheetName: item.sheetName,
                                    score: item.score,
                                    year: item.year,
                                    month: item.month,
                                    quarter: item.quarter,
                                    dataType: item.dataType
                                  });
                                });
                                
                                const sortedRows = Array.from(allRows).sort();
                                const sortedColumns = Array.from(allColumns).sort();

                            return (
                                  <TabsContent key={sheetName} value={sheetName} className="mt-4">
                                    <div className="space-y-4">
                                      {/* Sheet Header */}
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <h4 className="text-lg font-semibold text-gray-800">
                                            📄 {sheetName}
                                          </h4>
                                          <p className="text-sm text-gray-600">
                                            {sheetItems.length} data points • {sortedRows.length} rows • {sortedColumns.length} columns
                                          </p>
                                  </div>
                                        <div className="flex gap-2">
                                          <Badge variant="outline">
                                            {sortedRows.length} Rows
                                          </Badge>
                                          <Badge variant="outline">
                                            {sortedColumns.length} Columns
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      {/* Sheet Table */}
                                      <div className="rounded-md border overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="sticky left-0 bg-white border-r font-bold min-w-32">
                                                Row Names
                                              </TableHead>
                                              {sortedColumns.map((colName) => (
                                                <TableHead key={colName} className="min-w-32 text-center font-bold">
                                                  {colName}
                                                </TableHead>
                                              ))}
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {sortedRows.map((rowName) => (
                                              <TableRow key={rowName}>
                                                <TableCell className="sticky left-0 bg-gray-50 border-r font-medium">
                                                  <div className="font-semibold text-sm">
                                                    {rowName}
                                  </div>
                                </TableCell>
                                                {sortedColumns.map((colName) => {
                                                  const cellData = pivotData.get(rowName)?.get(colName);
                                                  
                                                  if (!cellData) {
                                                    return (
                                                      <TableCell key={colName} className="text-center">
                                                        <div className="text-gray-400 text-sm">-</div>
                                                      </TableCell>
                                                    );
                                                  }
                                                  
                                                  return (
                                                    <TableCell key={colName} className="text-center">
                                                      <div className={`text-sm font-medium ${
                                                        cellData.dataType === 'number' ? 'text-green-600' : 
                                                        cellData.dataType === 'percent' ? 'text-purple-600' :
                                                        cellData.dataType === 'date' ? 'text-blue-600' :
                                    'text-gray-600'
                                  }`}>
                                                        {cellData.value}
                                  </div>
                                                      
                                  {/* Show time context if available */}
                                                      {(cellData.year || cellData.month || cellData.quarter) && (
                                    <div className="text-xs text-gray-500 mt-1">
                                                          {cellData.year && <span className="mr-1">📅{cellData.year}</span>}
                                                          {cellData.month && <span className="mr-1">📆{cellData.month}</span>}
                                                          {cellData.quarter && <span>🗓️{cellData.quarter}</span>}
                                    </div>
                                  )}
                                                      
                                                      {/* Show score if available */}
                                                      {cellData.score && (
                                                        <div className="text-xs text-gray-400 mt-1 font-mono">
                                                          {cellData.score.toFixed(3)}
                                    </div>
                                                      )}
                                </TableCell>
                            );
                          })}
                                              </TableRow>
                                            ))}
                        </TableBody>
                      </Table>
                              </div>
                                    </div>
                                  </TabsContent>
                                );
                              })}
                            </Tabs>
                          );
                        })()}

                        {/* Pagination Info */}
                        <div className="mt-4 text-sm text-gray-500 text-center">
                          Showing {filteredTableData.length} of {searchResults.structuredData.length} results
                              </div>
                          </div>
                    )}

                    {searchResults.error && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>Search error: {searchResults.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

