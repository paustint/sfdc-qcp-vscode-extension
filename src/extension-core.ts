import * as jsforce from 'jsforce';
import { basename } from 'path';
import {
  commands,
  Disposable,
  ExtensionContext,
  OutputChannel,
  ProgressLocation,
  TextDocument,
  TextEditor,
  Uri,
  window,
  workspace,
} from 'vscode';
import { FILE_PATHS, INPUT_OPTIONS, MEMONTO_KEYS, MESSAGES, OUTPUT_PANEL_NAME, QP, REGEX, SETTINGS } from './common/constants';
import * as fileLogger from './common/file-logger';
import { deleteRecord, getFrontDoorUrl, initConnection, onAuthInfoChange, onConnChange } from './common/sfdc-utils';
import {
  copyExtensionFileToProject,
  copyExtensionFolderToProject,
  fileExists,
  findActiveFileFromConfig,
  generateEncryptionKey,
  getPathWithFileName,
  getSfdcUri,
  logRecords,
  readAsJson,
  readConfig,
  saveConfig,
  setEncryptionKey,
  updateContextIfActiveQcpFile,
  writeFileAsJson,
} from './common/utils';
import { backupFromRemote, backupLocal } from './flows/backup';
import { compareLocalFiles, compareLocalWithRemote, compareRemoteRecords } from './flows/diff';
import { fetchAndSaveRecordRecord, getRecordName } from './flows/fetch-records';
import { createOrUpdateGitignore, getExampleFilesToCreate, initializeOrgs } from './flows/init';
import { queryFilesAndSave } from './flows/pull';
import { getFilesToPush, pushFile } from './flows/push';
import { ConfigData, ConfigDataEncrypted, CustomScriptFile, OrgInfo, StringOrUndefined } from './models';
import { SfdcTextDocumentProvider } from './providers/sfdc-text-document-provider';

export let outputChannel: OutputChannel;

export class QcpExtension {
  private configData: ConfigData = {
    orgInfo: {},
    files: [],
  };

  conn: jsforce.Connection | undefined;

  private subscriptions: Disposable[];

  constructor(private context: ExtensionContext, public sfdcDocumentProvider: SfdcTextDocumentProvider) {
    this.subscriptions = context.subscriptions;
    outputChannel = window.createOutputChannel(OUTPUT_PANEL_NAME);

    onAuthInfoChange.event((orgInfo: OrgInfo) => {
      this.configData.orgInfo = orgInfo;
      try {
        saveConfig(this.configData);
      } catch (ex) {
        console.log('[AUTH] Error saving orgInfo', ex.message);
      }
    });

    onConnChange.event((conn: jsforce.Connection | undefined) => {
      this.conn = conn;

      if (this.conn) {
        this.conn.on('refresh', async accessToken => {
          console.log('[AUTH] Token refreshed');
          if (this.configData.orgInfo.authInfo) {
            this.configData.orgInfo.authInfo.access_token = accessToken;
            try {
              saveConfig(this.configData);
            } catch (ex) {
              console.log('[AUTH] Error saving orgInfo', ex.message);
            }
          }
        });
      }
    });

    // Register
    this.registerListeners();
    this.initProject()
      .then(() => {
        console.log('[INIT] Project Initialized');
        this.addConnToDocumentProvider();
      })
      .catch(err => {
        console.log('[INIT] Error initializing', err);
      });
  }

  registerListeners() {
    this.context.subscriptions.push(workspace.onDidSaveTextDocument(this.onSave, this, this.subscriptions));
    this.context.subscriptions.push(window.onDidChangeActiveTextEditor(this.onActiveTextEditorChanged, this, this.subscriptions));
    const fsWatcher = workspace.createFileSystemWatcher('**/src/*.ts', true, true, false);
    this.context.subscriptions.push(fsWatcher.onDidDelete(this.onDelete, this, this.subscriptions));
  }

  async addConnToDocumentProvider() {
    try {
      this.conn = await initConnection(this.configData.orgInfo, this.conn);
      this.sfdcDocumentProvider.updateConn(this.conn);
    } catch (ex) {
      console.log('[PROVIDERS] Error registering providers');
    }
  }

  async getOrCreateEncryptionKey(): Promise<string> {
    let encryptionKey: string = this.context.workspaceState.get(MEMONTO_KEYS.ENC_KEY) || '';
    if (!encryptionKey) {
      encryptionKey = generateEncryptionKey();
      await this.context.workspaceState.update(MEMONTO_KEYS.ENC_KEY, encryptionKey);
    }
    setEncryptionKey(encryptionKey);
    return encryptionKey;
  }

  async initProject(): Promise<void> {
    if (workspace.name && workspace.rootPath) {
      await this.getOrCreateEncryptionKey();
      const existingConfig = (await workspace.findFiles(FILE_PATHS.CONFIG.target, null, 1))[0];
      if (existingConfig) {
        this.configData = await readConfig(readAsJson<ConfigData | ConfigDataEncrypted>(existingConfig.fsPath));
        fileLogger.init();
        if (this.configData.orgInfo.authInfo) {
          this.testCredentials();
        }
        await saveConfig(this.configData);
        console.log('[INIT] Project is SFDC QCP project.');
      }
    }
    if (window.activeTextEditor) {
      updateContextIfActiveQcpFile(window.activeTextEditor.document);
    }
  }

  /**
   *
   * COMMANDS
   *
   */

  /**
   * COMMAND: Test Credentials
   * Checks to see if credentials are valid
   * NOTE: this is called from the INIT() command, and also called the INIT() command if user chooses to re-initialize
   */
  async testCredentials(): Promise<boolean> {
    try {
      await initConnection(this.configData.orgInfo, this.conn, true);
      window.showInformationMessage(MESSAGES.INIT.ORG_VALID);
      outputChannel.appendLine(`Credentials are valid for org ${this.configData.orgInfo.username}.`);
      return true;
    } catch (ex) {
      const action = await window.showErrorMessage(MESSAGES.INIT.ORG_INVALID, 'Re-Initialize');
      if (action === 'Re-Initialize') {
        await this.init(true);
      }
      return false;
    }
  }

  /**
   * COMMAND: Initialize
   * This sets up a new project, or allows user to re-enter credentials
   * This will create all config/example files if they don't already exist
   */
  async init(isReInit?: boolean): Promise<StringOrUndefined> {
    if (!workspace.name || !workspace.rootPath) {
      return window.showErrorMessage(MESSAGES.INIT.NO_WORKSPACE);
    }

    /** Configure Connections */

    let doInitOrgs = true;

    // TODO: check if user needs to be authenticated

    if (this.configData.orgInfo.authInfo) {
      doInitOrgs = false;
      const orgConfirm = await window.showQuickPick(INPUT_OPTIONS.INIT_ORG_CONFIRM());
      doInitOrgs = orgConfirm && orgConfirm.label === QP.INIT_ORG_CONFIRM.YES ? true : false;
    }

    if (doInitOrgs) {
      try {
        const orgInfo = await initializeOrgs(this.configData.orgInfo);
        this.conn = undefined;
        if (orgInfo) {
          this.configData.orgInfo = orgInfo;
          await saveConfig(this.configData);
          this.conn = await initConnection(this.configData.orgInfo, this.conn);
          this.addConnToDocumentProvider();
          outputChannel.appendLine(`Successfully authenticated org ${this.configData.orgInfo.username}`);
        } else {
          return;
        }
      } catch (ex) {
        console.warn(ex);
        return window.showErrorMessage(`Error initializing org: ${ex.message}.`);
      }
    }

    try {
      // This will ignore copying if the files do not already exist
      const savedConfigFiles: string[] = [];
      if (await copyExtensionFileToProject(this.context, FILE_PATHS.README.source, FILE_PATHS.README.target)) {
        savedConfigFiles.push('README.md');
      }
      if (await copyExtensionFileToProject(this.context, FILE_PATHS.TSCONFIG.source, FILE_PATHS.TSCONFIG.target)) {
        savedConfigFiles.push('tsconfig.json');
      }
      if (await copyExtensionFileToProject(this.context, FILE_PATHS.PACKAGE_JSON.source, FILE_PATHS.PACKAGE_JSON.target)) {
        savedConfigFiles.push('package.json');
      }
      if (await copyExtensionFileToProject(this.context, FILE_PATHS.ENV.source, FILE_PATHS.ENV.target)) {
        savedConfigFiles.push('package.json');
      }
      if (await copyExtensionFolderToProject(this.context, FILE_PATHS.TESTS.source, FILE_PATHS.TESTS.target)) {
        savedConfigFiles.push('/tests/*');
      }
      if (await createOrUpdateGitignore()) {
        savedConfigFiles.push('.gitignore');
      }
      const prettier = workspace.getConfiguration(SETTINGS.NAMESPACE).get<boolean>(SETTINGS.ENTRIES.PRETTIER);
      const prettierConfig = workspace.getConfiguration(SETTINGS.NAMESPACE).get<boolean>(SETTINGS.ENTRIES.PRETTIER_CONFIG);
      if (prettier && prettierConfig) {
        try {
          if (!(await fileExists(FILE_PATHS.PRETTIER.target))) {
            await writeFileAsJson(getPathWithFileName(FILE_PATHS.PRETTIER.target), prettierConfig);
            savedConfigFiles.push('.prettierrc');
          }
        } catch (ex) {
          return window.showErrorMessage(`Error initializing .prettierrc: ${ex.message}`);
        }
      }

      if (savedConfigFiles.length > 0) {
        window.showInformationMessage(`Created/Updated files: ${savedConfigFiles.join(', ')}.`);
        outputChannel.appendLine(`Created/Updated files: ${savedConfigFiles.join(', ')}.`);
      }
    } catch (ex) {
      outputChannel.appendLine(`Error initializing project: ${ex.message}.`);
      return window.showErrorMessage(`Error initializing project: ${ex.message}`);
    }

    await this.testCredentials();

    // Create example QCP file or pull all from org
    try {
      const hasExistingFiles = await fileExists('src/*.ts');
      if (!hasExistingFiles) {
        const pickedItem = await window.showQuickPick(INPUT_OPTIONS.INIT_QCP_EXAMPLE());
        if (pickedItem) {
          if (pickedItem.label === QP.INIT_QCP_EXAMPLE.EXAMPLE) {
            await this.initExampleFiles();
          } else {
            if (pickedItem.label === QP.INIT_QCP_EXAMPLE.EXAMPLE_AND_PULL) {
              await this.initExampleFiles();
            }
            await queryFilesAndSave(this.configData, { conn: this.conn });
          }
        }
      }
    } catch (ex) {
      return window.showErrorMessage('Error initializing project: ', ex.message);
    }
  }

  /**
   * COMMAND: Initialize Example Files
   * This sets up a new project, or allows user to re-enter credentials
   * This will create all config/example files if they don't already exist
   */
  async initExampleFiles() {
    try {
      const output = await getExampleFilesToCreate(this.context);
      if (output) {
        const { picked, all } = output;
        let filesToCopy = picked;
        if (picked && picked.length > 0) {
          if (picked.find(item => item === QP.EXAMPLES.ALL)) {
            filesToCopy = all;
          }
          for (let file of filesToCopy) {
            await copyExtensionFileToProject(this.context, `src/${file}`, `src/${file}`, true);
            window.showInformationMessage(MESSAGES.INIT.EXAMPLE_FILES_COPIED);
          }
          outputChannel.appendLine(`Created example files ${filesToCopy.join(', ')}.`);
        }
      }
    } catch (ex) {
      console.log('Error copying example files', ex);
      window.showErrorMessage(ex.message);
    }
  }

  /**
   * COMMAND: PULL FILES
   * This pulls all files from SFDC, saves them the the /src directory, and adds an entry in the config for this file
   */
  async pullFiles() {
    // TODO: ask user if they want to overwrite from remote, Y/N/ask for each

    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: MESSAGES.PULL.PROGRESS_ALL,
        cancellable: false,
      },
      async (progress, token) => {
        try {
          const records = await queryFilesAndSave(this.configData, { conn: this.conn });
          window.showInformationMessage(MESSAGES.PULL.ALL_RECS_SUCCESS(records.length));
          logRecords(outputChannel, 'Pulled Records', records);
          return;
        } catch (ex) {
          window.showErrorMessage(ex.message, { modal: true });
          return;
        }
      },
    );
  }

  /**
   * COMMAND: PULL FILE
   * This pulls one file, chosen by the user, from SFDC, and saves the file to the /src directory and updates the entry in the config
   * @deprecated 4.6.19
   */
  // async pullFile() {
  //   try {
  //     const customScriptFile = await getFileToPull(this.configData);
  //     if (customScriptFile) {
  //       window.withProgress(
  //         {
  //           location: ProgressLocation.Notification,
  //           title: MESSAGES.PULL.PROGRESS_ONE(customScriptFile.fileName),
  //           cancellable: false,
  //         },
  //         async (progress, token) => {
  //           try {
  //             const records = await queryFilesAndSave(this.configData, { conn: this.conn, customScriptFile, clearFileData: false });
  //             window.showInformationMessage(MESSAGES.PULL.ALL_RECS_SUCCESS(records.length));
  //             logRecords(outputChannel, 'Pulled Records', records);
  //             return;
  //           } catch (ex) {
  //             window.showErrorMessage(ex.message, { modal: true });
  //             return;
  //           }
  //         },
  //       );
  //     }
  //   } catch (ex) {
  //     console.log('Error pulling', ex);
  //   }
  // }

  /**
   * COMMAND: PULL ACTIVE FILE
   */
  async pullActive() {
    try {
      const customScriptFile = findActiveFileFromConfig(this.configData);

      if (customScriptFile) {
        window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: MESSAGES.PULL.PROGRESS_ONE(customScriptFile.fileName),
            cancellable: false,
          },
          async (progress, token) => {
            try {
              const records = await queryFilesAndSave(this.configData, {
                conn: this.conn,
                customScriptFile,
                clearFileData: false,
                overwriteAll: true,
              });
              window.showInformationMessage(MESSAGES.PULL.ALL_RECS_SUCCESS(records.length));
              logRecords(outputChannel, 'Pulled Records', records);
              return;
            } catch (ex) {
              window.showErrorMessage(ex.message, { modal: true });
              return;
            }
          },
        );
      }
    } catch (ex) {
      console.log('Error pulling', ex);
    }
  }

  /**
   * COMMAND: PULL REMOTE FILE
   * Get list of files on SFDC and pull specific file
   * @deprecated 4.6.19
   */
  // async pullRemoteFile() {
  //   try {
  //     const records = await getRemoteFiles(this.configData, this.conn);
  //     if (records) {
  //       window.showInformationMessage(MESSAGES.PULL.ALL_RECS_SUCCESS(records.length));
  //       logRecords(outputChannel, 'Pulled Records', records);
  //     }
  //   } catch (ex) {
  //     console.log('Error pulling remove file', ex);
  //     window.showErrorMessage(ex.message);
  //   }
  // }

  /**
   * COMMAND: PUSH FILE
   * Allows user to specify a file to push to SFDC
   */
  async pushFiles() {
    try {
      const files = await getFilesToPush();
      if (files) {
        window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: files.length > 1 ? MESSAGES.PUSH.PROGRESS_MULTI : MESSAGES.PUSH.PROGRESS_ONE,
            cancellable: true,
          },
          async (progress, token) => {
            const total = files.length;
            let increment = 100 / total;
            let count = 0;

            let updatedRecords = [];

            for (let file of files) {
              count++;
              if (token.isCancellationRequested) {
                break;
              }
              try {
                const updatedRecord = await pushFile(this.configData, file, this.conn);
                if (updatedRecord) {
                  updatedRecords.push(updatedRecord);
                } else {
                  window.showErrorMessage(MESSAGES.PUSH.ERROR);
                }
                // TODO: re-query record (maybe in pushFile)
              } catch (ex) {
                window.showErrorMessage(ex.message);
              }
              progress.report({ increment, message: `Uploading file ${count} of ${total}` });
            }

            if (updatedRecords.length > 0) {
              if (updatedRecords.length === 1) {
                window.showInformationMessage(MESSAGES.PUSH.SUCCESS(updatedRecords[0].Name));
              } else {
                window.showInformationMessage(MESSAGES.PUSH.SUCCESS_COUNT(updatedRecords.length));
              }
              logRecords(outputChannel, 'Pushed Records', updatedRecords);
            }
          },
        );
      }
    } catch (ex) {
      window.showErrorMessage(ex.message);
    }
  }

  /**
   * COMMAND: PUSH ACTIVE FILE
   */
  async pushActiveFile() {
    try {
      if (window.activeTextEditor) {
        const activeDocument = window.activeTextEditor.document;
        console.log('activeDocument', activeDocument);

        if (!REGEX.SRC_DIR.test(activeDocument.uri.path)) {
          return window.showErrorMessage(MESSAGES.PUSH.ERROR_NOTE_SRC_DIR);
        }

        if (activeDocument.isUntitled) {
          return window.showErrorMessage(MESSAGES.PUSH.ERROR_FILE_UNTITLED);
        }

        try {
          let requiresSave = activeDocument.isUntitled || activeDocument.isDirty;
          if (requiresSave) {
            const saveSuccess = await activeDocument.save();
            console.log('activeDocument after save', activeDocument);
            console.log('saveSuccess', saveSuccess);
            if (!saveSuccess || activeDocument.isClosed) {
              return window.showErrorMessage(MESSAGES.PUSH.ERROR_SAVING_FILE);
            }
          }

          const friendlyFilename = basename(activeDocument.uri.fsPath);

          window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: MESSAGES.PUSH.PROGRESS_ONE_W_FILENAME(friendlyFilename),
              cancellable: false,
            },
            async (progress, token) => {
              try {
                const updatedRecord = await pushFile(this.configData, activeDocument.uri.fsPath, this.conn);
                if (updatedRecord) {
                  window.showInformationMessage(MESSAGES.PUSH.SUCCESS(updatedRecord.Name));
                  logRecords(outputChannel, 'Pushed Records', [updatedRecord]);
                } else {
                  window.showErrorMessage(MESSAGES.PUSH.ERROR_W_FILENAME(friendlyFilename));
                }
              } catch (ex) {
                console.warn('Exception pushing file', ex);
                window.showErrorMessage(MESSAGES.PUSH.ERROR_W_EX(friendlyFilename, ex.message));
              } finally {
                return;
              }
            },
          );
        } catch (ex) {
          console.log('Error saving untitled file', ex);
          window.showErrorMessage(ex.message);
        }
      } else {
        return window.showErrorMessage(MESSAGES.PUSH.ERROR_NO_ACTIVE_FILE);
      }
    } catch (ex) {
      window.showErrorMessage(ex.message);
    }
  }

  /**
   * COMMAND: PUSH ALL FILES
   * Saves all files to SFDC
   * @deprecated 4.6.19
   */
  // async pushAllFiles() {
  //   try {
  //     const pickedItem = await window.showQuickPick(INPUT_OPTIONS.PUSH_ALL_CONFIRM());
  //     if (pickedItem && pickedItem.label === INPUT_OPTIONS.PUSH_ALL_CONFIRM()[0].label) {
  //       window.withProgress(
  //         {
  //           location: ProgressLocation.Notification,
  //           title: MESSAGES.PUSH.PROGRESS_MULTI,
  //           cancellable: true,
  //         },
  //         async (progress, token) => {
  //           const existingFiles = await getAllSrcFiles();
  //           const total = existingFiles.length;
  //           let increment = 100 / total;
  //           let count = 0;

  //           outputChannel.appendLine('\n******************** Pushed Files ********************');

  //           for (const file of existingFiles) {
  //             count++;
  //             if (token.isCancellationRequested) {
  //               window.showInformationMessage(`Remaining files cancelled`);
  //               break;
  //             }
  //             try {
  //               const record = await pushFile(this.configData, file.fsPath, this.conn);
  //               if (record) {
  //                 outputChannel.appendLine(`- [SUCCESS] ${record.Name} (${record.Id})`);
  //                 window.showInformationMessage(`Successfully pushed ${record.Name}.`);
  //               }
  //             } catch (ex) {
  //               outputChannel.appendLine(`- [FAILURE] ${file.path} (${ex.message})`);
  //               window.showErrorMessage(`Error uploading file: ${ex.message}.`);
  //             } finally {
  //               progress.report({ increment, message: `Uploading file ${count} of ${total}` });
  //             }
  //           }
  //         },
  //       );
  //     }
  //   } catch (ex) {}
  // }

  /**
   * COMMAND: Backup
   * Allows user to copy all local files to a backup folder
   * Allows user to copy all remote records to a backup folder
   */
  async backup() {
    try {
      const pickedOption = await window.showQuickPick(INPUT_OPTIONS.BACKUP_CHOOSE_SRC());
      if (pickedOption) {
        const isLocal = pickedOption.label === QP.BACKUP_CHOOSE_SRC.LOCAL;

        window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: MESSAGES.BACKUP.IN_PROGRESS(isLocal ? 'src directory' : 'Salesforce'),
            cancellable: false,
          },
          async (progress, token) => {
            try {
              if (isLocal) {
                const folderName = await backupLocal();
                window.showInformationMessage(MESSAGES.BACKUP.SUCCESS('local', folderName));
                outputChannel.appendLine(`Backed up local files to folder ${folderName}`);
              } else {
                const folderName = await backupFromRemote(this.configData, this.conn);
                window.showInformationMessage(MESSAGES.BACKUP.SUCCESS('remote', folderName));
                outputChannel.appendLine(`Backed up remote records to folder ${folderName}`);
              }
            } catch (ex) {
              console.log(ex);
              window.showErrorMessage(`Error backup up files: ${ex.message}.`);
              outputChannel.appendLine(`Error backup up files: ${ex.message}.`);
            }
          },
        );
      }
    } catch (ex) {}
  }

  /**
   * COMMAND: Compare
   * Compares a local file with a remote record
   */
  async diff(useActiveFile = false) {
    try {
      if (useActiveFile && window.activeTextEditor) {
        await compareLocalWithRemote(true, this.configData, this.conn, window.activeTextEditor.document.uri.fsPath);
        return;
      }

      const pickedOption = await window.showQuickPick(INPUT_OPTIONS.COMPARE_CONFIRMATION());
      if (pickedOption) {
        // pick local file

        switch (pickedOption.label) {
          case QP.COMPARE_CONFIRMATION.LOCAL_WITH_REMOTE: {
            await compareLocalWithRemote(true, this.configData, this.conn);
            break;
          }
          case QP.COMPARE_CONFIRMATION.LOCAL_WITH_ANY_REMOTE: {
            await compareLocalWithRemote(false, this.configData, this.conn);
            break;
          }
          case QP.COMPARE_CONFIRMATION.LOCAL_FILES: {
            await compareLocalFiles();
            break;
          }
          case QP.COMPARE_CONFIRMATION.REMOTE_RECORDS: {
            await compareRemoteRecords(this.configData, this.conn);
            break;
          }
          default: {
            break;
          }
        }
      }
    } catch (ex) {
      console.log(ex);
      window.showErrorMessage(`Error comparing files: ${ex.message}.`);
    }
  }

  /**
   * COMMAND: VIEW FILE FROM SALESFORCE
   * Compares a local file with a remote record
   * @deprecated 4.6.19
   */
  // async viewFromSalesforce() {
  //   try {
  //     const conn = await initConnection(this.configData.orgInfo, this.conn);
  //     const remoteFile = await pickRemoteFile(conn);
  //     if (remoteFile) {
  //       await commands.executeCommand('vscode.open', remoteFile.uri);
  //     }
  //   } catch (ex) {
  //     console.log(ex);
  //     window.showErrorMessage(`Error comparing files: ${ex.message}.`);
  //   }
  // }

  /**
   * COMMAND: VIEW TRANSPILED CODE FOR CURRENT FILE
   */
  async viewTranspiledCodeFromSalesforce() {
    try {
      const customScriptFile = findActiveFileFromConfig(this.configData);

      if (customScriptFile) {
        const remoteFileUri = getSfdcUri(customScriptFile.record.Id, 'field=SBQQ__TranspiledCode__c');
        await commands.executeCommand('vscode.open', remoteFileUri);
      }
    } catch (ex) {
      console.log('Error viewing transpiled code', ex);
    }
  }

  /**
   * COMMAND: VIEW ACTIVE FILE IN SAMESFORCE
   */
  async viewActiveFileInSalesforce() {
    const foundFileConfig = findActiveFileFromConfig(this.configData);
    if (foundFileConfig) {
      try {
        const conn = await initConnection(this.configData.orgInfo, this.conn, false);
        const url = getFrontDoorUrl(conn, foundFileConfig.record.Id);
        commands.executeCommand('vscode.open', Uri.parse(url));
      } catch (ex) {
        window.showErrorMessage(`Error authenticating org: ${ex.message}.`);
      }
    }
  }

  /**
   * COMMAND: VIEW ACTIVE FILE IN SAMESFORCE
   */
  async fetchRecordData() {
    // ask user to enter record Id
    // Ask user to name file, default to record id
    try {
      const results = await getRecordName();
      if (results) {
        const { recordId, filename } = results;
        window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: MESSAGES.FETCH.IN_PROGRESS(filename),
            cancellable: false,
          },
          async (progress, token) => {
            try {
              const conn = await initConnection(this.configData.orgInfo, this.conn, false);
              // call SFDC API and fetch record data
              // save results
              await fetchAndSaveRecordRecord(conn, recordId, filename);
              window.showInformationMessage(`Successfully saved quoteModel to ${filename}.`);
              outputChannel.appendLine(`Successfully saved quoteModel to ${filename}.`);
            } catch (ex) {
              console.log('Error fetching / saving record from Salesforce', ex);
              window.showErrorMessage(`Error fetching record from Salesforce: ${ex.message}.`);
              outputChannel.appendLine(`Error fetching record from Salesforce: ${ex.message}.`);
            }
          },
        );
      }
    } catch (ex) {
      console.log('Error obtaining record Id and filename', ex);
      window.showErrorMessage(`Error getting quote record Id: ${ex.message}.`);
      outputChannel.appendLine(`Error getting quote record Id: ${ex.message}.`);
    }
  }

  /**
   *
   * EVENT LISTENERS
   *
   */

  /**
   * EVENT: onSave
   * When the config file is manually modified, the contents is re-read into the configuration in memory
   */

  async onActiveTextEditorChanged(ev: TextEditor | undefined): Promise<void> {
    if (ev) {
      updateContextIfActiveQcpFile(ev.document);
    }
  }

  async onSave(ev: TextDocument) {
    // If user manually updated config, we need to update in-memory configuration
    if (ev.fileName.endsWith(FILE_PATHS.CONFIG.target)) {
      this.configData = await readConfig(readAsJson<ConfigData | ConfigDataEncrypted>(ev.fileName));
      this.conn = undefined;
      this.addConnToDocumentProvider();
      console.log('Config file updated');
    }

    let pushOnSave = workspace.getConfiguration(SETTINGS.NAMESPACE).get<boolean>(SETTINGS.ENTRIES.PUSH_ON_SAVE);

    if (pushOnSave && ev.fileName.includes('/src/') && ev.fileName.endsWith('.ts')) {
      const pickedItem = await window.showQuickPick(INPUT_OPTIONS.PUSH_ON_SAVE_CONFIRM(ev.fileName));
      if (pickedItem && pickedItem.label === QP.PUSH_ON_SAVE_CONFIRM.YES) {
        window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: MESSAGES.PUSH.PROGRESS_MULTI,
            cancellable: true,
          },
          async (progress, token) => {
            // ensure any code formatters can run first
            try {
              const updatedRecord = await pushFile(this.configData, ev.fileName, this.conn);
              if (updatedRecord) {
                window.showInformationMessage(MESSAGES.PUSH.SUCCESS(updatedRecord.Name));
                logRecords(outputChannel, 'Pushed File', [updatedRecord]);
              } else {
                window.showErrorMessage(`Error pushing file to Salesforce.`);
              }
            } catch (ex) {
              window.showErrorMessage(`Error pushing file to Salesforce: ${ex.message}.`);
            }
          },
        );
      }
    }
  }

  async onDelete(ev: Uri) {
    if (this.configData) {
      const matchingFileIdx = this.configData.files.findIndex(file => file.fileName === ev.fsPath);
      if (matchingFileIdx > -1) {
        const deletedFile: CustomScriptFile = this.configData.files[matchingFileIdx];
        this.configData.files.splice(matchingFileIdx, 1);
        const pickedItem = await window.showQuickPick(
          INPUT_OPTIONS.DELETE_REMOTE_ON_DELETE_CONFIRM(deletedFile.record.Id, deletedFile.fileName),
        );
        if (pickedItem && pickedItem.label === QP.DELETE_REMOTE_ON_DELETE_CONFIRM.YES) {
          // delete remote
          try {
            const conn = await initConnection(this.configData.orgInfo, this.conn);
            const success = await deleteRecord(conn, deletedFile.record.Id);
            if (success) {
              window.showInformationMessage(MESSAGES.DELETE.DELETE_REMOTE_ON_DELETE_SUCCESS(deletedFile.record.Id));
              logRecords(outputChannel, 'Deleted Records', [`${deletedFile.record.Name} (${deletedFile.record.Id})`]);
            } else {
              window.showInformationMessage(MESSAGES.DELETE.DELETE_REMOTE_ON_DELETE_FAIL(deletedFile.record.Id));
              outputChannel.appendLine(`Error deleting record ${deletedFile.record.Id} from Salesforce.`);
            }
          } catch (ex) {
            window.showErrorMessage(`Error deleting record from Salesforce Salesforce: ${ex.message}.`);
            outputChannel.appendLine(`Error deleting record ${deletedFile.record.Id} from Salesforce. ${ex.message}.`);
          }
        }
        // Update config with removed file
        try {
          await saveConfig(this.configData);
        } catch (ex) {
          console.warn('Error saving config data');
        }
      }
    }
  }
}
