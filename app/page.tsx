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

  const handleSearchFiles = useCallback(async () => {
    if (!ticketData) return;
    
    setViewState('files-loading');
    setErrorMessage('');
    
    try {
      const subtasks = ticketData.subtasks.map(s => s.key).join(',');
      const response = await fetch(`/api/files?mainTicket=${encodeURIComponent(ticketData.key)}&subtasks=${encodeURIComponent(subtasks)}`);
      
      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data: FileSearchResponse = await response.json();
      setFileData(data);
      
      // Initialize filters with all options selected by default
      setFilters({
        selectedSubtasks: data.subtasks,
        selectedEventTypes: [],
        selectedCameraTypes: [],
        selectedProjects: data.summary.uniqueProjects,
        selectedVehicles: data.summary.uniqueVehicles,
        dateRange: 'all',
        sortBy: 'fileName',
        sortOrder: 'asc',
      });
      
      setViewState('files-results');
    } catch (error) {
      console.error('File search error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to scan files');
      setViewState('error');
    }
  }, [ticketData]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleBackToSearch = useCallback(() => {
    setViewState('search');
    setTicketData(null);
    setFileData(null);
    setErrorMessage('');
    setFilters({
      selectedSubtasks: [],
      selectedEventTypes: [],
      selectedCameraTypes: [],
      selectedProjects: [],
      selectedVehicles: [],
      dateRange: 'all',
      sortBy: 'fileName',
      sortOrder: 'asc',
    });
  }, []);

  const handleBackToTickets = useCallback(() => {
    setViewState('results');
    setFileData(null);
  }, []);

  // Filter and sort files based on current filter state
  const filteredFiles = useMemo(() => {
    if (!fileData) return [];
    
    let filtered = fileData.files.filter(file => {
      // Filter by subtasks
      if (filters.selectedSubtasks.length > 0) {
        if (!filters.selectedSubtasks.includes(`DATACO-${file.datacoNumber}`)) {
          return false;
        }
      }
      
      // Filter by projects
      if (filters.selectedProjects.length > 0) {
        if (!filters.selectedProjects.includes(file.project)) {
          return false;
        }
      }
      
      // Filter by vehicles
      if (filters.selectedVehicles.length > 0) {
        if (!filters.selectedVehicles.includes(file.vehicle)) {
          return false;
        }
      }
      
      // Filter by event types (if any events match)
      if (filters.selectedEventTypes.length > 0) {
        const hasMatchingEvent = file.uniqueEvents.some(event => 
          filters.selectedEventTypes.includes(event)
        );
        if (!hasMatchingEvent) return false;
      }
      
      // Filter by camera types (if any cameras match)
      if (filters.selectedCameraTypes.length > 0) {
        const hasMatchingCamera = file.uniqueCameras.some(camera => 
          filters.selectedCameraTypes.includes(camera)
        );
        if (!hasMatchingCamera) return false;
      }
      
      return true;
    });
    
    // Sort files
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'fileName':
          comparison = a.fileName.localeCompare(b.fileName);
          break;
        case 'date':
          comparison = a.date.localeCompare(b.date);
          break;
        case 'project':
          comparison = a.project.localeCompare(b.project);
          break;
        case 'vehicle':
          comparison = a.vehicle.localeCompare(b.vehicle);
          break;
        case 'eventCount':
          comparison = a.eventCount - b.eventCount;
          break;
        default:
          comparison = a.fileName.localeCompare(b.fileName);
      }
      
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [fileData, filters]);

  // Get all available filter options
  const filterOptions = useMemo(() => {
    if (!fileData) return null;
    
    return {
      subtasks: fileData.subtasks,
      eventTypes: fileData.summary.uniqueEventTypes,
      cameraTypes: fileData.summary.uniqueCameraTypes,
      projects: fileData.summary.uniqueProjects,
      vehicles: fileData.summary.uniqueVehicles,
    };
  }, [fileData]);

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
            
            <Button 
              onClick={handleSearchFiles}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <FileText className="mr-2 h-4 w-4" />
              Scan Files
            </Button>
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
            
            {/* File Scan Call-to-Action */}
            <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Scan Voice Tagging Files
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Search for JUMP files related to these subtasks in the Voice Tagging directory
                </p>
                <Button 
                  onClick={handleSearchFiles}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Scan Files Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderFilesLoadingView = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Scanning Voice Tagging files...
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Searching through directories and parsing JUMP files
        </p>
        <div className="max-w-md mx-auto">
          <Progress value={85} className="h-2" />
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    </div>
  );

  const renderFilesResultsView = () => {
    if (!fileData || !filterOptions) return null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <Button 
                onClick={handleBackToTickets}
                variant="outline"
                size="sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tickets
              </Button>
              <Button 
                onClick={handleBackToSearch}
                variant="ghost"
                size="sm"
              >
                New Search
              </Button>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Voice Tagging Files
            </h1>
            
            <Badge variant="secondary" className="text-sm">
              {filteredFiles.length} of {fileData.totalFiles} files
            </Badge>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fileData.totalFiles}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Total Files</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fileData.summary.totalEvents}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Total Events</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Camera className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fileData.summary.uniqueCameraTypes.length}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Camera Types</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{fileData.summary.uniqueProjects.length}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Projects</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Filters Panel */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Filter className="mr-2 h-5 w-5" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="basic" className="space-y-4 mt-4">
                      {/* Subtask Filter */}
                      <div>
                        <label className="text-sm font-medium">Subtasks</label>
                        <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                          {filterOptions.subtasks.map(subtask => (
                            <div key={subtask} className="flex items-center space-x-2">
                              <Checkbox
                                id={`subtask-${subtask}`}
                                checked={filters.selectedSubtasks.includes(subtask)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedSubtasks: [...prev.selectedSubtasks, subtask]
                                    }));
                                  } else {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedSubtasks: prev.selectedSubtasks.filter(s => s !== subtask)
                                    }));
                                  }
                                }}
                              />
                              <label htmlFor={`subtask-${subtask}`} className="text-xs font-mono">
                                {subtask}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Project Filter */}
                      <div>
                        <label className="text-sm font-medium">Projects</label>
                        <div className="mt-2 space-y-2">
                          {filterOptions.projects.map(project => (
                            <div key={project} className="flex items-center space-x-2">
                              <Checkbox
                                id={`project-${project}`}
                                checked={filters.selectedProjects.includes(project)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedProjects: [...prev.selectedProjects, project]
                                    }));
                                  } else {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedProjects: prev.selectedProjects.filter(p => p !== project)
                                    }));
                                  }
                                }}
                              />
                              <label htmlFor={`project-${project}`} className="text-xs">
                                {project}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="advanced" className="space-y-4 mt-4">
                      {/* Event Types Filter */}
                      <div>
                        <label className="text-sm font-medium">Event Types</label>
                        <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                          {filterOptions.eventTypes.slice(0, 10).map(event => (
                            <div key={event} className="flex items-center space-x-2">
                              <Checkbox
                                id={`event-${event}`}
                                checked={filters.selectedEventTypes.includes(event)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedEventTypes: [...prev.selectedEventTypes, event]
                                    }));
                                  } else {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedEventTypes: prev.selectedEventTypes.filter(e => e !== event)
                                    }));
                                  }
                                }}
                              />
                              <label htmlFor={`event-${event}`} className="text-xs">
                                {event}
                              </label>
                            </div>
                          ))}
                          {filterOptions.eventTypes.length > 10 && (
                            <p className="text-xs text-gray-500">
                              +{filterOptions.eventTypes.length - 10} more event types...
                            </p>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Camera Types Filter */}
                      <div>
                        <label className="text-sm font-medium">Camera Types</label>
                        <div className="mt-2 space-y-2">
                          {filterOptions.cameraTypes.map(camera => (
                            <div key={camera} className="flex items-center space-x-2">
                              <Checkbox
                                id={`camera-${camera}`}
                                checked={filters.selectedCameraTypes.includes(camera)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedCameraTypes: [...prev.selectedCameraTypes, camera]
                                    }));
                                  } else {
                                    setFilters(prev => ({
                                      ...prev,
                                      selectedCameraTypes: prev.selectedCameraTypes.filter(c => c !== camera)
                                    }));
                                  }
                                }}
                              />
                              <label htmlFor={`camera-${camera}`} className="text-xs">
                                {camera}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Separator />

                  {/* Sort Options */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sort By</label>
                    <Select
                      value={filters.sortBy}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fileName">File Name</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="vehicle">Vehicle</SelectItem>
                        <SelectItem value="eventCount">Event Count</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sort-desc"
                        checked={filters.sortOrder === 'desc'}
                        onCheckedChange={(checked) => {
                          setFilters(prev => ({
                            ...prev,
                            sortOrder: checked ? 'desc' : 'asc'
                          }));
                        }}
                      />
                      <label htmlFor="sort-desc" className="text-xs">
                        Descending
                      </label>
                    </div>
                  </div>

                  {/* Clear Filters */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({
                      selectedSubtasks: filterOptions.subtasks,
                      selectedEventTypes: [],
                      selectedCameraTypes: [],
                      selectedProjects: filterOptions.projects,
                      selectedVehicles: filterOptions.vehicles,
                      dateRange: 'all',
                      sortBy: 'fileName',
                      sortOrder: 'asc',
                    })}
                    className="w-full"
                  >
                    Reset Filters
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Files List */}
            <div className="lg:col-span-3 space-y-4">
              {filteredFiles.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No files match your filters
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Try adjusting your filter criteria to see more results
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredFiles.map((file, index) => (
                  <Card key={file.fileName} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* File Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                DATACO-{file.datacoNumber}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {file.project}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {file.vehicle}
                              </Badge>
                            </div>
                            <h3 className="font-mono text-sm text-gray-900 dark:text-white">
                              {file.fileName}
                            </h3>
                          </div>
                          <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                            <p>{file.date} at {file.time}</p>
                            <p>{file.eventCount} events</p>
                          </div>
                        </div>

                        {/* File Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-gray-500">SW Version:</span>
                            <p className="font-mono">{file.swVersion}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Created:</span>
                            <p>{file.createDate}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Size:</span>
                            <p>{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Cameras:</span>
                            <p>{file.uniqueCameras.join(', ')}</p>
                          </div>
                        </div>

                        {/* Event Types */}
                        {file.uniqueEvents.length > 0 && (
                          <div>
                            <span className="text-xs text-gray-500 block mb-2">Event Types:</span>
                            <div className="flex flex-wrap gap-1">
                              {file.uniqueEvents.slice(0, 5).map(event => (
                                <Badge key={event} variant="outline" className="text-xs px-2 py-1">
                                  {event}
                                </Badge>
                              ))}
                              {file.uniqueEvents.length > 5 && (
                                <Badge variant="secondary" className="text-xs px-2 py-1">
                                  +{file.uniqueEvents.length - 5} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  switch (viewState) {
    case 'loading':
      return renderLoadingView();
    case 'files-loading':
      return renderFilesLoadingView();
    case 'error':
      return renderErrorView();
    case 'results':
      return renderResultsView();
    case 'files-results':
      return renderFilesResultsView();
    default:
      return renderSearchView();
  }
}