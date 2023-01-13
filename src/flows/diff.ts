import * as jsforce from 'jsforce';
import { basename } from 'path';
import { commands, Uri, window } from 'vscode';
import { INPUT_OPTIONS } from '../common/constants';
import { initConnection, queryAllRecordsWithoutCode } from '../common/sfdc-utils';
import { getAllSrcFiles, getSfdcUri } from '../common/utils';
import { ConfigData, CustomScriptBase } from '../models';

async function getFileToCompare(skipFile?: string): Promise<string | undefined> {
  let existingFiles = await getAllSrcFiles();
  if (skipFile) {
    existingFiles = existingFiles.filter(file => file.fsPath !== skipFile);
  }
  const pickedFiles = await window.showQuickPick(INPUT_OPTIONS.PUSH_SHOW_FILE_LIST(existingFiles));
  if (pickedFiles) {
    return pickedFiles.label;
  }
}

export async function pickRemoteFile(
  conn: jsforce.Connection,
  existingRecs?: CustomScriptBase[],
  skipRecordId?: string,
  query?: string,
): Promise<{ records: CustomScriptBase[]; uri: Uri } | undefined> {
  let records: CustomScriptBase[] = existingRecs || [];
  if (!Array.isArray(existingRecs)) {
    records = await queryAllRecordsWithoutCode(conn);
    console.log('records', records);
  }
  records = records.filter(rec => rec.Id !== skipRecordId);

  const pickedFile = await window.showQuickPick(INPUT_OPTIONS.PULL_ONE_REMOTE_SHOW_FILE_LIST(records));
  console.log('pickedFile', pickedFile);
  if (pickedFile && pickedFile.description) {
    return {
      records,
      uri: getSfdcUri(pickedFile.description, query),
    };
  }
}

export async function compareLocalWithRemote(compareSame: boolean, configData: ConfigData, conn?: jsforce.Connection, sourceFile?: string) {
  try {
    conn = await initConnection(configData.orgInfo, conn);
    if (!sourceFile) {
      sourceFile = await getFileToCompare();
    }
    if (sourceFile) {
      const source = Uri.file(sourceFile);
      if (compareSame) {
        // find file in config
        const foundConfigFile = configData.files.find(configFile => configFile.fileName === sourceFile);
        if (foundConfigFile) {
          const target = getSfdcUri(foundConfigFile.record.Id);

          const message = `Local ${basename(sourceFile)} ↔ Salesforce Record ${target.fragment}`;
          await commands.executeCommand('vscode.diff', source, target, message);
        } else {
          window.showErrorMessage(`The local file does not have an entry in qcp-config.json and cannot be queried from Salesforce.`);
        }
      } else {
        // query files and have user pick one
        const targetData = await pickRemoteFile(conn);
        if (targetData) {
          const message = `Local ${basename(sourceFile)} ↔ Salesforce Record ${targetData.uri.fragment}`;
          await commands.executeCommand('vscode.diff', source, targetData.uri, message);
        }
      }
    }
  } catch (ex) {
    console.log('[COMPARE] Error comparing file', ex);
    window.showErrorMessage(`Error comparing records: ${ex.message}`);
  }
}

export async function compareRemoteRecords(configData: ConfigData, conn?: jsforce.Connection) {
  try {
    conn = await initConnection(configData.orgInfo, conn);

    const sourceData = await pickRemoteFile(conn);
    if (sourceData) {
      const targetData = await pickRemoteFile(conn, sourceData.records, sourceData.uri.fragment);
      if (targetData) {
        const message = `Salesforce Record ${sourceData.uri.fragment} ↔ Salesforce Record ${targetData.uri.fragment}`;
        await commands.executeCommand('vscode.diff', sourceData.uri, targetData.uri, message);
      }
    }
  } catch (ex) {}
}

export async function compareLocalFiles() {
  try {
    const sourceFile = await getFileToCompare();
    if (sourceFile) {
      const targetFile = await getFileToCompare();
      if (targetFile) {
        const message = `${basename(sourceFile)} ↔ ${basename(targetFile)}`;
        await commands.executeCommand('vscode.diff', Uri.file(sourceFile), Uri.file(sourceFile), message);
      }
    }
  } catch (ex) {
    console.log('[COMPARE] Error comparing file', ex);
    window.showErrorMessage(`Error comparing records: ${ex.message}`);
  }
}
