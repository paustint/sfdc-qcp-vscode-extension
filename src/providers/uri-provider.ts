import { Uri, EventEmitter, UriHandler } from 'vscode';
import { SfdcAuthDeviceCodeResponseSuccess } from '../models';

let onDidAuth: EventEmitter<SfdcAuthDeviceCodeResponseSuccess> | undefined;

export function getOnDidAuthEvent() {
  onDidAuth = onDidAuth || new EventEmitter<SfdcAuthDeviceCodeResponseSuccess>();
  return onDidAuth;
}

export class SfdcAuthProtocolHandler extends EventEmitter<Uri> implements UriHandler {
  public handleUri(uri: Uri) {
    switch (uri.path) {
      case '/auth_callback': {
        this.authenticate(uri);
      }
    }
  }

  private authenticate(uri: Uri) {
    console.log('uri', uri);
    if (onDidAuth) {
      const authInfo: SfdcAuthDeviceCodeResponseSuccess = uri.fragment.split('&').reduce((acc: any, curr) => {
        const [key, value] = curr.split('=');
        acc[key] = decodeURIComponent(value);
        return acc;
      }, {});
      onDidAuth.fire(authInfo);
      onDidAuth.dispose();
      onDidAuth = undefined;
    } else {
      // show error message
    }
  }
}
