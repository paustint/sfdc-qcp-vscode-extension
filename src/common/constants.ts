import { InputBoxOptions, QuickPickItem, Uri } from 'vscode';
import { CustomScriptBase, CustomScriptFile, AuthHttp } from '../models';
import { parameterize } from './utils';
import { validateId } from './sfdc-utils';

/**
 * This file contains extension constants
 */

export const IV_LENGTH = 16; // For AES, this is always 16
export const OUTPUT_PANEL_NAME = 'SFDC QCP';
export const MEMONTO_KEYS = {
  ENC_KEY: 'ENC_KEY',
};

export const CUSTOM_SCRIPT_API_NAME = 'SBQQ__CustomScript__c';

export const REGEX = {
  ENDS_WITH_DASH_NUM: /-\d+$/,
  ANY_CHAR: /./gi,
  SRC_DIR: /\/src\//i,
};

// global settings keys
export const SETTINGS = {
  NAMESPACE: 'sfdcQcp',
  ENTRIES: {
    PUSH_ON_SAVE: 'pushOnSave',
    PRETTIER: 'prettier',
    SAVE_LOG: 'saveLog',
    MAX_LOG_ENTRIES: 'maxLogEntries',
    PRETTIER_CONFIG: 'prettierConfig',
  },
  DEFAULTS: {
    PUSH_ON_SAVE: false,
    PRETTIER: true,
    SAVE_LOG: true,
    MAX_LOG_ENTRIES: 150,
    PRETTIER_CONFIG: {
      printWidth: 140,
      parser: 'typescript',
      semi: true,
      tabWidth: 2,
      useTabs: false,
      singleQuote: true,
      trailingComma: 'all',
      bracketSpacing: true,
      arrowParens: 'avoid',
      insertPragma: false,
    },
  },
};

export const GITIGNORE_CONTENTS = `

# Added by VSCode Plugin - SFDC QCP
.qcp
.env

`;

export const QP = {
  INIT_ORG_CONFIRM: {
    YES: 'Yes - Re-initialize org.',
    NO: 'No - Use org that is currently configured.',
  },
  INIT_QCP_EXAMPLE: {
    EXAMPLE: 'Start with example QCP files.',
    PULL: 'Pull all QCP files from org.',
    EXAMPLE_AND_PULL: 'Pull all QCP files and create example QCP file.',
  },
  INIT_ORG_TYPE_QUICK_ITEM: {
    SANDBOX: 'Sandbox',
    DEV: 'Developer',
    PROD: 'Production',
    CUSTOM: 'Custom URL',
  },
  EXAMPLES: {
    ALL: 'All example files',
  },
  BACKUP_CHOOSE_SRC: {
    LOCAL: 'Local - Copy all files in src folder to backup directory.',
    REMOTE: 'Remote - Fetch all files from remote and put into backup directory.',
  },
  PUSH_ON_SAVE_CONFIRM: {
    YES: 'Yes - Push file to Salesforce.',
    NO: 'Cancel',
  },
  DELETE_REMOTE_ON_DELETE_CONFIRM: {
    YES: 'Yes - Also remove record from Salesforce.',
    NO: 'No - Keep record that exists on Salesforce.',
  },
  OVERWRITE_CONFIRM: {
    BACKUP: 'BACKUP - Backup local file before overwriting from Salesforce.',
    OVERWRITE: 'Overwrite - Overwrite local file with the code from Salesforce.',
    SKIP: 'Skip - Keep local file. (default)',
    BACKUP_ALL: 'Backup All - Backup all files that would be overwritten from Salesforce.',
    OVERWRITE_ALL: 'Overwrite All - Overwrite this file and any subsequent files.',
    SKIP_ALL: 'Skip All - Keep all local files if the content on Salesforce is different.',
    CANCEL: 'Cancel - Cancel operation. Any saved files will be kept, but all subsequent files will not be saved.',
  },
  COMPARE_CONFIRMATION: {
    LOCAL_WITH_REMOTE: 'Compare a local file with the same remote record.',
    LOCAL_WITH_ANY_REMOTE: 'Compare a local file with any remote record.',
    LOCAL_FILES: 'Compare a local file with another local file.',
    REMOTE_RECORDS: 'Compare a remote record with another remote record.',
  },
};

export const MESSAGES = {
  INIT: {
    NO_WORKSPACE: 'There is no open folder, the initialize command only works if a folder is opened.',
    SUCCESS: 'Your project has been successfully configured.',
    ORG_VALID: 'Your credential are valid.',
    ORG_INVALID: 'Your credential are invalid.',
    EXAMPLE_FILES_COPIED: `Successfully copied example files`,
  },
  PULL: {
    ALL_RECS_SUCCESS: (count: number = 0) => `Successfully downloaded and saved ${count} file${count === 1 ? '' : 's'} from Salesforce.`,
    PROGRESS_ALL: 'Downloading all QCP files from Salesforce.',
    PROGRESS_ONE: (file: string) => `Downloading ${file} from Salesforce.`,
    PROGRESS_REMOTE_LIST: `Getting list of scripts from Salesforce.`,
    MULTIPLE_REMOTE_RECORDS: (name: string) =>
      `There are multiple records on Salesforce named "${name}"` +
      ', you should rename or delete these duplicate records from Salesforce and locally.',
  },
  PUSH: {
    SUCCESS: (recordName: string) => `Successfully pushed record ${recordName} to Salesforce.`,
    SUCCESS_COUNT: (count: number) => `Successfully pushed ${count} records to Salesforce.`,
    ERROR: 'There was an error pushing this file to Salesforce.',
    ERROR_W_FILENAME: (filename: string) => `There was an error pushing ${filename} to Salesforce.`,
    ERROR_W_EX: (filename: string, message: string) => `There was an error pushing ${filename} to Salesforce. ${message}`,
    ERROR_FILE_UNTITLED: 'Please save your untitled file before pushing to Salesforce.',
    ERROR_NOTE_SRC_DIR: 'Only files in the src directory can be pushed to Salesforce.',
    ERROR_SAVING_FILE: 'There was an error saving your modified active file, please save your changes and try pushing to Salesforce again.',
    ERROR_NO_ACTIVE_FILE: 'There is no active file to push to Salesforce.',
    PROGRESS_ONE: 'Pushing file to Salesforce.',
    PROGRESS_ONE_W_FILENAME: (filename: string) => `Pushing ${filename} to Salesforce.`,
    PROGRESS_MULTI: 'Pushing files to Salesforce.',
  },
  DELETE: {
    DELETE_REMOTE_ON_DELETE_SUCCESS: (recordId: string) => `Record ${recordId} successfully deleted from Salesforce.`,
    DELETE_REMOTE_ON_DELETE_FAIL: (recordId: string) =>
      `There was an error attempting to delete record ${recordId} the record from Salesforce.`,
  },
  BACKUP: {
    IN_PROGRESS: (src: string) => `Backing up files from ${src}.`,
    SUCCESS: (src: string, folderName: string) => `Successfully backed up ${src} files to ${folderName}.`,
  },
  COMPARE: {
    SUCCESS: ``,
    REMOTE_RECORD_NOT_FOUND: (recordId: string) => `Could not find record on salesforce with Id ${recordId}.`,
  },
  FETCH: {
    IN_PROGRESS: (recordId: string) => `Fetching quoteModel for quote ${recordId}.`,
  },
};

type INPUT_OPTIONS = {
  INIT_ORG_CONFIRM: () => QuickPickItem[];
  INIT_USERNAME_INPUT: (currValue?: string) => InputBoxOptions;
  INIT_PASSWORD_INPUT: (currValue?: string) => InputBoxOptions;
  INIT_API_TOKEN_INPUT: (currValue?: string) => InputBoxOptions;
  INIT_ORG_TYPE_QUICK_ITEM: (currValue?: string) => QuickPickItem[];
  INIT_ORG_TYPE_CUSTOM_INPUT: (currValue?: string) => InputBoxOptions;
  INIT_QCP_EXAMPLE: () => QuickPickItem[];
  INIT_QCP_EXAMPLE_ALL: (files: string[]) => QuickPickItem[];
  PULL_ONE_SHOW_FILE_LIST: (files: CustomScriptFile[]) => QuickPickItem[];
  PULL_ONE_REMOTE_SHOW_FILE_LIST: (files: CustomScriptBase[]) => QuickPickItem[];
  PUSH_SHOW_FILE_LIST: (uris: Uri[]) => QuickPickItem[];
  PUSH_ON_SAVE_CONFIRM: (filename: string) => QuickPickItem[];
  DELETE_REMOTE_ON_DELETE_CONFIRM: (recordId: string, filename: string) => QuickPickItem[];
  BACKUP_CHOOSE_SRC: () => QuickPickItem[];
  OVERWRITE_CONFIRM: (filename: string) => QuickPickItem[];
  COMPARE_CONFIRMATION: () => QuickPickItem[];
  FETCH_RECORD_ID: () => InputBoxOptions;
  FETCH_RECORD_FILE_NAME: (currValue: string) => InputBoxOptions;
};

export const INPUT_OPTIONS: INPUT_OPTIONS = {
  INIT_ORG_CONFIRM: () => [{ label: QP.INIT_ORG_CONFIRM.YES }, { label: QP.INIT_ORG_CONFIRM.NO }],
  INIT_USERNAME_INPUT: (currValue?: string) => ({
    prompt: 'Enter your Salesforce Username',
    ignoreFocusOut: true,
    value: currValue,
  }),
  INIT_PASSWORD_INPUT: (currValue?: string) => ({
    prompt: 'Enter your Salesforce Password',
    password: true,
    ignoreFocusOut: true,
    value: currValue,
  }),
  INIT_API_TOKEN_INPUT: (currValue?: string) => ({
    prompt: 'Enter your API Token (Required if your IP address is not white listed)',
    password: false,
    ignoreFocusOut: true,
    value: currValue,
  }),
  INIT_ORG_TYPE_QUICK_ITEM: (currValue?: string) => [
    {
      label: QP.INIT_ORG_TYPE_QUICK_ITEM.SANDBOX,
      description: 'https://test.salesforce.com',
      picked: currValue === QP.INIT_ORG_TYPE_QUICK_ITEM.SANDBOX,
    },
    {
      label: QP.INIT_ORG_TYPE_QUICK_ITEM.DEV,
      description: 'https://login.salesforce.com',
      picked: currValue === QP.INIT_ORG_TYPE_QUICK_ITEM.DEV,
    },
    {
      label: QP.INIT_ORG_TYPE_QUICK_ITEM.PROD,
      description: 'https://login.salesforce.com',
      picked: currValue === QP.INIT_ORG_TYPE_QUICK_ITEM.PROD,
    },
    {
      label: QP.INIT_ORG_TYPE_QUICK_ITEM.CUSTOM,
      description: 'https://{domain}.my.salesforce.com',
      picked: currValue === QP.INIT_ORG_TYPE_QUICK_ITEM.CUSTOM,
    },
  ],
  INIT_ORG_TYPE_CUSTOM_INPUT: (currValue?: string) => {
    const value = currValue || 'https://domain.my.salesforce.com';
    return {
      ignoreFocusOut: true,
      placeHolder: '',
      prompt: 'Custom URL',
      value,
      valueSelection: [8, value.indexOf('.my') || 14],
    };
  },
  INIT_QCP_EXAMPLE: () => [
    { label: QP.INIT_QCP_EXAMPLE.EXAMPLE, picked: true, alwaysShow: true },
    { label: QP.INIT_QCP_EXAMPLE.PULL, picked: false, alwaysShow: true },
    { label: QP.INIT_QCP_EXAMPLE.EXAMPLE_AND_PULL, picked: true, alwaysShow: true },
  ],
  INIT_QCP_EXAMPLE_ALL: (files: string[]) => {
    const items: QuickPickItem[] = [{ label: QP.EXAMPLES.ALL, alwaysShow: true }];
    files.forEach(file => {
      items.push({ label: file, alwaysShow: true });
    });
    return items;
  },
  PULL_ONE_SHOW_FILE_LIST: (files: CustomScriptFile[]) => {
    return files.map(file => ({ label: file.fileName, picked: false }));
  },
  PULL_ONE_REMOTE_SHOW_FILE_LIST: (records: CustomScriptBase[]) => {
    return records.map(record => ({
      label: record.Name,
      description: record.Id,
      detail: `Last Modified by ${(record.LastModifiedBy || record.CreatedBy).Username} at ${record.LastModifiedDate.substring(0, 19)}`,
      picked: false,
    }));
  },
  PUSH_SHOW_FILE_LIST: (uris: Uri[]) => {
    return uris.map(uri => ({ label: uri.fsPath, picked: false }));
  },
  PUSH_ON_SAVE_CONFIRM: (filename: string) => [
    { label: QP.PUSH_ON_SAVE_CONFIRM.YES, detail: filename },
    { label: QP.PUSH_ON_SAVE_CONFIRM.NO },
  ],
  DELETE_REMOTE_ON_DELETE_CONFIRM: (recordId: string, filename: string) => [
    { label: QP.DELETE_REMOTE_ON_DELETE_CONFIRM.YES, description: recordId, detail: filename },
    { label: QP.DELETE_REMOTE_ON_DELETE_CONFIRM.NO },
  ],
  BACKUP_CHOOSE_SRC: () => [{ label: QP.BACKUP_CHOOSE_SRC.LOCAL, picked: true }, { label: QP.BACKUP_CHOOSE_SRC.REMOTE, picked: false }],
  OVERWRITE_CONFIRM: (filename: string) => [
    { label: QP.OVERWRITE_CONFIRM.BACKUP, detail: `Current File: ${filename}`, alwaysShow: true },
    { label: QP.OVERWRITE_CONFIRM.OVERWRITE, detail: `Current File: ${filename}`, alwaysShow: true },
    { label: QP.OVERWRITE_CONFIRM.SKIP, detail: `Current File: ${filename}`, alwaysShow: true },
    { label: QP.OVERWRITE_CONFIRM.BACKUP_ALL, detail: `Current File: ${filename}`, alwaysShow: true },
    { label: QP.OVERWRITE_CONFIRM.OVERWRITE_ALL, detail: `Current File: ${filename}`, alwaysShow: true },
    { label: QP.OVERWRITE_CONFIRM.SKIP_ALL, detail: `Current File: ${filename}`, alwaysShow: true },
    { label: QP.OVERWRITE_CONFIRM.CANCEL, detail: `Current File: ${filename}`, alwaysShow: true },
  ],
  COMPARE_CONFIRMATION: () => [
    { label: QP.COMPARE_CONFIRMATION.LOCAL_WITH_REMOTE },
    { label: QP.COMPARE_CONFIRMATION.LOCAL_WITH_ANY_REMOTE },
    { label: QP.COMPARE_CONFIRMATION.LOCAL_FILES },
    { label: QP.COMPARE_CONFIRMATION.REMOTE_RECORDS },
  ],
  FETCH_RECORD_ID: () => ({
    prompt: 'Enter a Quote Record Id to Fetch',
    password: false,
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (validateId(value || '')) {
        return null;
      } else {
        return 'Enter a valid 15 or 18 digit id';
      }
    },
  }),
  FETCH_RECORD_FILE_NAME: (currValue: string) => ({
    prompt: 'What would you like the file to be named?',
    password: false,
    ignoreFocusOut: true,
    value: currValue,
    validateInput: (value: string) => {
      if (value.toLowerCase().endsWith('json')) {
        return null;
      } else {
        return 'The file extension must be json';
      }
    },
  }),
};

export const FILE_PATHS = {
  CONFIG: {
    target: '.qcp/qcp-config.json',
  },
  LOG: {
    target: '.qcp/qcp-log.json',
    backup: '.qcp/qcp-log.bak.json',
  },
  README: {
    source: 'README.md',
    target: 'README.md',
  },
  TSCONFIG: {
    source: 'tsconfig.json',
    target: 'tsconfig.json',
  },
  PACKAGE_JSON: {
    source: 'package.json',
    target: 'package.json',
  },
  PRETTIER: {
    source: 'prettierrc',
    target: '.prettierrc',
  },
  QCP: {
    source: 'src/qcp-example.ts',
    target: 'src/qcp-example.ts',
  },
  TESTS: {
    source: 'tests',
    target: 'tests',
  },
  ENV: {
    source: '.env',
    target: '.env',
  },
  SRC: 'src',
  DATA: {
    directory: 'data',
  },
};

const QUERY_FIELDS_BASE = `Id, Name`;
const QUERY_FIELDS_USER_FIELDS = `CreatedById, CreatedDate, LastModifiedById, LastModifiedDate, CreatedBy.Id, CreatedBy.Name, CreatedBy.Username, LastModifiedBy.Id, LastModifiedBy.Name, LastModifiedBy.Username`;
const QUERY_FIELDS_WO_CODE = `${QUERY_FIELDS_BASE}, ${QUERY_FIELDS_USER_FIELDS}`;
const QUERY_FIELDS_ALL = `${QUERY_FIELDS_WO_CODE}, SBQQ__Code__c, SBQQ__TranspiledCode__c, SBQQ__GroupFields__c, SBQQ__QuoteFields__c, SBQQ__QuoteLineFields__c`;

export const QUERIES = {
  ALL_WITHOUT_CODE: () => `SELECT ${QUERY_FIELDS_WO_CODE} FROM SBQQ__CustomScript__c`,
  ALL_RECS: () => `SELECT ${QUERY_FIELDS_ALL} FROM SBQQ__CustomScript__c`,
  BY_ID_RECS: (id: string) => `SELECT ${QUERY_FIELDS_ALL} FROM SBQQ__CustomScript__c WHERE Id = '${id}'`,
  BY_NAME_RECS: (name: string) => `SELECT ${QUERY_FIELDS_ALL} FROM SBQQ__CustomScript__c WHERE Name = '${name}'`,
  BY_NAME_RECS_NO_CODE: (name: string) => `SELECT ${QUERY_FIELDS_WO_CODE} FROM SBQQ__CustomScript__c WHERE Name = '${name}'`,
  BY_NAME_RECS_COUNT: (name: string) => `SELECT count() FROM SBQQ__CustomScript__c WHERE Name = '${name}'`,
};

export const client_id = '3MVG9KsVczVNcM8yH1pNeimwzaNciPgPq5lCmYI32we9ERWVHCx.vFaFRs9ejsGSHDoWyb8RGInzZJjAHJsQa';

/**
 * Note: we are not providing a client_secret, and JSForce does not support omitting this paramter
 * This is why the URL is being built manually
 */
export const AUTH_HTTP: AuthHttp = {
  getUserAgentAuth: {
    url: (domain: string) => {
      const params = parameterize({
        response_type: `token`,
        client_id,
        scope: `api refresh_token web`,
        redirect_uri: 'vscode://paustint.sfdc-qcp-vscode-extension/auth_callback',
        prompt: 'login',
      });
      return `${domain}/services/oauth2/authorize?${params}`;
    },
  },
};
