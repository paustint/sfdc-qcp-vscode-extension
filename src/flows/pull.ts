import * as jsforce from 'jsforce';
import { ConfigData, CustomScript, CustomScriptFile } from '../models';
import { initConnection, queryAllRecords, queryRecordsById, queryAllRecordsWithoutCode } from '../common/sfdc-utils';
import { copyFile, saveRecordsToConfig, fileExists, getPathWithFileName, isStringSame } from '../common/utils';
import { INPUT_OPTIONS, QP } from '../common/constants';
import { window } from 'vscode';
import * as sanitize from 'sanitize-filename';
import * as _ from 'lodash';
import * as fileLogger from '../common/file-logger';
import { readFile } from 'fs-extra';
import { backupLocal } from './backup';

export interface QueryAndSaveOptions {
  conn?: jsforce.Connection;
  customScriptFile?: CustomScriptFile;
  recordId?: string;
  clearFileData?: boolean;
  overwriteAll?: boolean;
}

interface OverwriteOptions {
  overwriteAction: string;
  continueWithSave: boolean;
  cancelAction: boolean;
  backupFolderPath?: string;
}

/**
 * For all files provided, save or ask user if we should overwrite
 */
export async function queryFilesAndSave(configData: ConfigData, options: QueryAndSaveOptions): Promise<CustomScript[]> {
  let { conn, customScriptFile, recordId, clearFileData } = options;
  if (!_.isBoolean(clearFileData)) {
    clearFileData = true;
  }
  conn = await initConnection(configData.orgInfo, conn);
  let records;
  let savedRecords = [];
  if (customScriptFile) {
    records = await queryRecordsById(conn, customScriptFile.record.Id);
  } else if (recordId) {
    records = await queryRecordsById(conn, recordId);
  } else {
    records = await queryAllRecords(conn);
  }
  console.log('records', records);

  let overwriteOptions: OverwriteOptions = { overwriteAction: '', continueWithSave: true, cancelAction: false };
  let overwriteAction: string | undefined;
  let backupFolderPath: string | undefined;

  for (let record of records) {
    // TODO: handle file conflicts (ask the user what to do!)
    const sanitizedName = `${sanitize(record.Name)}.ts`;
    const fileName = `/src/${sanitizedName}`;
    if (await fileExists(`src/${sanitizedName}`)) {
      const SBQQ__Code__c = await readFile(getPathWithFileName(fileName), 'UTF-8');
      const isSame = isStringSame(SBQQ__Code__c, record.SBQQ__Code__c);
      console.log('file isSame?', isSame);
      if (!isSame && !options.overwriteAll) {
        overwriteOptions = await handleOverwriteConfirmation(sanitizedName, record, overwriteAction, backupFolderPath);
        overwriteAction = overwriteOptions.overwriteAction;
        backupFolderPath = overwriteOptions.backupFolderPath;
      }
    }

    if (overwriteOptions.continueWithSave) {
      await copyFile(fileName, record.SBQQ__Code__c);
      savedRecords.push(record);
    } else if (overwriteOptions.cancelAction) {
      break;
    }
  }

  console.log('saved downloaded files');
  if (clearFileData) {
    configData.files = [];
  }
  // remove code from each file
  const files = await saveRecordsToConfig(configData, savedRecords);
  fileLogger.addSuccessEntry({ action: 'pull', files });
  return savedRecords;
}

/**
 * Ask user what action to take for files that have a conflict (e.x. filename is same and file contents is different)
 */
async function handleOverwriteConfirmation(
  fileName: string,
  record: CustomScript,
  overwriteAction?: string,
  backupFolderPath?: string,
): Promise<OverwriteOptions> {
  const output: OverwriteOptions = { overwriteAction: overwriteAction || '', continueWithSave: true, cancelAction: false };

  switch (overwriteAction) {
    case QP.OVERWRITE_CONFIRM.BACKUP: {
      // reset since this is a one-time action
      output.overwriteAction = '';
      output.continueWithSave = true;
      output.backupFolderPath = await backupLocal(fileName, backupFolderPath);
      break;
    }
    case QP.OVERWRITE_CONFIRM.OVERWRITE: {
      // reset since this is a one-time action
      output.overwriteAction = '';
      output.continueWithSave = true;
      break;
    }
    case QP.OVERWRITE_CONFIRM.SKIP: {
      // reset since this is a one-time action
      output.overwriteAction = '';
      output.continueWithSave = false;
      break;
    }
    case QP.OVERWRITE_CONFIRM.BACKUP_ALL: {
      output.overwriteAction = QP.OVERWRITE_CONFIRM.BACKUP_ALL;
      output.continueWithSave = true;
      output.backupFolderPath = await backupLocal(fileName, backupFolderPath);
      break;
    }
    case QP.OVERWRITE_CONFIRM.OVERWRITE_ALL: {
      output.overwriteAction = QP.OVERWRITE_CONFIRM.OVERWRITE_ALL;
      output.continueWithSave = true;
      break;
    }
    case QP.OVERWRITE_CONFIRM.SKIP_ALL: {
      output.overwriteAction = QP.OVERWRITE_CONFIRM.SKIP_ALL;
      output.continueWithSave = false;
      break;
    }
    case QP.OVERWRITE_CONFIRM.CANCEL: {
      output.overwriteAction = QP.OVERWRITE_CONFIRM.CANCEL;
      output.continueWithSave = false;
      output.cancelAction = true;
      break;
    }
    default: {
      /**
       * If no prior selection was made, then let user pick and recursively call this function again to take defined action
       */
      const pickedItem = await window.showQuickPick(INPUT_OPTIONS.OVERWRITE_CONFIRM(fileName), {
        canPickMany: false,
        ignoreFocusOut: true,
      });
      if (pickedItem) {
        // call function again with user selection and return results
        return await handleOverwriteConfirmation(fileName, record, pickedItem.label);
      } else {
        // Stop operation if user cancels
        output.overwriteAction = '';
        output.continueWithSave = false;
      }
      break;
    }
  }

  return output;
}

/**
 * For all files provided, save or ask user if we should overwrite
 * @deprecated 4.6.19
 */
// export async function getFileToPull(configData: ConfigData): Promise<CustomScriptFile | undefined> {
//   const pickedFile = await window.showQuickPick(INPUT_OPTIONS.PULL_ONE_SHOW_FILE_LIST(configData.files));
//   console.log('pickedFile', pickedFile);
//   if (pickedFile) {
//     return configData.files.find(file => file.fileName === pickedFile.label);
//   }
// }

export async function getRemoteFiles(configData: ConfigData, conn?: jsforce.Connection): Promise<CustomScript[] | undefined> {
  conn = await initConnection(configData.orgInfo, conn);
  const records = await queryAllRecordsWithoutCode(conn);
  console.log('records', records);

  const pickedFile = await window.showQuickPick(INPUT_OPTIONS.PULL_ONE_REMOTE_SHOW_FILE_LIST(records));
  console.log('pickedFile', pickedFile);
  if (pickedFile) {
    return await queryFilesAndSave(configData, { conn, recordId: pickedFile.description, clearFileData: false });
  }
}
