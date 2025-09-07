'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Search, ExternalLink, ArrowLeft, Loader2, AlertCircle, FileText, Filter, Calendar, Camera, Zap, Settings2 } from 'lucide-react';

interface Subtask {
  key: string;
  summary: string;
}

interface JiraTicket {
  key: string;
  summary: string;
  subtasks: Subtask[];
}

interface JumpFileEvent {
  sessionName: string;
  viewName: string;
  clipNumber: string;
  camera: string;
  frameNumber: string;
  eventName: string;
  fullLine: string;
}

interface JumpFileData {
  fileName: string;
  filePath: string;
  project: string;
  vehicle: string;
  date: string;
  time: string;
  swVersion: string;
  createDate: string;
  datacoNumber: string;
  sessionName: string;
  size: number;
  lastModified: Date;
  events: JumpFileEvent[];
  eventCount: number;
  uniqueEvents: string[];
  uniqueCameras: string[];
  uniqueClips: string[];
}

interface FileSearchResponse {
  mainTicket: string;
  subtasks: string[];
  totalFiles: number;
  projectFolders: string[];
  files: JumpFileData[];
  summary: {
    totalEvents: number;
    uniqueEventTypes: string[];
    uniqueCameraTypes: string[];
    uniqueProjects: string[];
    uniqueVehicles: string[];
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
}

interface FilterState {
  selectedSubtasks: string[];
  selectedEventTypes: string[];
  selectedCameraTypes: string[];
  selectedProjects: string[];
  selectedVehicles: string[];
  dateRange: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface ApiError {
  error: string;
}

type ViewState = 'search' | 'results' | 'loading' | 'error' | 'files-loading' | 'files-results';

const JIRA_BASE_URL = 'https://jira.mobileye.com/browse/';

export default function Home() {
  const [searchValue, setSearchValue] = useState<string>('');
  const [viewState, setViewState] = useState<ViewState>('search');
  const [ticketData, setTicketData] = useState<JiraTicket | null>(null);
  const [fileData, setFileData] = useState<FileSearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    selectedSubtasks: [],
    selectedEventTypes: [],
    selectedCameraTypes: [],
    selectedProjects: [],
    selectedVehicles: [],
    dateRange: 'all',
    sortBy: 'fileName',
    sortOrder: 'asc',
  });

  const handleSearch = useCallback(async () => {
    if (!searchValue.trim()) {
      setErrorMessage('Please enter a ticket number');
      setViewState('error');
      return;
    }

    setViewState('loading');
    setErrorMessage('');

    try {
      const response = await fetch(`/api/jira?ticket=${encodeURIComponent(searchValue.trim())}`);
      
      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: JiraTicket = await response.json();
      setTicketData(data);
      setViewState('results');
    } catch (error) {
      console.error('Search error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch ticket data');
      setViewState('error');
    }
  }, [searchValue]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleBackToSearch = useCallback(() => {
    setViewState('search');
    setTicketData(null);
    setErrorMessage('');
  }, []);

  const handleOpenJira = useCallback((ticketKey: string) => {
    window.open(`${JIRA_BASE_URL}${ticketKey}`, '_blank', 'noopener,noreferrer');
  }, []);

  const renderSearchView = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              JIRA Helper
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
              Search for DATACO tickets and explore their subtasks with ease
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="space-y-4">
              <div className="text-left">
                <label htmlFor="ticket-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter DATACO Ticket Number
                </label>
                <div className="relative">
                  <Input
                    id="ticket-search"
                    type="text"
                    placeholder="e.g., 13665 or DATACO-13665"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pl-4 pr-12 py-6 text-lg border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800"
                    aria-describedby="search-hint"
                  />
                  <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                </div>
                <p id="search-hint" className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Enter just the numbers (13665) or the full ticket ID (DATACO-13665)
                </p>
              </div>
              
              <Button 
                onClick={handleSearch}
                className="w-full py-6 text-lg font-medium"
                size="lg"
              >
                <Search className="mr-2 h-5 w-5" />
                Search Ticket
              </Button>
            </div>
          </div>

          {/* Example Section */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Example: Try searching for "13665"
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSearchValue('13665');
                setTimeout(handleSearch, 100);
              }}
              className="text-xs"
            >
              Try Example
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLoadingView = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Fetching ticket data...
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Please wait while we retrieve the subtasks
        </p>
      </div>
    </div>
  );

  const renderErrorView = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <CardTitle className="text-red-700 dark:text-red-400">Error</CardTitle>
            <CardDescription className="text-red-600 dark:text-red-300">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleBackToSearch}
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderResultsView = () => {
    if (!ticketData) return null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <Button 
              onClick={handleBackToSearch}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              New Search
            </Button>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Ticket Results
            </h1>
            
            <div className="w-24" /> {/* Spacer for alignment */}
          </div>

          {/* Main Ticket Info */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl text-blue-700 dark:text-blue-400">
                    {ticketData.key}
                  </CardTitle>
                  <CardDescription className="text-base text-gray-700 dark:text-gray-300">
                    {ticketData.summary}
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleOpenJira(ticketData.key)}
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in JIRA
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Subtasks */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Subtasks
              </h2>
              <Badge variant="secondary" className="text-sm">
                {ticketData.subtasks.length} task{ticketData.subtasks.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {ticketData.subtasks.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    This ticket has no subtasks.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {ticketData.subtasks.map((subtask, index) => (
                  <Card 
                    key={subtask.key}
                    className="hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => handleOpenJira(subtask.key)}
                  >
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="font-mono text-xs">
                            {subtask.key}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                          {subtask.summary}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  switch (viewState) {
    case 'loading':
      return renderLoadingView();
    case 'error':
      return renderErrorView();
    case 'results':
      return renderResultsView();
    default:
      return renderSearchView();
  }
}