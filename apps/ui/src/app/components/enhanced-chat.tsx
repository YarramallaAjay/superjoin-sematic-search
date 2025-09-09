"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Bot,
  User,
  Send,
  X,
  Loader2,
  Copy,
  BarChart3,
  Database,
  Lightbulb,
  MessageSquare,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download
} from "lucide-react";

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  searchResults?: any;
  keyInsights?: string[];
  generatedTable?: string;
}

interface EnhancedChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isProcessing: boolean;
  isVisible: boolean;
  onClose: () => void;
  onClearHistory: () => void;
  selectedWorkbook?: any;
}

export function EnhancedChat({
  messages,
  onSendMessage,
  isProcessing,
  isVisible,
  onClose,
  onClearHistory,
  selectedWorkbook
}: EnhancedChatProps) {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = () => {
    if (!input.trim() || isProcessing) return;
    
    onSendMessage(input);
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast here
  };

  if (!isVisible) return null;

  return (
    <Card className={`
      fixed bottom-4 right-4 z-50 shadow-2xl border-2 transition-all duration-300
      ${isExpanded 
        ? 'w-[800px] h-[700px]' 
        : 'w-[400px] h-[500px]'
      }
      max-w-[90vw] max-h-[90vh]
    `}>
      {/* Header */}
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">AI Assistant</CardTitle>
              <CardDescription className="text-xs">
                {selectedWorkbook ? `Working with: ${selectedWorkbook.name}` : 'Select a workbook to start'}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearHistory}
              className="h-6 w-6 p-0"
              disabled={messages.length === 0}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col h-full">
        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">Welcome to AI Assistant!</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                {selectedWorkbook 
                  ? "Ask me anything about your data. I can help you analyze, search, and understand your Excel files."
                  : "Please select a workbook above to start asking questions about your data."
                }
              </p>
              
              {selectedWorkbook && (
                <div className="mt-6 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge 
                      variant="outline" 
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setInput("What's the total revenue?")}
                    >
                      "What's the total revenue?"
                    </Badge>
                    <Badge 
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setInput("Show me profit margins by quarter")}
                    >
                      "Show profit margins"
                    </Badge>
                    <Badge 
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setInput("Analyze the financial trends")}
                    >
                      "Analyze trends"
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.type === 'assistant' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white ml-auto'
                        : 'bg-muted border'
                    }`}
                  >
                    <div className="text-sm">
                      {message.isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-muted-foreground">{message.content}</span>
                        </div>
                      ) : (
                        <div>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          
                          {/* Key Insights */}
                          {message.keyInsights && message.keyInsights.length > 0 && (
                            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                                <span className="font-medium text-yellow-800 dark:text-yellow-200 text-xs">Key Insights</span>
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
                                <span className="font-medium text-blue-800 dark:text-blue-200 text-xs">Generated Analysis</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(message.generatedTable || '', 'Analysis')}
                                  className="ml-auto h-5 w-5 p-0"
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
                                <span className="font-medium text-green-800 dark:text-green-200 text-xs">Data Summary</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-300">
                                <div>Results: {message.searchResults.structuredData?.length || 0}</div>
                                <div>Confidence: {message.searchResults.llmResponse?.confidence ? `${(message.searchResults.llmResponse.confidence * 100).toFixed(1)}%` : 'N/A'}</div>
                                <div>Data Points: {message.searchResults.llmResponse?.dataPoints || 0}</div>
                                <div>Sources: {message.searchResults.llmResponse?.sources?.length || 0}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs opacity-60 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  
                  {message.type === 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* Input */}
        <div className="border-t bg-background p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder={
                selectedWorkbook 
                  ? "Ask me about your data..." 
                  : "Select a workbook first..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!selectedWorkbook || isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleSubmit}
              disabled={!selectedWorkbook || !input.trim() || isProcessing}
              size="sm"
              className="px-3"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {!selectedWorkbook && (
            <p className="text-xs text-muted-foreground mt-2">
              Please select a workbook above to start chatting with your data.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}