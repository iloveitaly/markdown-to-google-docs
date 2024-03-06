import { google } from 'googleapis';
import { markdownToGoogleDocs } from './markdown';

export async function updateHtml(googleDocId: string, rawMarkdown: string, auth: OAuth2Client, opts: { wipe: boolean } = { wipe: false }) {
    console.log(`Updating document ${googleDocId} with provided markdown content.`);

    const googleDocStructure = markdownToGoogleDocs(rawMarkdown)
    console.log('Google Docs structure:', googleDocStructure);

    if (opts.wipe) {
        wipeDocumentContents(auth, googleDocId);
    }

    const docs = google.docs({ version: 'v1', auth });

    await docs.documents.batchUpdate({
        documentId: googleDocId,
        requestBody: {
            requests: googleDocStructure
        }
    });
}

export async function hasOpenComments(auth, fileId) {
  const drive = google.drive({ version: 'v3', auth });
  const response = await drive.comments.list({
    fileId: fileId,
    fields: 'comments(status)',
  });

  const comments = response.data.comments;
  return comments.some(comment => comment.status === 'open');
}

export async function findOrCreateDoc(title: string, folderId: string, auth: OAuth2Client): Promise<string> {
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


async function wipeDocumentContents(auth, documentId) {
  const docs = google.docs({ version: 'v1', auth });
  const document = await docs.documents.get({ documentId: documentId });
  const contentLength = document.data.body.content.length;

  if (contentLength <= 2) {
    return
  }

  // Generate requests to delete all content. Adjust based on your document structure.
  // This approach assumes the document has content that can be cleared with a single replacement.
  // Complex documents might require more targeted deletions.
  const requests = [
    {
      deleteContentRange: {
        range: {
          startIndex: 1,  // Start just after the document start
          endIndex: contentLength - 1,  // End just before the document end
        },
      },
    },
  ];

  await docs.documents.batchUpdate({
    documentId: documentId,
    requestBody: {
      requests: requests,
    },
  });

  console.log('Document content wiped.');
}
