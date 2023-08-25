/*
* Copyright 2023 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     https://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import { LitElement, html, TemplateResult, css } from "lit";
import { customElement, state } from "lit/decorators.js";

// Client ID from developer console
// E.g. 482540692990-vkcqft1vg3jrk0f05ngr8m5ra3a5i66d.apps.googleusercontent.com
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Fetch the 10 most recently modified files from Drive.
 */
async function fetchFileList(accessToken: string) {
  const params = new URLSearchParams({
    orderBy: 'modifiedTime desc',
    pageSize: '10'
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  if (res.status >= 400) {
    throw new Error('Unable to fetch files');
  }
  const body = await res.json();
  return body.files;
}

/** 
 * Main app
 */
@customElement("auth-demo")
export class AuthDemo extends LitElement {
  static styles = css`
      .root {
        display: flex;
        max-width: 640px;
        flex-direction: column;
        gap: 4px;

      }
      .btn {
        font-weight: bold;
        text-transform: uppercase;
        padding: 12px;
        border: #fafafa;
        border-radius: 4px;
        background-color: #818cf8;
        color: #fafafa;
      }

      .error {
        border: #ef4444;
        background-color: #fca5a5;
        padding: 12px;
      }
    `;

  @state()
  declare private _files: any[];

  @state()
  declare private _accessToken: null | string;

  @state()
  declare private _tokenExpiresAt: number;

  @state()
  declare private _error: null | string;
  constructor() {
    super();
    this._files = [];
    this._accessToken = null;
    this._tokenExpiresAt = 0;
    this._error = null;
  }

  render() {
    let files: TemplateResult | undefined;
    let error = this._error ?
      html`<div role class="error">${this._error}</div>` : null;

    if (this._files?.length) {
      files = html`
          <div>
            <h3>Files:</h3>
            ${this._files.map(f => html`<div class="file">${f.name}</div>`)}
          </div>`;
    }
    return html`<div class="root">
        <div><button class="btn" @click="${this._run}">Fetch files</button></div>
        ${error} ${files}
      </div>`;
  }

  async _run() {
    if (this._accessToken && this._tokenExpiresAt > Date.now()) {
      this._files = await fetchFileList(this._accessToken);
    } else {
      await this._requestAuthorization();
      this._files = await fetchFileList(this._accessToken!);

    }
  }
  /** 
  * Request an access token using the Google Identity Services SDK.
  */
  async _requestAuthorization() {
    const scope = 'https://www.googleapis.com/auth/drive.readonly'
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID
        scope: scope,
        callback: async (response: any) => {
          if (response
            && response.access_token
            && google.accounts.oauth2.hasGrantedAnyScope(response, scope)) {
            this._error = null;
            this._accessToken = response.access_token;
            // Expiry is returned as a relative time (number of seconds remaining)
            // Convert to absolute time
            this._tokenExpiresAt = Date.now() + (response.expires_in * 1000);
            resolve(this._accessToken);
            return;
          }
          // Either error or scope not granted
          this._error = 'Authorization required.';
        },
        error_callback: (err) => {
          if (err.type === 'popup_closed') {
            // User closed popup without authorizing.
            this._error = 'Authorization required';
          } else {
            // Popup failed to open or some other unexpected error occurred.
            this._error = 'An unexpected error occurred';
          }
          reject(err);
        }
      });      
      client.requestAccessToken();
    });
  }
}