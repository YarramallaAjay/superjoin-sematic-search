"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Database, Brain, TrendingUp, Users, Settings, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { ChatInterface } from "@/components/chat-interface";
import { Progress } from "@/components/ui/progress";
import { apiService } from "@/lib/api-service";

interface SearchResult {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetId: string;
  semanticString: string;
  metric: string;
  normalizedMetric: string;
  value: number | string;
  year?: number;
  quarter?: string;
  month?: string;
  region?: string;
  product?: string;
  customerId?: string;
  customerName?: string;
  department?: string;
  status?: string;
  priority?: string;
  score: number;
}

interface LLMResponse {
  answer: string;
  confidence: number;
  reasoning: string;
  dataPoints: number;
  sources: string[];
}

interface UploadStatus {
  isUploading: boolean;
  isProcessing: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  message: string;
  fileName?: string;
  tenantId?: string;
  workbookId?: string;
  cellCount?: number;
  timestamp?: string;
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [tenantId, setTenantId] = useState("tenant_test_enhanced");
  const [workbookId, setWorkbookId] = useState("Company Financial Model MultiYear");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [llmResponse, setLlmResponse] = useState<LLMResponse | null>(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    isUploading: false,
    isProcessing: false,
    progress: 0,
    status: 'idle',
    message: 'Ready to upload Excel files',
    fileName: '',
    tenantId: '',
    workbookId: '',
    cellCount: 0
  });
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSearch = async (searchQuery?: string) => {
    const queryToSearch = searchQuery || query;
    if (!queryToSearch.trim()) return { llmResponse: undefined };
    
    setIsSearching(true);
    try {
      const data = await apiService.performSearch({ 
        query: queryToSearch, 
        tenantId, 
        workbookId 
      });
      
      setSearchResults(data.structuredData || []);
      setLlmResponse(data.llmResponse || null);
      setActiveTab("results");
      
      // Show success toast
      showToast("Search completed", `Found ${data.structuredData?.length || 0} results`, "success");
      
      return data;
    } catch {
      showToast("Search failed", "Please try again", "error");
      return { llmResponse: undefined };
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchClick = () => {
    handleSearch();
  };

  const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    // Simple toast implementation - you can replace this with a proper toast library
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    toast.innerHTML = `
      <div class="font-semibold">${title}</div>
      <div class="text-sm opacity-90">${message}</div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const timestamp = new Date().toISOString();
    setUploadStatus({
      isUploading: true,
      isProcessing: false,
      status: 'uploading',
      progress: 0,
      message: 'Starting upload...',
      fileName: file.name,
      timestamp,
      tenantId: '',
      workbookId: '',
      cellCount: 0
    });

    try {
      // Step 1: File Upload (10% of progress)
      setUploadStatus(prev => ({ ...prev, progress: 10, message: 'Uploading file...' }));
      
      const uploadResult = await apiService.uploadExcelFile(file);
      
      if (uploadResult.success) {
        // Step 2: File Processing (20% of progress)
        setUploadStatus(prev => ({ 
          ...prev, 
          progress: 20, 
          message: 'Processing Excel file...',
          tenantId: uploadResult.tenantId || '',
          workbookId: uploadResult.workbookId || '',
          cellCount: uploadResult.cellCount || 0
        }));

        // Step 3: Parsing and Embeddings (40% of progress)
        setUploadStatus(prev => ({ 
          ...prev, 
          progress: 40, 
          message: 'Generating embeddings...',
          isProcessing: true
        }));

        // Step 4: Database Storage (60% of progress)
        setUploadStatus(prev => ({ 
          ...prev, 
          progress: 60, 
          message: 'Storing data in database...'
        }));

        // Step 5: Final Processing (80% of progress)
        setUploadStatus(prev => ({ 
          ...prev, 
          progress: 80, 
          message: 'Finalizing...'
        }));

        // Step 6: Complete (100% of progress)
        setUploadStatus(prev => ({ 
          ...prev, 
          progress: 100, 
          message: 'Upload completed successfully!',
          status: 'completed',
          isUploading: false,
          isProcessing: false
        }));

        // Show success toast
        showToast("Upload Successful!", `File processed: ${uploadResult.cellCount} cells parsed and stored.`, "success");

        // Auto-switch to Search tab after successful upload
        setTimeout(() => {
          setActiveTab('search');
        }, 2000);

      } else {
        // Handle upload failure
        setUploadStatus(prev => ({ 
          ...prev, 
          progress: 0, 
          message: 'Upload failed',
          status: 'error',
          isUploading: false,
          isProcessing: false
        }));

        showToast("Upload Failed", uploadResult.message || 'An error occurred during upload.', "error");
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(prev => ({ 
        ...prev, 
        progress: 0, 
        message: 'Upload failed',
        status: 'error',
        isUploading: false,
        isProcessing: false
      }));

      showToast("Upload Error", error instanceof Error ? error.message : 'An unexpected error occurred.', "error");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const getStatusIcon = () => {
    switch (uploadStatus.status) {
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />;
      case 'processing':
      case 'uploading':
        return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />;
      default:
        return <FileSpreadsheet className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus.status) {
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'processing':
      case 'uploading':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Semantic Search Dashboard</h1>
              <p className="text-sm text-gray-600">AI-powered financial data analysis</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Connected
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                try {
                  const result = await apiService.testLLMConnection();
                  showToast(
                    "LLM Test Results", 
                    `Google: ${result.google ? '✅' : '❌'}, DeepSeek: ${result.deepseek ? '✅' : '❌'}, OpenAI: ${result.openai ? '✅' : '❌'}`,
                    result.google || result.deepseek || result.openai ? 'success' : 'error'
                  );
                } catch (error) {
                  showToast("LLM Test Failed", "Could not test LLM connections", "error");
                }
              }}
            >
              <Brain className="h-4 w-4 mr-2" />
              Test LLM
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>Chat</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Search</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span>Results</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <div className="grid gap-6">
              {/* Upload Area */}
              <Card className={`border-2 border-dashed transition-all duration-200 ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50 scale-105' 
                  : 'border-gray-300 hover:border-blue-400'
              }`}>
                <CardContent className="p-8">
                  <div
                    className="text-center"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col items-center space-y-4">
                      {getStatusIcon()}
                      
                      <div className="space-y-2">
                        <h3 className={`text-lg font-semibold ${getStatusColor()}`}>
                          {uploadStatus.message}
                        </h3>
                        {uploadStatus.fileName && (
                          <p className="text-sm text-gray-600">
                            File: {uploadStatus.fileName}
                          </p>
                        )}
                      </div>

                      {uploadStatus.status === 'idle' && (
                        <>
                                                      <p className="text-gray-500 max-w-md">
                              Drag and drop your Excel files here, or click to browse. 
                              We&apos;ll process the data and generate semantic embeddings for intelligent search.
                            </p>
                          
                          <div className="flex space-x-4">
                            <Button
                              onClick={() => document.getElementById('file-upload')?.click()}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Choose File
                            </Button>
                            <Button variant="outline">
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              View Sample
                            </Button>
                          </div>
                          
                          <input
                            id="file-upload"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileInput}
                            className="hidden"
                          />
                        </>
                      )}

                      {/* Progress Bar */}
                      {(uploadStatus.status === 'uploading' || uploadStatus.status === 'processing') && (
                        <div className="w-full max-w-md space-y-2">
                          <Progress value={uploadStatus.progress} className="w-full" />
                          <p className="text-sm text-gray-600">
                            {uploadStatus.status === 'uploading' ? 'Uploading...' : 'Processing...'} {uploadStatus.progress}%
                          </p>
                        </div>
                      )}

                      {/* Success Actions */}
                      {uploadStatus.status === 'completed' && (
                        <div className="space-y-4">
                          {/* Display Upload Results */}
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                            <h4 className="font-medium text-green-800">Upload Complete! 🎉</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-green-700">Tenant ID:</span>
                                <div className="font-mono text-xs bg-white px-2 py-1 rounded border mt-1">
                                  {uploadStatus.tenantId || 'N/A'}
                                </div>
                              </div>
                              <div>
                                <span className="font-medium text-green-700">Workbook ID:</span>
                                <div className="font-mono text-xs bg-white px-2 py-1 rounded border mt-1">
                                  {uploadStatus.workbookId || 'N/A'}
                                </div>
                              </div>
                            </div>
                            {uploadStatus.cellCount && (
                              <div className="text-sm text-green-700">
                                <span className="font-medium">Cells Processed:</span> {uploadStatus.cellCount}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex space-x-3">
                            <Button
                              onClick={() => setActiveTab("chat")}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Brain className="h-4 w-4 mr-2" />
                              Start Chatting
                            </Button>
                            <Button
                              onClick={() => setActiveTab("search")}
                              variant="outline"
                            >
                              <Search className="h-4 w-4 mr-2" />
                              Try Search
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Error Actions */}
                      {uploadStatus.status === 'error' && (
                        <Button
                          onClick={() => setUploadStatus({
                            isUploading: false,
                            isProcessing: false,
                            progress: 0,
                            status: 'idle',
                            message: 'Ready to upload Excel files'
                          })}
                          variant="outline"
                        >
                          Try Again
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Upload Instructions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    <span>Upload Requirements</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Supported Formats</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Excel (.xlsx, .xls)</li>
                        <li>• CSV files</li>
                        <li>• Maximum file size: 50MB</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Data Structure</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• First row should contain headers</li>
                        <li>• Include metrics, dimensions, and values</li>
                        <li>• Time-based data (years, quarters, months)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5" />
                  <span>AI Chat Assistant</span>
                </CardTitle>
                <CardDescription>
                  Chat with your financial data using natural language. Ask questions about revenue, profits, trends, and more.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChatInterface onSearch={handleSearch} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Semantic Search</span>
                </CardTitle>
                <CardDescription>
                  Search through your financial data using natural language queries.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tenant ID</label>
                    {uploadStatus.tenantId ? (
                      <div className="p-2 bg-gray-100 rounded border text-sm font-mono">
                        {uploadStatus.tenantId}
                      </div>
                    ) : (
                      <Select value={tenantId} onValueChange={setTenantId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tenant_test_enhanced">tenant_test_enhanced</SelectItem>
                          <SelectItem value="tenant_prod">tenant_prod</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Workbook</label>
                    {uploadStatus.workbookId ? (
                      <div className="p-2 bg-gray-100 rounded border text-sm font-mono">
                        {uploadStatus.workbookId}
                      </div>
                    ) : (
                      <Select value={workbookId} onValueChange={setWorkbookId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Company Financial Model MultiYear">Company Financial Model MultiYear</SelectItem>
                          <SelectItem value="Sales Dashboard">Sales Dashboard</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                
                {uploadStatus.tenantId && uploadStatus.workbookId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Using uploaded data:</span> {uploadStatus.fileName} 
                      ({uploadStatus.cellCount || 0} cells processed)
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Query</label>
                  <Textarea
                    placeholder="What was the revenue in Q1 2023? Show me profit margins by region..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <Button 
                  onClick={handleSearchClick} 
                  disabled={isSearching || !query.trim()}
                  className="w-full"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Search Results</span>
                </CardTitle>
                <CardDescription>
                  {searchResults.length > 0 
                    ? `Found ${searchResults.length} results for your query`
                    : "No search results yet. Try searching for something!"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {searchResults.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">
                        {searchResults.length} results
                      </Badge>
                      <Button variant="outline" size="sm">
                        Export Results
                      </Button>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Quarter</TableHead>
                          <TableHead>Region</TableHead>
                          <TableHead>Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((result, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{result.metric}</TableCell>
                            <TableCell>${result.value?.toLocaleString()}</TableCell>
                            <TableCell>{result.year}</TableCell>
                            <TableCell>{result.quarter}</TableCell>
                            <TableCell>{result.region}</TableCell>
                            <TableCell>
                              <Badge variant={result.score > 0.8 ? "default" : "secondary"}>
                                {(result.score * 100).toFixed(0)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No search results to display</p>
                    <p className="text-sm">Try searching for financial data or upload some Excel files first</p>
                  </div>
                )}
              </CardContent>
            </Card>

                         {/* AI Insights */}
             {llmResponse && (
               <Card>
                 <CardHeader>
                   <CardTitle className="flex items-center space-x-2">
                     <Brain className="h-5 w-5" />
                     <span>AI Insights</span>
                   </CardTitle>
                 </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-blue-900">{llmResponse.answer}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Confidence:</span>
                      <Badge variant="outline" className="ml-2">
                        {(llmResponse.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Data Points:</span>
                      <span className="ml-2">{llmResponse.dataPoints}</span>
                    </div>
                  </div>
                  
                  {llmResponse.reasoning && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Reasoning:</span> {llmResponse.reasoning}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2,847</div>
                  <p className="text-xs text-muted-foreground">
                    +20.1% from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Search Queries</CardTitle>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,234</div>
                  <p className="text-xs text-muted-foreground">
                    +12.3% from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">AI Responses</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">98.2%</div>
                  <p className="text-xs text-muted-foreground">
                    +2.1% from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">
                    +8.7% from last month
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { action: "Excel file uploaded", user: "John Doe", time: "2 minutes ago", type: "upload" },
                    { action: "Search query processed", user: "Jane Smith", time: "5 minutes ago", type: "search" },
                    { action: "AI response generated", user: "Mike Johnson", time: "8 minutes ago", type: "ai" },
                    { action: "Data exported", user: "Sarah Wilson", time: "15 minutes ago", type: "export" }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-xs text-gray-500">by {activity.user} • {activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

