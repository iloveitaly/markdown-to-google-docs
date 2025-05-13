import { Command } from 'commander';
import { authenticate } from './auth';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { findOrCreateDoc, updateHtml } from './google';
import { google } from 'googleapis';
import { invariant } from '@epic-web/invariant';

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

// js is so lame
function isEqual(a: any, b: any) {
    return JSON.stringify(a) === JSON.stringify(b);
}

async function create(title: string, folderId: string, options: { file?: string, credentials?: string }) {
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
}

async function get(title: string, options: { credentials?: string }) {
    const auth = await authenticate(options.credentials);

    const drive = google.drive({ version: 'v3', auth });
    const searchResponse = await drive.files.list({
        q: `name = '${title}' and trashed = false`,
        spaces: 'drive'
    })

    if (searchResponse.data.files && searchResponse.data.files.length != 1) {
        console.error(`Expected 1 file, found ${searchResponse.data.files.length}`);
        return;
    }

    const docId = searchResponse.data.files[0].id
    const docs = google.docs({ version: 'v1', auth });
    const docResult = await docs.documents.get({ documentId: docId });

    const googleDocKeys = Object.keys(docResult.data.body)
    invariant(isEqual(googleDocKeys, ['content']), `additional keys in google doc body ${googleDocKeys}`);

    console.log(JSON.stringify(docResult.data.body.content, null, 2));
}


const program = new Command();

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
  .action(create);

program.command('get')
    .description("Get the internal structure of a google doc, mostly for debugging")
    .argument('<title>', 'Title or ID of the document')
    .option('-c, --credentials <path>', 'Path to Google API credentials JSON file')
    .action(get);

program.parse(process.argv);
