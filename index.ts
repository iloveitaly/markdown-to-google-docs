import { google, docs_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createInterface } from 'readline';
import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { existsSync, readFileSync } from 'fs';
import readline from 'readline';
import opn from 'opn';
import http from 'http';


const program = new Command();
const SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';

async function authenticate(credentialsPath: string): Promise<OAuth2Client> {
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
  if (new Date(token.expiry_date) <= new Date()) {
    console.log('Token expired. Please reauthorize.');
    // Here you should call your function to get a new token
    return getNewToken(oAuth2Client);
  }

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

async function findOrCreateDoc(title: string, folderId: string, auth: OAuth2Client): Promise<string> {
    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    const response = await drive.files.list({
        q: `name = '${title}' and '${folderId}' in parents and trashed = false`,
        spaces: 'drive',
        fields: 'files(id, name)',
    });

    if (response.data.files && response.data.files.length > 0) {
        console.log(`Document found: ${response.data.files[0].id}`);
        return response.data.files[0].id;
    } else {
        console.log('Document not found, creating a new one.');
        const doc = await docs.documents.create({
            requestBody: {
                title: title,
            },
        });

      const documentId = doc.data.documentId;

        await drive.files.update({
            fileId: documentId!,
            addParents: folderId,
            // removeParents: (await drive.files.get({ fileId: documentId! })).data.parents!.join(','),
            // fields: 'id, parents',
        });

        console.log(`Document created with ID: ${documentId}`);
        return documentId;
    }
}

async function updateHtml(googleDocId: string, rawHtml: string, auth: OAuth2Client) {
    console.log(`Updating document ${googleDocId} with provided HTML content.`);
    const docs = google.docs({ version: 'v1', auth });
    await docs.documents.batchUpdate({
        documentId: googleDocId,
        requestBody: {
            requests: [
                {
                    insertText: {
                        location: {
                            index: 1,
                        },
                        text: rawHtml,
                    },
                },
            ],
        },
    });
}

async function htmlFromStdin(): Promise<string> {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
    });

    console.log('Please enter your HTML (press CTRL+D when done):');
    const lines: string[] = [];
    rl.on('line', (line) => {
        lines.push(line);
    });

    return new Promise((resolve) => {
        rl.on('close', () => {
            resolve(lines.join('\n'));
        });
    });
}

program
  .name("google-docs-cli")
  .description("CLI to manage Google Docs")
  .version("1.0.0");

program.command('create')
  .description('Create a new Google Doc')
  .argument('<title>', 'Title of the document')
  .argument('<folderId>', 'Folder ID to store the document in Google Drive')
  .option('-f, --file <path>', 'HTML file to use as content')
  .option('-c, --credentials <path>', 'Path to Google API credentials JSON file')
  .action(async (title, folderId, options) => {
    const auth = await authenticate(options.credentials);
    const docId = await findOrCreateDoc(title, folderId, auth);

    let rawHtml: string;

    if (options.file) {
        console.log(`Reading HTML content from ${options.file}`);
        rawHtml = readFileSync(options.file, 'utf8');
    } else {
        rawHtml = await htmlFromStdin();
    }

    await updateHtml(docId, rawHtml, auth);
  });

program.parse(process.argv);
