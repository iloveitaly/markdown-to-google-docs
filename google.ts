import { google } from 'googleapis';

async function hasOpenComments(auth, fileId) {
  const drive = google.drive({ version: 'v3', auth });
  const response = await drive.comments.list({
    fileId: fileId,
    fields: 'comments(status)',
  });

  const comments = response.data.comments;
  return comments.some(comment => comment.status === 'open');
}


export async function wipeDocumentContents(auth, documentId) {
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
