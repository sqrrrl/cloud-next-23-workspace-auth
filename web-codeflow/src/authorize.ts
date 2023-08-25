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
import { fetchCsrfToken } from './csrf';

// Client ID from developer console
// E.g. 482540692990-vkcqft1vg3jrk0f05ngr8m5ra3a5i66d.apps.googleusercontent.com
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

@customElement("app-authorize")
export class Authorize extends LitElement {
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
  declare private _error: null | string;

  constructor() {
    super();
    this._error = null;
    this._user = null;
  }

  render() {
    let error = this._error ?
      html`<div role class="error">${this._error}</div>` : null;

    return html`<div class="root">
        <div><button class="btn" @click="${this._requestAuthorization}">Authorize</button></div>
        ${error}
      </div>`;
  }

  _requestAuthorization() {
    console.log(this._user);
    const scope = 'https://www.googleapis.com/auth/drive.readonly'
    const client = google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: scope,
      callback: async (response) => {
        if (response && response.code) {
          this._error = null;
          const csrfToken = await fetchCsrfToken();
          await fetch('/api/exchangeCode', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              'X-csrf-token': csrfToken ?? 'invalid-token',
            },
            body: JSON.stringify({
              code: response.code
            }),
          })
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
      }
    });

    client.requestCode();
  }
}