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
import { customElement, state, property } from "lit/decorators.js";
import { fetchCsrfToken } from './csrf';

// Client ID from developer console
// E.g. 482540692990-vkcqft1vg3jrk0f05ngr8m5ra3a5i66d.apps.googleusercontent.com
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

@customElement("app-signin")
export class AuthDemo extends LitElement {
  @state()
  declare private _error: null | string;

  @property()
  declare public redirectTo: null | string;
  
  constructor() {
    super();
    this._error = null;
    this.redirectTo = '';
    
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => {
        this._signin(response.credential).then(() => {
          console.log("redirecting to ", this.redirectTo)
          window.location.href = this.redirectTo;
        });
      }
    });
  }

  connectedCallback() {
    super.connectedCallback()
    google.accounts.id.prompt((notification) => {
      console.log(notification);
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One-tap skipped, render button instead
          const container = this.renderRoot.querySelector('#container')
          google.accounts.id.renderButton(container, {theme: "filled_blue"});
        }
    });
  }
  
  render() {
    return html`<div id="container"></div>`
  }
  
  async _signin(token) {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch('/api/signin', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
          'Content-Type': 'application/json',
          'X-csrf-token': csrfToken ?? 'invalid-token',
      },
      body: JSON.stringify({
            idToken: token
      }),
    });
    if (res.status >= 400) {
      throw new Error("Unable to sign in");
    }
  }
}