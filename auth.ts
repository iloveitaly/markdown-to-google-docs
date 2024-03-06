import { OAuth2Client } from 'google-auth-library';
import { writeFileSync } from 'fs';
import { existsSync, readFileSync } from 'fs';
import * as url from "url"

import opn from 'opn';
import http from 'http';

const SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'];

const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';

export async function authenticate(opts: { credentialsPath?: null | string, credentialContent?: null | string } = { credentialsPath: null, credentialContent: null }): Promise<OAuth2Client> {
  const oAuth2Client = getClient(opts);

  // if (!existsSync(TOKEN_PATH)) {
  //   console.log('Token file not found. Please reauthorize.');
  //   return false
  // }

  // JSON.parse(readFileSync(TOKEN_PATH, 'utf8'))

  const isValid = await hasValidToken(oAuth2Client, JSON.parse(readFileSync(TOKEN_PATH, 'utf8')))

  if (!isValid) {
    // this does not immediately set the token, the user must complete the action
    // const [server, authorizationUrl] = await getNewToken(oAuth2Client);
    // opn(authorizationUrl);
    await getNewToken(oAuth2Client);
  }

  return oAuth2Client
}

export async function hasValidToken(oAuth2Client: OAuth2Client, token: any) {
  if (Object.keys(token).length === 0) {
    console.log('Token file is empty. Please reauthorize.');
    return false
  }

  // if (new Date(token.expiry_date) <= new Date()) {
  //   console.log('Token expired. Please reauthorize.');
  //   // Here you should call your function to get a new token
  //   return getNewToken(oAuth2Client);
  // }

  // TODO we should just try to auth the token

  oAuth2Client.setCredentials(token);
  return true;
}

export function getClient(opts: { credentialsPath?: null | string, credentialContent?: null | string } = { credentialsPath: null, credentialContent: null }) {
  let credentialsContent = opts.credentialContent

  if (!credentialsContent) {
    // then let's try to read the credentials from the file
    const credentialsPath = opts.credentialsPath ?? CREDENTIALS_PATH

    if (!existsSync(credentialsPath)) {
      throw new Error(`Credentials file not found at path: ${credentialsPath}`);
    }

    credentialsContent = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  } else {
    credentialsContent = JSON.parse(credentialsContent)
  }

  const { client_secret, client_id, redirect_uris } = credentialsContent.installed;
  const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  return oAuth2Client
}

export async function getNewToken(oAuth2Client: OAuth2Client): Promise<[http.Server, string, Promise<any>]> {
  const port = 8080;
  const baseUrl = `http://localhost:${port}`;

  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    redirect_uri: `${baseUrl}/`
  });

  console.log(`Authorize this app by visiting this url: ${authorizeUrl}`);

  let resolveCredentials: (value: any) => void;
  const credentialsPromise = new Promise<any>((resolve) => {
    resolveCredentials = resolve;
  });

  const server = http.createServer(async (req, res) => {
    if (req.url.indexOf('/') > -1) {
      const qs = new url.URL(req.url, baseUrl).searchParams;
      res.end('Authentication successful! Please return to the console.');
      server.close();

      // make sure credentials.json has the correct redirect_uris specified
      // TODO maybe we should just hardcode this?

      const { tokens } = await oAuth2Client.getToken(qs.get('code'));
      oAuth2Client.credentials = tokens;
      resolveCredentials(tokens);
      // writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      // console.log('Token stored to', TOKEN_PATH);
      // TODO resolve the credentialsPromise with the tokens
    }
  })

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      resolve([server, authorizeUrl, credentialsPromise]);
    });
  });
}
