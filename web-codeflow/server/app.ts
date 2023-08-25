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
import express from 'express';
import path from 'path';
import { doubleCsrf } from "csrf-csrf";
import { ironSession } from 'iron-session/express';
import cookieParser from 'cookie-parser';
import { OAuth2Client } from 'google-auth-library';
import { saveUser, saveCredentials, loadCredentials } from './db';

// Load service client ID & credentials from env
const clientId = process.env.VITE_GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUrl = 'postmessage';

// Options for session & CSRF cookies
const cookieOptions = {
  secure: true,
  sameSite: process.env.COOKIE_SAMESITE ?? 'lax', // Allow overrideing for repl.it
};

// Session middleware
const session = ironSession({
  cookieName: "app-session",
  password: process.env.COOKIE_ENCRYPTION_KEY,
  cookieOptions
});

// CSRF middleware
const {
  generateToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => process.env.COOKIE_ENCRYPTION_KEY,
  cookieName: 'csrf-token',
  cookieOptions
});

// Wrapper around route handlers to catch errors from aync methods
function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next); 
    } catch (err) {
      console.log(err);
      res.status(500).send();
    }  
  }
}

// Middleware to require an active user session for a route
// Redirects if unauthorized
function requireLogin(...paths) {
  return (req, res, next) => {
    if (paths.indexOf(req.path) == -1) {
      next();
      return;
    }
    if (!req.session?.user?.id) {
      res.redirect('/');
      return;
    }
    next();
  }
}


// Middleware to require an active user session for a route
// Rejects if unauthorized
function requireAuth(req, res, next) {
    if (!req.session?.user?.id) {
      res.status(403).json({error: 'Unauthorized'});
      return;
    }
    next();
  
}

const app = express();

app.use((req,res,next) => {
  console.log(req.path);
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  next();
});

app.use(express.json());
app.use(cookieParser());
app.use(session);
app.use(requireLogin('/authorize.html'));
  

// Request a CSRF token
app.get('/api/csrfToken', asyncHandler(async (req, res) => {
  if (req.session?.csrfToken) {
    res.json({ csrfToken: req.session.csrfToken });
    return;
  }
  const csrfToken = generateToken(res, req);
  req.session.csrfToken = csrfToken;
  await req.session.save();
  res.json({ csrfToken });
}));

app.post('/api/signin', doubleCsrfProtection, asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  // Verify the ID token
  const oauthClient = new OAuth2Client(clientId);
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  const user = {
    id: payload['sub'],
    email: payload['email'],
    name: payload['name'],
    photo: payload['picture'],
  };
  saveUser(user);

  // Save user to session
  req.session.user = user;
  await req.session.save();
  res.json({
    userInfo: payload,
  });
}));


app.get('/api/profile', requireAuth, asyncHandler(async (req, res) => {
  res.json(req.session.user);
}));

app.post('/api/exchangeCode', requireAuth, doubleCsrfProtection, asyncHandler(async (req, res) => {
  // Exchange authorization code for a refresh/access token
  const code = req.body.code;
  const oAuth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      redirectUrl,
  );
  const oauthResponse = await oAuth2Client.getToken(code);
  const credentials = oauthResponse.tokens;
  await saveCredentials(req.session.user.id, credentials);
}));

app.get('/api/listFiles', requireAuth, asyncHandler(async (req, res) => {
  // Load previously saved credentials, refresh if necessary
  let credentials = await loadCredentials(req.session.user.id);
  if (!credentials.expiry_date || credentials.expiry_date < Date.now()) {
    const oAuth2Client = new OAuth2Client(
        clientId,
        clientSecret,
        redirectUrl,
    );
    oAuth2Client.setCredentials(credentials);
    const response = await oAuth2Client.refreshAccessToken();
    credentials = response.credentials;
    saveCredentials(req.session.user.id, credentials);
  }

  // Fetch 10 most recently modified files for the user.
  const params = new URLSearchParams({
    orderBy: 'modifiedTime desc',
    pageSize: '10'
  });
  const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {    headers: {
      'Authorization': `Bearer ${credentials.access_token}`
    }
  });
  if (driveResponse.status >= 400) {
    throw new Error('Unable to fetch files');
  }
  const body = await driveResponse.json();
  res.status(200).json(body.files);
}));



if (process.env.NODE_ENV === 'production') {
  console.log(`__dirname = ${__dirname}`);
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.listen(5000, () => console.log('listening on port 5000'));
}

module.exports = app;
