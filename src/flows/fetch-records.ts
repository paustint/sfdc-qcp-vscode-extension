import { writeFile, ensureDir } from 'fs-extra';
import * as jsforce from 'jsforce';
import { window } from 'vscode';
import { FILE_PATHS, INPUT_OPTIONS } from '../common/constants';
import { fetchQuoteModel } from '../common/sfdc-utils';
import { getPathWithFileName } from '../common/utils';

export async function getRecordName(): Promise<{ recordId: string; filename: string } | undefined> {
  const recordId = await window.showInputBox(INPUT_OPTIONS.FETCH_RECORD_ID());
  if (recordId) {
    let filename = await window.showInputBox(INPUT_OPTIONS.FETCH_RECORD_FILE_NAME(`${recordId}.json`));
    if (filename) {
      await ensureDir(getPathWithFileName(`/${FILE_PATHS.DATA.directory}`));
      filename = getPathWithFileName(`/${FILE_PATHS.DATA.directory}/${filename}`);
      return { recordId, filename };
    }
  }
}

export async function fetchAndSaveRecordRecord(conn: jsforce.Connection, recordId: string, filename: string): Promise<void> {
  const results = await fetchQuoteModel(conn, recordId);
  await writeFile(filename, results);
}
