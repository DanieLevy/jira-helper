import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface JiraSubtask {
  id: string;
  key: string;
  summary?: string;
}

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    subtasks: JiraSubtask[];
  };
}

interface JiraResponse {
  key: string;
  summary: string;
  subtasks: {
    key: string;
    summary: string;
  }[];
}

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_USER = process.env.JIRA_USER;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ticketNumber = searchParams.get('ticket');

    if (!ticketNumber) {
      return NextResponse.json({ error: 'Ticket number is required' }, { status: 400 });
    }

    if (!JIRA_BASE_URL || !JIRA_USER || !JIRA_API_TOKEN) {
      return NextResponse.json({ error: 'JIRA credentials not configured' }, { status: 500 });
    }

    // Auto-complete DATACO- prefix if only numbers provided
    const fullTicketKey = ticketNumber.startsWith('DATACO-') 
      ? ticketNumber 
      : `${JIRA_PROJECT_KEY}-${ticketNumber}`;

    console.log(`Fetching JIRA ticket: ${fullTicketKey}`);

    // Create authentication header
    const auth = Buffer.from(`${JIRA_USER}:${JIRA_API_TOKEN}`).toString('base64');

    // Fetch main ticket with subtasks
    const response = await fetch(
      `${JIRA_BASE_URL}/rest/api/2/issue/${fullTicketKey}?expand=subtasks`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }
      throw new Error(`JIRA API error: ${response.status} ${response.statusText}`);
    }

    const jiraData: JiraIssue = await response.json();

    // Extract subtask information
    const subtasks = jiraData.fields.subtasks || [];
    
    // Fetch detailed information for each subtask to get summaries
    const subtaskDetails = await Promise.all(
      subtasks.map(async (subtask) => {
        try {
          const subtaskResponse = await fetch(
            `${JIRA_BASE_URL}/rest/api/2/issue/${subtask.key}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
            }
          );

          if (subtaskResponse.ok) {
            const subtaskData = await subtaskResponse.json();
            return {
              key: subtask.key,
              summary: subtaskData.fields?.summary || 'No summary available',
            };
          } else {
            return {
              key: subtask.key,
              summary: 'Unable to fetch summary',
            };
          }
        } catch (error) {
          console.error(`Error fetching subtask ${subtask.key}:`, error);
          return {
            key: subtask.key,
            summary: 'Error fetching summary',
          };
        }
      })
    );

    const result: JiraResponse = {
      key: jiraData.key,
      summary: jiraData.fields.summary,
      subtasks: subtaskDetails,
    };

    // Log the result for debugging (file system usage example)
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        ticketKey: fullTicketKey,
        subtasksCount: subtaskDetails.length,
        userAgent: request.headers.get('user-agent'),
      };
      
      const logPath = path.join(logDir, 'jira-requests.log');
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    } catch (fsError) {
      console.error('Failed to write log:', fsError);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching JIRA data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch JIRA data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Future endpoint for more complex JIRA operations
  return NextResponse.json({ error: 'POST not implemented yet' }, { status: 501 });
}
