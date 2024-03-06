import { Command } from 'commander';
import { authenticate } from './auth';
import { existsSync, readFileSync } from 'fs';
import { createInterface } from 'readline';

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
