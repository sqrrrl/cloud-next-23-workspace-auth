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

async function fetchProfile(accessToken: string) {
  console.log('Fetching profile"')
  const res = await fetch('/api/profile');
  if (res.status >= 400) {
    throw new Error('Unable to fetch profile');
  }
  return await res.json();
}


@customElement('app-profile')
export class ListFIles extends LitElement {
  static styles = css`
      .root {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
      }

      .photo {
        width: 32px;
        border-radius: 16px;
      }
    `;

  @state()
  declare private _profile: any;

  connectedCallback() {
    super.connectedCallback();
    fetchProfile().then(profile => this._profile = profile);
  }
  
  render() {
    if (!this._profile) {
      return html`<div>hi</div>`;
    }
    return html`<div class="root">
        <img class="photo" src="${this._profile.photo}">
        <span class="name">${this._profile.name}</span>
    </div>`;
  }
}