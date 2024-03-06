import { existsSync, readFileSync } from 'fs';
import { authenticate } from './auth';
import { markdownToGoogleDocs } from './markdown';
import { google } from 'googleapis';

const googleUpdate = markdownToGoogleDocs(readFileSync("example.md", "utf8"))
const auth = await authenticate()

if (auth.credentials.access_token) {
const docs = google.docs({ version: 'v1', auth });

// console.log(googleUpdate)
console.log(JSON.stringify(googleUpdate, null, 2));

const docId = "1XyVUtWbAb3YAYAQXWoz0nE-1k3XVoG6FYMzSXCQ4oko"

await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
        requests: googleUpdate
    },
});

}