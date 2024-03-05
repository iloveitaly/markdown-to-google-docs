import { OAuth2Client } from 'google-auth-library';
import { writeFileSync } from 'fs';
import { existsSync, readFileSync } from 'fs';

import readline from 'readline';
import opn from 'opn';
import http from 'http';

const SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';

export async function authenticate(credentialsPath: string): Promise<OAuth2Client> {
  credentialsPath = credentialsPath ?? CREDENTIALS_PATH;

  if (!existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at path: ${credentialsPath}`);
  }

  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  if (!existsSync(TOKEN_PATH)) {
    console.log('Token file not found. Please reauthorize.');
    // Here you should call your function to get a new token
    return getNewToken(oAuth2Client);
  }

  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
  // if (new Date(token.expiry_date) <= new Date()) {
  //   console.log('Token expired. Please reauthorize.');
  //   // Here you should call your function to get a new token
  //   return getNewToken(oAuth2Client);
  // }

  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

async function getNewToken(oAuth2Client: OAuth2Client): Promise<OAuth2Client> {
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    redirect_uri: 'http://localhost:8080/'
  });
  console.log(`Authorize this app by visiting this url: ${authorizeUrl}`);

  const server = http.createServer(async (req, res) => {
    if (req.url.indexOf('/') > -1) {
      const qs = new url.URL(req.url, 'http://localhost:8080').searchParams;
      res.end('Authentication successful! Please return to the console.');
      server.close();
      debugger
      const {tokens} = await oAuth2Client.getToken(qs.get('code'));
      oAuth2Client.credentials = tokens;
      writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      console.log('Token stored to', TOKEN_PATH);
    }
  }).listen(8080, () => {
    // open the browser to the authorize url to start the workflow
    opn(authorizeUrl);
  });

  return oAuth2Client;
}
