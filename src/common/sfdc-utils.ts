import * as jsforce from 'jsforce';
import { commands, Uri, EventEmitter } from 'vscode';
import { AUTH_HTTP, client_id, CUSTOM_SCRIPT_API_NAME } from '../common/constants';
import { CustomScript, CustomScriptBase, OrgInfo, SfdcAuthDeviceCodeResponseSuccess, SfdcAuthDeviceResponseError } from '../models';
import { getOnDidAuthEvent } from '../providers/uri-provider';
import { QUERIES } from './constants';
import { SuccessResult, ErrorResult } from 'jsforce';

export const onConnChange = new EventEmitter<jsforce.Connection | undefined>();
export const onAuthInfoChange = new EventEmitter<OrgInfo>();

export function authenticateUser(domain: string): Promise<SfdcAuthDeviceCodeResponseSuccess> {
  return new Promise((resolve, reject) => {
    // Open OAuth window
    commands.executeCommand('vscode.open', Uri.parse(AUTH_HTTP.getUserAgentAuth.url(domain)));

    // Listen for redirect
    getOnDidAuthEvent().event((data: SfdcAuthDeviceCodeResponseSuccess | SfdcAuthDeviceResponseError) => {
      console.log('[AUTH] callback called', data);
      if (isErrorResponse(data)) {
        reject(data);
      } else {
        resolve(data);
      }
    });
  });
}

function isErrorResponse(val: any): val is SfdcAuthDeviceResponseError {
  return val.error ? true : false;
}

export async function initConnection(
  orgInfo: OrgInfo,
  conn?: jsforce.Connection,
  testIfValid: boolean = false,
): Promise<jsforce.Connection> {
  if (conn) {
    if (testIfValid) {
      if (!(await testValidCredentials(conn, orgInfo))) {
        onConnChange.fire(undefined);
        throw new Error('Authentication is invalid, please re-authenticate');
      }
    }
    return conn;
  }

  if (orgInfo.authInfo) {
    conn = new jsforce.Connection({
      oauth2: {
        clientId: client_id,
        redirectUri: AUTH_HTTP.getUserAgentAuth.url(orgInfo.loginUrl as string),
        loginUrl: orgInfo.loginUrl,
      },
      instanceUrl: orgInfo.authInfo.instance_url,
      accessToken: orgInfo.authInfo.access_token,
      refreshToken: orgInfo.authInfo.refresh_token,
    });
    if (testIfValid && !(await testValidCredentials(conn, orgInfo))) {
      onConnChange.fire(undefined);
      throw new Error('Authentication is invalid, please re-authenticate');
    }
    onConnChange.fire(conn);
    return conn;
  } else {
    onConnChange.fire(undefined);
    throw new Error('Authentication is invalid, please re-authenticate');
  }
}

export async function testValidCredentials(conn: jsforce.Connection, orgInfo: OrgInfo): Promise<boolean> {
  if (!orgInfo.authInfo) {
    return false;
  } else {
    try {
      const tokenResponse = await conn.oauth2.refreshToken(orgInfo.authInfo.refresh_token);
      orgInfo.authInfo.access_token = tokenResponse.access_token;
      conn.accessToken = tokenResponse.access_token;
      if (!orgInfo.username) {
        const userInfo: any = await conn.request({ method: 'GET', url: orgInfo.authInfo.id });
        orgInfo.username = userInfo.username;
      }
      onAuthInfoChange.fire(orgInfo);
      return true;
    } catch (ex) {
      return false;
    }
  }
}

export async function queryAllRecords(conn: jsforce.Connection): Promise<CustomScript[]> {
  const results = await conn.query<CustomScript>(QUERIES.ALL_RECS());
  return results.records;
}

export async function queryAllRecordsWithoutCode(conn: jsforce.Connection): Promise<CustomScriptBase[]> {
  const results = await conn.query<CustomScriptBase>(QUERIES.ALL_WITHOUT_CODE());
  return results.records;
}

export async function queryRecordsById(conn: jsforce.Connection, id: string): Promise<CustomScript[]> {
  const results = await conn.query<CustomScript>(QUERIES.BY_ID_RECS(id));
  return results.records;
}

export async function queryRecordsByName(conn: jsforce.Connection, name: string, skipCode: boolean = false): Promise<CustomScript[]> {
  const query = skipCode ? QUERIES.BY_NAME_RECS_NO_CODE(name) : QUERIES.BY_NAME_RECS(name);
  const results = await conn.query<CustomScript>(query);
  return results.records;
}

export async function queryRecordCountByName(conn: jsforce.Connection, name: string): Promise<number[]> {
  const results = await conn.query<number>(QUERIES.BY_NAME_RECS_COUNT(name));
  return results.records;
}

export function getRecWithoutCode(records: CustomScript | CustomScript[]): CustomScriptBase[] {
  records = Array.isArray(records) ? records : [records];
  return records.map(rec => {
    const tempRec = { ...rec };
    delete tempRec.SBQQ__Code__c;
    return tempRec;
  });
}

export async function deleteRecord(conn: jsforce.Connection, recordId: string): Promise<boolean> {
  const results = (await conn.delete<CustomScript>(CUSTOM_SCRIPT_API_NAME, recordId)) as ErrorResult | SuccessResult;
  return results.success;
}

export function getFrontDoorUrl(conn: jsforce.Connection, recordId: string): string {
  const frontDoorUrl = `${conn.instanceUrl}/secur/frontdoor.jsp?sid=${conn.accessToken}&retURL=/${recordId}`;
  return frontDoorUrl;
}

export async function fetchQuoteModel(conn: jsforce.Connection, recordId: string): Promise<string> {
  let results = await conn.apex.get<string>(`/SBQQ/ServiceRouter?reader=SBQQ.QuoteAPI.QuoteReader&uid=${recordId}`);
  results = JSON.stringify(JSON.parse(results), null, 2);
  return results;
}

export function validateId(recordId: string): boolean {
  return /^([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/.test(recordId);
}
