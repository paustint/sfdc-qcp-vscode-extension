import * as jsforce from 'jsforce';
import { getAllSrcFiles, getBackupFolderName, copyFile, getSrcFile } from '../common/utils';
import { copyFileSync, ensureDir } from 'fs-extra';
import * as path from 'path';
import { initConnection, queryAllRecords } from '../common/sfdc-utils';
import { ConfigData } from '../models';
import * as sanitize from 'sanitize-filename';
import { Uri } from 'vscode';

export async function chooseBackup() {}

/**
 * Copy file(s) from /src directly into backup directory
 *
 * If filename is provided then only that one file will be backed up, otherwise backup all files in src directory
 * fileName should be the filename and extension without any path included, and it is assumed the file resides in /src
 */
export async function backupLocal(fileName?: string, existingFolder?: string): Promise<string> {
  // copy all files from SRC to backup dir
  let srcFiles: Uri[] = [];
  if (fileName) {
    srcFiles = await getSrcFile(fileName);
  } else {
    srcFiles = await getAllSrcFiles(1000);
  }

  const backupFolderPath = existingFolder || (await getBackupFolderName('local'));
  await ensureDir(backupFolderPath);

  for (let file of srcFiles) {
    const fileName = path.basename(file.fsPath);
    copyFileSync(file.fsPath, path.join(backupFolderPath, fileName));
  }

  return backupFolderPath;
}

/**
 * Query all files from Salesforce and put the contents in a backup folder
 */
export async function backupFromRemote(configData: ConfigData, conn?: jsforce.Connection): Promise<string> {
  conn = await initConnection(configData.orgInfo, conn);
  let records;
  records = await queryAllRecords(conn);
  console.log('records', records);
  const backupFolderPath = await getBackupFolderName('remote');

  for (let record of records) {
    await copyFile(`/${backupFolderPath}/${sanitize(record.Name)}.ts`, record.SBQQ__Code__c, false, true);
  }

  console.log('saved downloaded files');

  return backupFolderPath;
}
