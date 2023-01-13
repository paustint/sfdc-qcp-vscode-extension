'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { QcpExtension } from './extension-core';
import { SfdcTextDocumentProvider } from './providers/sfdc-text-document-provider';
import { SfdcAuthProtocolHandler } from './providers/uri-provider';

const SFDC_QCP_PROJECT_ACTIVE = 'sfdcQcp:projectActive';

function setCommandVisibility(enable: boolean) {
  vscode.commands.executeCommand('setContext', SFDC_QCP_PROJECT_ACTIVE, enable);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  setCommandVisibility(true);

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated

  const sfdcDocumentProvider = new SfdcTextDocumentProvider();
  const qcp = new QcpExtension(context, sfdcDocumentProvider);

  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('sfdc', qcp.sfdcDocumentProvider));
  context.subscriptions.push(vscode.window.registerUriHandler(new SfdcAuthProtocolHandler()));

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.testCredentials', () => {
      qcp.testCredentials();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.init', () => {
      qcp.init();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.initExampleFiles', () => {
      qcp.initExampleFiles();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.pullActive', () => {
      qcp.pullActive();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.pullAll', () => {
      qcp.pullFiles();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.push', () => {
      qcp.pushFiles();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.pushActive', () => {
      qcp.pushActiveFile();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.backup', () => {
      qcp.backup();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.diff', () => {
      qcp.diff();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.diffActive', () => {
      qcp.diff(true);
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.viewTranspiledCodeFromSalesforce', () => {
      qcp.viewTranspiledCodeFromSalesforce();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.viewActiveFileInSalesforce', () => {
      qcp.viewActiveFileInSalesforce();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.fetchRecordData', () => {
      qcp.fetchRecordData();
    }),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  setCommandVisibility(false);
}
