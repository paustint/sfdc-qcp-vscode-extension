import * as jsforce from 'jsforce';
import * as querystring from 'querystring';
import { TextDocumentContentProvider, EventEmitter, Uri, Event } from 'vscode';
import { queryRecordsById } from '../common/sfdc-utils';
import * as _ from 'lodash';
import { CustomScript } from '../models';

export class SfdcTextDocumentProvider implements TextDocumentContentProvider {
  private _onDidChange = new EventEmitter<Uri>();

  private conn: jsforce.Connection;

  constructor() {
    this.conn = new jsforce.Connection({});
  }

  public async provideTextDocumentContent(uri: Uri): Promise<string> {
    const records = await queryRecordsById(this.conn, uri.fragment);
    const queryString = querystring.parse(uri.query);
    if (records && records[0]) {
      if (_.isString(queryString['field'])) {
        if (!(records[0] as any)[queryString['field'] as keyof CustomScript]) {
          throw new Error(`The field ${queryString['field']} is blank.`);
        }
        return (records[0] as any)[queryString['field'] as keyof CustomScript];
      } else {
        return records[0].SBQQ__Code__c;
      }
    }
    throw new Error(`A record with Id ${uri.path} was not found on Salesforce.`);
  }

  public updateConn(conn: jsforce.Connection) {
    this.conn = conn;
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  public update(uri: Uri) {
    this._onDidChange.fire(uri);
  }
}
