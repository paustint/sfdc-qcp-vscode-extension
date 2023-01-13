import { readdir, readFile, writeFile } from 'fs-extra';
import * as _ from 'lodash';
import { ExtensionContext, QuickPickItem, window, workspace } from 'vscode';
import { GITIGNORE_CONTENTS, INPUT_OPTIONS, QP } from '../common/constants';
import { OrgInfo, OrgType } from '../models';
import { getPathWithFileName } from '../common/utils';
import { authenticateUser } from '../common/sfdc-utils';
import axios from 'axios';

/**
 * Get credentials
 */
export async function initializeOrgs(orgInfo: OrgInfo): Promise<OrgInfo | undefined> {
  orgInfo = { ...orgInfo };

  const loginUrl = await getOrgType(orgInfo);
  if (_.isNil(loginUrl)) {
    return;
  }
  orgInfo.loginUrl = loginUrl;

  const authInfo = await authenticateUser(loginUrl);

  try {
    const response = await axios.get(authInfo.id, {
      headers: { Authorization: `Bearer ${authInfo.access_token}` },
    });
    orgInfo.username = response.data.username;
  } catch (ex) {
    console.warn('Error getting username', ex);
  }

  orgInfo.authInfo = authInfo;

  return orgInfo;
}

/**
 * Allow user to specify the org type or custom login URL
 */
async function getOrgType(orgInfo: OrgInfo): Promise<string | undefined> {
  const items: QuickPickItem[] = INPUT_OPTIONS.INIT_ORG_TYPE_QUICK_ITEM(orgInfo.orgType);

  const pickedItem = await window.showQuickPick(items, { canPickMany: false, ignoreFocusOut: true });

  if (pickedItem) {
    orgInfo.orgType = pickedItem.label as OrgType;
    if (pickedItem.label === QP.INIT_ORG_TYPE_QUICK_ITEM.CUSTOM) {
      return await window.showInputBox(INPUT_OPTIONS.INIT_ORG_TYPE_CUSTOM_INPUT(orgInfo.loginUrl));
    }
    return pickedItem.description;
  }
}

export async function createOrUpdateGitignore(): Promise<boolean> {
  const existingGitIgnore = (await workspace.findFiles('.gitignore', null, 1))[0];
  let fileToUpdateOrCreate: string = '';
  let filePath;
  if (existingGitIgnore) {
    filePath = existingGitIgnore.fsPath;
    // search through and see if .qcp exists in it, if not, add it
    const gitignore = await readFile(existingGitIgnore.fsPath, 'UTF-8');
    const lines = gitignore.split('\n');
    const existingQcpIdx = lines.findIndex(line => line.trim() === '.qcp');

    if (existingQcpIdx < 0) {
      fileToUpdateOrCreate += gitignore + GITIGNORE_CONTENTS;
    }

    if (!fileToUpdateOrCreate) {
      const existingEnvIdx = lines.findIndex(line => line.trim() === '.env');
      if (existingEnvIdx < 0) {
        fileToUpdateOrCreate += gitignore + `\n.env\n`;
      }
    }
  } else {
    filePath = getPathWithFileName('.gitignore');
    // create the file!
    fileToUpdateOrCreate = GITIGNORE_CONTENTS;
  }
  if (fileToUpdateOrCreate) {
    await writeFile(filePath, fileToUpdateOrCreate);
    return true;
  }
  return false;
}

export async function getExampleFilesToCreate(context: ExtensionContext): Promise<{ picked: string[]; all: string[] } | undefined> {
  const srcPath = context.asAbsolutePath(`extension-files/src`);

  const exampleFiles = await readdir(srcPath);

  const pickedFiles = await window.showQuickPick(INPUT_OPTIONS.INIT_QCP_EXAMPLE_ALL(exampleFiles), { canPickMany: true });
  console.log('pickedFiles', pickedFiles);
  if (pickedFiles && pickedFiles.length > 0) {
    return {
      picked: pickedFiles.map(file => file.label),
      all: exampleFiles,
    };
  }
}
