import { existsSync, readFileSync } from 'fs';
import { authenticate } from './auth';
import { markdownToGoogleDocs } from './markdown';
import { google } from 'googleapis';

const googleUpdate = markdownToGoogleDocs(readFileSync("example.md", "utf8"))
const auth = await authenticate(null)

const docs = google.docs({ version: 'v1', auth });

// console.log(googleUpdate)
console.log(JSON.stringify(googleUpdate, null, 2));


await docs.documents.batchUpdate({
    documentId: "1uND6DQiCSyM0I10ygIthpVIIAS9CT1y4tZmSne1RTXk",
    requestBody: {
        requests: googleUpdate
    },
});
