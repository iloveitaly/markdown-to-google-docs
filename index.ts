import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createInterface } from 'readline';
import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { authenticate } from './auth';
import { markdownToGoogleDocs } from './markdown';

const program = new Command();

async function findOrCreateDoc(title: string, folderId: string, auth: OAuth2Client): Promise<string> {
    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    // escape ' in title
    const escapedTitle = title.replace(/'/g, "\\'");

    const response = await drive.files.list({
        q: `name = '${escapedTitle}' and '${folderId}' in parents and trashed = false`,
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

async function updateHtml(googleDocId: string, rawMarkdown: string, auth: OAuth2Client) {
    console.log(`Updating document ${googleDocId} with provided markdown content.`);

    const googleDocStructure = markdownToGoogleDocs(rawMarkdown)
    console.log('Google Docs structure:', googleDocStructure);
    const docs = google.docs({ version: 'v1', auth });
    await docs.documents.batchUpdate({
        documentId: googleDocId,
        requestBody: {
            requests: googleDocStructure
        }
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
