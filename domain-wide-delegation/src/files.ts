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

async function fetchFileList(accessToken: string) {
  const res = await fetch('/api/listFiles');
  if (res.status >= 400) {
    throw new Error('Unable to fetch files');
  }
  return await res.json();
}


@customElement('app-list-files')
export class ListFIles extends LitElement {
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
  declare private _error: null | string;

  constructor() {
    super();
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
    try {
      this._error = null;
      this._files = await fetchFileList();
    } catch (err) {
      this._error = err.message;
    }
  }

}