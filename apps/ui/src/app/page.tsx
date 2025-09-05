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
import { Upload, Search, FileText, MessageSquare, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { apiService, UploadResponse, SearchResponse, Workbook } from "./services/api-service";
import { useToast } from "./hooks/use-toast";

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
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [selectedWorkbook, setSelectedWorkbook] = useState<Workbook | null>(null);
  const [isLoadingWorkbooks, setIsLoadingWorkbooks] = useState(false);
  
  // Table state variables
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [tableSortBy, setTableSortBy] = useState('semanticString');
  const [tableSortOrder, setTableSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Computed filtered and sorted table data
  const filteredTableData = useMemo(() => {
    if (!searchResults?.structuredData) return [];
    
    let filtered = searchResults.structuredData;
    
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
      console.log('🔄 Loading workbooks...');
      setIsLoadingWorkbooks(true);
      const response = await apiService.fetchWorkbooks();
      console.log('📡 API response:', response);
      
      if (response.success) {
        setWorkbooks(response.workbooks);
        console.log(`✅ Loaded ${response.workbooks.length} workbooks:`, response.workbooks);
      } else {
        console.error('❌ API returned success: false:', response.error);
        toast({
          title: "Error",
          description: `Failed to load workbooks: ${response.error}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Failed to load workbooks:', error);
      toast({
        title: "Error",
        description: `Failed to load available workbooks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingWorkbooks(false);
      console.log('🔄 Workbook loading completed');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset status
    setUploadStatus({
      fileName: file.name,
      isUploading: true,
      isProcessing: false,
      progress: 0,
      message: "Starting upload..."
    });

    try {
      // Update progress to 10%
      setUploadStatus(prev => ({
        ...prev,
        progress: 10,
        message: "Uploading file..."
      }));

      // Upload file
      const uploadResult = await apiService.uploadExcelFile(file);
      
      if (uploadResult.success) {
        // Update progress to 20%
        setUploadStatus(prev => ({
          ...prev,
          progress: 20,
          message: "File uploaded, processing..."
        }));

        // Update progress to 40%
        setUploadStatus(prev => ({
          ...prev,
          progress: 40,
          message: "Parsing Excel data..."
        }));

        // Update progress to 60%
        setUploadStatus(prev => ({
          ...prev,
          progress: 60,
          message: "Creating embeddings..."
        }));

        // Update progress to 80%
        setUploadStatus(prev => ({
          ...prev,
          progress: 80,
          message: "Storing data..."
        }));

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
                      <Card className="bg-green-50 border-green-200">
                        <CardHeader>
                          <CardTitle className="text-green-800">AI Answer</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-green-900">{searchResults.llmResponse.answer}</p>
                          <div className="flex items-center gap-4 mt-3 text-sm text-green-700">
                            <Badge variant="secondary">
                              Confidence: {Math.round(searchResults.llmResponse.confidence * 100)}%
                            </Badge>
                            <Badge variant="secondary">
                              Data Points: {searchResults.llmResponse.dataPoints}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* LLM Generated Table */}
                    {searchResults.generatedTable && (
                      <Card className="bg-blue-50 border-blue-200">
                        <CardHeader>
                          <CardTitle className="text-blue-800">AI Generated Table</CardTitle>
                          <CardDescription>
                            Dynamic table structure created by AI based on the analysis
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div 
                            className="overflow-x-auto"
                            dangerouslySetInnerHTML={{ __html: searchResults.generatedTable }}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Structured Data Table */}
                    {searchResults.structuredData && searchResults.structuredData.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-4 text-gray-800">
                          Search Results ({searchResults.structuredData.length} items)
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

                                                                {/* Row/Column Table Structure */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Column</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Sheet</TableHead>
                            <TableHead>Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTableData.map((item, index) => {
                            // Extract row and column from semantic string or dimensions
                            const semanticParts = item.semanticString?.split(' | ') || [];
                            const rowInfo = semanticParts[1] || 'N/A';
                            const columnInfo = item.metric || 'N/A';
                            
                            // Handle date values properly - don't convert to numeric
                            let displayValue = item.value;
                            if (item.value !== null && item.value !== undefined) {
                              // If it's a date (Excel date number), convert it back to readable format
                              if (typeof item.value === 'number' && item.value > 1 && item.value < 100000) {
                                // This is likely an Excel date number, convert to readable date
                                const excelDate = new Date((item.value - 25569) * 86400 * 1000);
                                displayValue = excelDate.toLocaleDateString();
                              } else if (typeof item.value === 'string' && item.value.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
                                // Keep date strings as-is
                                displayValue = item.value;
                              } else {
                                // For numeric values, format them
                                displayValue = typeof item.value === 'number' ? 
                                  new Intl.NumberFormat('en-IN').format(item.value) : 
                                  String(item.value);
                              }
                            } else {
                              displayValue = 'N/A';
                            }

                            return (
                              <TableRow key={item._id || index}>
                                <TableCell>
                                  <div className="font-medium text-sm">
                                    {rowInfo}
                                  </div>
                                </TableCell>
                                
                                <TableCell>
                                  <div className="font-medium text-sm">
                                    {columnInfo}
                                  </div>
                                </TableCell>
                                
                                <TableCell>
                                  <div className={`text-lg font-bold ${
                                    typeof item.value === 'number' ? 'text-green-600' : 
                                    (typeof item.value === 'string' && item.value.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) ? 'text-blue-600' :
                                    'text-gray-600'
                                  }`}>
                                    {displayValue}
                                  </div>
                                  {/* Show time context if available */}
                                  {(item.year || item.month || item.quarter) && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {item.year && <span className="mr-2">📅 {item.year}</span>}
                                      {item.month && <span className="mr-2">📆 {item.month}</span>}
                                      {item.quarter && <span>🗓️ {item.quarter}</span>}
                                    </div>
                                  )}
                                </TableCell>
                                
                                <TableCell>
                                  <div className="text-sm">
                                    📄 {item.sheetName || item.sheetId?.slice(-8) || 'N/A'}
                                    </div>
                                </TableCell>
                                
                                <TableCell>
                                  <div className="text-sm font-mono">
                                    {item.score?.toFixed(3) || 'N/A'}
                                </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                              </div>

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

