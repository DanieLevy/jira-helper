import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface JumpFileMetadata {
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

interface JumpFileData extends JumpFileMetadata {
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

const VOICE_TAGGING_PATH = '/mobileye/DC/Voice_Tagging';

// Parse filename to extract metadata
const parseFileName = (fileName: string): Partial<JumpFileMetadata> | null => {
  // Pattern: PROJECT_VEH_DATE_TIME_SWVERSION_CREATEDATE_DATACO-NUMBER.jump
  const pattern = /^([^_]+)_([^_]+)_(\d{6})_(\d{6})_(\d+)_(\d{6})_DATACO-(\d+)\.jump$/;
  const match = fileName.match(pattern);
  
  if (!match) return null;
  
  const [, project, vehicle, date, time, swVersion, createDate, datacoNumber] = match;
  
  // Format dates for better readability
  const formatDate = (dateStr: string) => {
    if (dateStr.length === 6) {
      const day = dateStr.slice(0, 2);
      const month = dateStr.slice(2, 4);
      const year = '20' + dateStr.slice(4, 6);
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };
  
  const formatTime = (timeStr: string) => {
    if (timeStr.length === 6) {
      const hours = timeStr.slice(0, 2);
      const minutes = timeStr.slice(2, 4);
      const seconds = timeStr.slice(4, 6);
      return `${hours}:${minutes}:${seconds}`;
    }
    return timeStr;
  };

  return {
    project,
    vehicle,
    date: formatDate(date),
    time: formatTime(time),
    swVersion,
    createDate: formatDate(createDate),
    datacoNumber,
    sessionName: `${project}_${vehicle}_${date}_${time}_${swVersion}`,
  };
};

// Parse jump file content to extract events
const parseJumpFileContent = (content: string, sessionName: string): JumpFileEvent[] => {
  const lines = content.split('\n');
  const events: JumpFileEvent[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;
    
    // Pattern: SESSION_s001_s_VIEW_s60_CLIP CAMERA FRAME EVENT
    const parts = trimmedLine.split(/\s+/);
    if (parts.length < 4) continue;
    
    const [trackfile, camera, frameNumber, ...eventParts] = parts;
    const eventName = eventParts.join(' ');
    
    // Extract view and clip from trackfile
    const trackPattern = new RegExp(`${sessionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_s\\d+_s_([^_]+)_s\\d+_([^_]+)$`);
    const trackMatch = trackfile.match(trackPattern);
    
    if (trackMatch) {
      const [, viewName, clipNumber] = trackMatch;
      
      events.push({
        sessionName,
        viewName,
        clipNumber: clipNumber.padStart(4, '0'), // Normalize clip numbers
        camera,
        frameNumber,
        eventName,
        fullLine: trimmedLine,
      });
    }
  }
  
  return events;
};

// Scan directory recursively for jump files
const scanDirectory = async (dirPath: string, subtasks: string[]): Promise<JumpFileData[]> => {
  const files: JumpFileData[] = [];
  
  try {
    if (!fs.existsSync(dirPath)) {
      console.warn(`Directory does not exist: ${dirPath}`);
      return files;
    }
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath, subtasks);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.jump')) {
        const metadata = parseFileName(entry.name);
        if (!metadata || !metadata.datacoNumber) continue;
        
        // Check if this file belongs to any of our subtasks
        if (!subtasks.includes(metadata.datacoNumber)) continue;
        
        try {
          const stats = fs.statSync(fullPath);
          const content = fs.readFileSync(fullPath, 'utf-8');
          const events = parseJumpFileContent(content, metadata.sessionName!);
          
          const uniqueEvents = [...new Set(events.map(e => e.eventName))];
          const uniqueCameras = [...new Set(events.map(e => e.camera))];
          const uniqueClips = [...new Set(events.map(e => e.clipNumber))];
          
          files.push({
            fileName: entry.name,
            filePath: fullPath,
            project: metadata.project!,
            vehicle: metadata.vehicle!,
            date: metadata.date!,
            time: metadata.time!,
            swVersion: metadata.swVersion!,
            createDate: metadata.createDate!,
            datacoNumber: metadata.datacoNumber!,
            sessionName: metadata.sessionName!,
            size: stats.size,
            lastModified: stats.mtime,
            events,
            eventCount: events.length,
            uniqueEvents,
            uniqueCameras,
            uniqueClips,
          });
        } catch (error) {
          console.error(`Error reading file ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }
  
  return files;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mainTicket = searchParams.get('mainTicket');
    const subtasksParam = searchParams.get('subtasks');
    
    if (!mainTicket || !subtasksParam) {
      return NextResponse.json({ 
        error: 'mainTicket and subtasks parameters are required' 
      }, { status: 400 });
    }
    
    const subtasks = subtasksParam.split(',').map(s => s.replace('DATACO-', ''));
    
    console.log(`Scanning for files related to ${mainTicket} with subtasks:`, subtasks);
    
    // Scan the Voice Tagging directory
    const files = await scanDirectory(VOICE_TAGGING_PATH, subtasks);
    
    // Get list of project folders for reference
    let projectFolders: string[] = [];
    try {
      if (fs.existsSync(VOICE_TAGGING_PATH)) {
        projectFolders = fs.readdirSync(VOICE_TAGGING_PATH, { withFileTypes: true })
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .sort();
      }
    } catch (error) {
      console.error('Error reading project folders:', error);
    }
    
    // Generate summary statistics
    const allEvents = files.flatMap(f => f.events);
    const uniqueEventTypes = [...new Set(allEvents.map(e => e.eventName))].sort();
    const uniqueCameraTypes = [...new Set(allEvents.map(e => e.camera))].sort();
    const uniqueProjects = [...new Set(files.map(f => f.project))].sort();
    const uniqueVehicles = [...new Set(files.map(f => f.vehicle))].sort();
    
    // Calculate date range
    const dates = files.map(f => f.date).filter(d => d);
    const sortedDates = dates.sort();
    const dateRange = {
      earliest: sortedDates[0] || '',
      latest: sortedDates[sortedDates.length - 1] || '',
    };
    
    const response: FileSearchResponse = {
      mainTicket,
      subtasks: subtasks.map(s => `DATACO-${s}`),
      totalFiles: files.length,
      projectFolders,
      files: files.sort((a, b) => a.fileName.localeCompare(b.fileName)),
      summary: {
        totalEvents: allEvents.length,
        uniqueEventTypes,
        uniqueCameraTypes,
        uniqueProjects,
        uniqueVehicles,
        dateRange,
      },
    };
    
    // Log scan results for debugging
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        mainTicket,
        subtasks: response.subtasks,
        totalFiles: files.length,
        totalEvents: allEvents.length,
        scanPath: VOICE_TAGGING_PATH,
        userAgent: request.headers.get('user-agent'),
      };
      
      const logPath = path.join(logDir, 'file-scans.log');
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    } catch (fsError) {
      console.error('Failed to write scan log:', fsError);
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error scanning files:', error);
    return NextResponse.json(
      { error: 'Failed to scan files' },
      { status: 500 }
    );
  }
}
