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
import { apiService, type SearchResponse } from "../services/api-service";

interface Workbook {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
}

interface SearchClientProps {
  initialWorkbooks: Workbook[];
}

export function SearchClient({ initialWorkbooks }: SearchClientProps) {
  const [workbooks, setWorkbooks] = useState<Workbook[]>(initialWorkbooks);
  const [selectedWorkbook, setSelectedWorkbook] = useState<Workbook | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedWorkbook) return;
    
    try {
      setIsSearching(true);
      setSearchError(null);
      const results = await apiService.searchWithWorkbook(
        searchQuery,
        selectedWorkbook.id,
        selectedWorkbook.tenantId,
        50
      );
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Workbook
          </CardTitle>
          <CardDescription>
            Choose a workbook to search in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedWorkbook?.id || ""}
            onValueChange={(value) => {
              const workbook = workbooks.find(w => w.id === value);
              setSelectedWorkbook(workbook || null);
            }}
          >
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Select a workbook" />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Semantic Search
          </CardTitle>
          <CardDescription>
            Search your data using natural language queries
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

          {searchError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <h3 className="font-semibold">Search Error</h3>
              </div>
              <p className="text-sm text-red-600 mt-2">{searchError}</p>
            </div>
          )}

          {searchResults && searchResults.success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                <h3 className="font-semibold">Search Results</h3>
              </div>
              <div className="mt-2 space-y-2 text-sm">
                <p><strong>Query:</strong> {searchResults.query}</p>
                {searchResults.vectorResults && (
                  <p><strong>Results Found:</strong> {searchResults.vectorResults.length}</p>
                )}
                {searchResults.llmResponse && (
                  <div>
                    <p><strong>AI Answer:</strong> {searchResults.llmResponse.answer}</p>
                    {searchResults.llmResponse.confidence && (
                      <p><strong>Confidence:</strong> {(searchResults.llmResponse.confidence * 100).toFixed(1)}%</p>
                    )}
                  </div>
                )}
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">Show Raw Results</summary>
                <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(searchResults, null, 2)}</pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}