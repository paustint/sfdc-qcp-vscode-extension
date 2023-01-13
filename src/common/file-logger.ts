import { ensureFile, readFile } from 'fs-extra';
import { FILE_PATHS, SETTINGS } from './constants';
import { LogEntry, CustomScriptFile, LogEntryAction, CustomScript } from '../models';
import { writeFileAsJson, getPathWithFileName, copyFile } from './utils';
import { workspace } from 'vscode';
import * as _ from 'lodash';

export interface AddSuccessInput {
  action: LogEntryAction;
  username?: string;
}

export interface AddSuccessInputFiles extends AddSuccessInput {
  files: CustomScriptFile | CustomScriptFile[];
}

export interface AddSuccessInputScripts extends AddSuccessInput {
  fileName: string;
  files: CustomScript | CustomScript[];
}

const filePath = getPathWithFileName(FILE_PATHS.LOG.target);
let fileLog: LogEntry[];
let initError = false;

function isAddSuccessInputFiles(val: any): val is AddSuccessInputScripts {
  return val.fileName ? true : false;
}

export async function init() {
  try {
    await ensureFile(filePath);
    const fileContents = await readFile(filePath, 'UTF-8');
    if (!fileContents) {
      fileLog = [];
      await saveFile();
    } else {
      try {
        fileLog = JSON.parse(fileContents);
        console.log('[FILE LOG] initialized');
      } catch (ex) {
        console.log('[FILE LOG] Log file does not contain valid JSON, backing up file and starting new file');
        try {
          await copyFile(FILE_PATHS.LOG.backup, fileContents, true);
          fileLog = [];
          await saveFile();
        } catch (ex) {
          console.warn('[FILE LOG] Error saving backup log and re-initializing');
        }
      }
    }
  } catch (ex) {
    initError = true;
    console.warn('[FILE LOG] Error initializing');
  }
}

export async function addSuccessEntry(input: AddSuccessInputFiles | AddSuccessInputScripts) {
  try {
    if (isAddSuccessInputFiles(input)) {
      let { action, username, files, fileName } = input;
      if (!Array.isArray(files)) {
        files = [files];
      }
      files.forEach(file => {
        fileLog.unshift({
          action,
          status: 'success',
          username,
          fileName,
          recordId: file.Id,
          recordName: file.Name,
          timestamp: new Date().toISOString(),
        });
      });
    } else {
      let { action, username, files } = input;
      if (!Array.isArray(files)) {
        files = [files];
      }
      files.forEach(file => {
        fileLog.unshift({
          action,
          status: 'success',
          username,
          fileName: file.fileName,
          recordId: file.record.Id,
          recordName: file.record.Name,
          timestamp: new Date().toISOString(),
        });
      });
    }

    await saveFile();
  } catch (ex) {
    console.log('[FILE LOG] Error saving log entry');
  }
}

export async function addErrorEntry(action: LogEntryAction, error: string, username?: string, file?: CustomScriptFile) {
  try {
    if (file) {
      fileLog.unshift({
        action,
        username,
        status: 'error',
        fileName: file.fileName,
        recordId: file.record.Id,
        recordName: file.record.Name,
        error,
        timestamp: new Date().toISOString(),
      });
    } else {
      fileLog.unshift({
        action,
        username,
        status: 'error',
        error,
        timestamp: new Date().toISOString(),
      });
    }
    await saveFile();
  } catch (ex) {
    console.log('[FILE LOG] Error saving log entry');
  }
}

async function saveFile() {
  if (initError) {
    return;
  }
  try {
    fileLog = fileLog || [];

    let maxLogEntries = workspace.getConfiguration(SETTINGS.NAMESPACE).get<number>(SETTINGS.ENTRIES.MAX_LOG_ENTRIES);

    if (_.isUndefined(maxLogEntries)) {
      maxLogEntries = SETTINGS.DEFAULTS.MAX_LOG_ENTRIES;
    }
    // WorkspaceConfiguration
    if (fileLog.length > maxLogEntries) {
      fileLog = fileLog.slice(0, maxLogEntries);
    }

    await writeFileAsJson(filePath, fileLog);
    console.log('[FILE LOG] Saved log file');
  } catch (ex) {
    console.warn('[FILE LOG] Error saving log file', ex.message);
  }
}
