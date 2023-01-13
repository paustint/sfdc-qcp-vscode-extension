export type StringOrUndefined = string | undefined;
export type OrgType = 'Sandbox' | 'Developer' | 'Production' | 'Custom URL';
export type LogEntryAction = 'push' | 'pull';
export type LogEntryStatus = 'success' | 'error';

export interface ConfigData {
  orgInfo: OrgInfo;
  files: CustomScriptFile[];
}

export interface ConfigDataEncrypted {
  orgInfo: OrgInfoEncrypted;
  files: CustomScriptFile[];
}

export interface CustomScriptFile {
  fileName: string;
  record: CustomScriptBase;
}

export interface OrgInfo {
  orgId?: string;
  orgType?: OrgType;
  loginUrl?: string;
  username?: string;
  authInfo?: SfdcAuthDeviceCodeResponseSuccess;
}

export interface OrgInfoEncrypted {
  orgId: string;
  orgType: OrgType;
  loginUrl: string;
  username: string;
  authInfo: string;
}

export interface CustomScriptUpsert {
  Id?: string;
  Name: string;
  SBQQ__Code__c: string;
}

export interface CustomScriptBase {
  Id: string;
  Name: string;
  CreatedById: string;
  CreatedDate: string;
  LastModifiedById: string;
  LastModifiedDate: string;
  SBQQ__GroupFields__c: string;
  SBQQ__QuoteFields__c: string;
  SBQQ__QuoteLineFields__c: string;
  CreatedBy: {
    Id: string;
    Name: string;
    Username: string;
  };
  LastModifiedBy: {
    Id: string;
    Name: string;
    Username: string;
  };
}

export interface CustomScript extends CustomScriptBase {
  SBQQ__Code__c: string;
  SBQQ__TranspiledCode__c?: string;
}

export interface LogEntry {
  action: LogEntryAction;
  status: LogEntryStatus;
  username?: string;
  fileName?: string;
  recordId?: string;
  recordName?: string;
  error?: string;
  timestamp: string;
}

export interface AuthHttpItem {
  url: (domain: string) => string;
}
export interface AuthHttp {
  getUserAgentAuth: AuthHttpItem;
}

export interface SfdcAuthDeviceCodeResponse {
  user_code: string;
  device_code: string;
  interval: number;
  verification_uri: string;
}

export interface SfdcAuthDeviceCodeResponseSuccess {
  access_token: string;
  refresh_token: string;
  signature: string;
  scope: string;
  state: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
}

export type SfdcAuthDeviceCodeResponseErrorCode =
  | 'unsupported_response_type'
  | 'invalid_client_id'
  | 'invalid_request'
  | 'invalid_request'
  | 'invalid_request'
  | 'access_denied'
  | 'redirect_uri_missing'
  | 'redirect_uri_mismatch'
  | 'immediate_unsuccessful'
  | 'invalid_grant'
  | 'invalid_grant'
  | 'inactive_user'
  | 'inactive_org'
  | 'rate_limit_exceeded'
  | 'invalid_scope';

export interface SfdcAuthDeviceResponseError {
  error: SfdcAuthDeviceCodeResponseErrorCode;
  error_description: string;
}
