import { readFile } from 'fs-extra';
import * as jsforce from 'jsforce';
import * as path from 'path';
import { window } from 'vscode';
import { INPUT_OPTIONS, MESSAGES } from '../common/constants';
import { ConfigData, CustomScriptUpsert, CustomScript } from '../models';
import { initConnection, queryRecordsById, queryRecordsByName } from '../common/sfdc-utils';
import { getAllSrcFiles, saveRecordsToConfig } from '../common/utils';
import * as fileLogger from '../common/file-logger';

/**
 * For all files provided, save or ask user if we should overwrite
 */
export async function getFilesToPush(): Promise<string[] | undefined> {
  const existingFiles = await getAllSrcFiles();
  console.log('[PUSH] existingFiles', existingFiles);

  const pickedFiles = await window.showQuickPick(INPUT_OPTIONS.PUSH_SHOW_FILE_LIST(existingFiles), { canPickMany: true });
  console.log('[PUSH] pickedFiles', pickedFiles);
  if (pickedFiles) {
    return pickedFiles.map(pickedFile => pickedFile.label);
  }
}

export async function pushFile(configData: ConfigData, fileName: string, conn?: jsforce.Connection): Promise<CustomScript | undefined> {
  conn = await initConnection(configData.orgInfo, conn);
  const SBQQ__Code__c = await readFile(fileName, 'UTF-8');
  // TODO: tsc() to ensure types are removed if they exist
  const Name = path.basename(fileName).replace('.ts', '');
  let existingItem = configData.files.find(fileConfig => fileConfig.fileName === fileName);

  const record: CustomScriptUpsert = {
    Name,
    SBQQ__Code__c,
  };

  let results: jsforce.RecordResult;

  if (!existingItem) {
    // TODO: add better control over choosing which record to overwrite
    // maybe show dialog with all files and make user choose which one to associate
    // TODO: we should prompt the user with a dialog to ask them if we should overwrite the record on SFDC or not
    const queriedRecordsByName = await queryRecordsByName(conn, record.Name, true);
    if (queriedRecordsByName && queriedRecordsByName.length > 0) {
      existingItem = {
        fileName,
        record: queriedRecordsByName[0],
      };
    }
    if (queriedRecordsByName.length > 1) {
      window.showWarningMessage(MESSAGES.PULL.MULTIPLE_REMOTE_RECORDS(record.Name));
    }
  }

  if (existingItem) {
    // existing item
    record.Id = existingItem.record.Id;
    results = await conn.sobject('SBQQ__CustomScript__c').update(record);
    console.log('[PUSH] results', results);
  } else {
    results = await conn.sobject('SBQQ__CustomScript__c').insert(record);
    console.log('[PUSH] results', results);
  }

  if (results.success) {
    const updatedRec = await queryRecordsById(conn, results.id);
    await saveRecordsToConfig(configData, updatedRec);
    fileLogger.addSuccessEntry({ action: 'push', fileName, files: updatedRec });
    return updatedRec[0];
  }
}
