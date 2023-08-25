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
import { ironSession } from 'iron-session/express';
import { doubleCsrf } from "csrf-csrf";
import cookieParser from 'cookie-parser';
import { OAuth2Client, JWT } from 'google-auth-library';
import { saveUser, saveCredentials, loadCredentials } from './db';

// Load service account credentials & client ID from env
const serviceAccount = JSON.parse(process.env['CREDENTIALS']);
const clientId = process.env.VITE_GOOGLE_CLIENT_ID;

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
  next();
});

app.use(express.json());
app.use(cookieParser());
app.use(session);
app.use(requireLogin('/authorize.html'));
  

// Request a CSRF token
app.get('/api/csrfToken', (req, res) => {
  const csrfToken = generateToken(res, req);
  res.json({ csrfToken });
});

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


app.get('/api/listFiles', requireAuth, asyncHandler(async (req, res) => {
  // Use domain-wide-delgation to obtain an access token using
  // the service account credentials. 
  const jwtClient = new JWT({
       email: serviceAccount.client_email,
       key: serviceAccount.private_key,
       scopes: ['https://www.googleapis.com/auth/drive.readonly'],
       subject: req.session.user.email // User to impersonate
    })
  const credentials = await jwtClient.authorize();

  // Fetch 10 most recently modified files for the user.
  const params = new URLSearchParams({
    orderBy: 'modifiedTime desc',
    pageSize: '10'
  });
  const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: {
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
