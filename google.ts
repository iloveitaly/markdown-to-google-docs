import { google } from 'googleapis';
import { markdownToGoogleDocs } from './markdown';

export async function updateHtml(googleDocId: string, rawMarkdown: string, auth: OAuth2Client, opts: { wipe: boolean } = { wipe: false }) {
  console.log(`Updating document ${googleDocId} with provided markdown content.`);

    if (opts.wipe) {
        await wipeDocumentContents(auth, googleDocId);
    }

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

export async function hasOpenComments(auth, fileId) {
  /*
[
  {
    "id": "AAABI8IN_Ik",
    "kind": "drive#comment",
    "createdTime": "2024-03-07T18:24:06.250Z",
    "modifiedTime": "2024-03-08T12:49:48.670Z",
    "resolved": false,
    "anchor": "kix.e0w1ht1izr6l",
    "replies": [
      {
        "id": "AAABG9rtr_o",
        "kind": "drive#reply",
        "createdTime": "2024-03-08T12:49:48.670Z",
        "modifiedTime": "2024-03-08T12:49:48.670Z",
        "author": {
          "displayName": "Example User",
          "kind": "drive#user",
          "me": true,
          "photoLink": "//example.com/photo.jpg"
        },
        "deleted": false,
        "htmlContent": "Example reply content with <b>some HTML</b>.",
        "content": "Example reply content."
      }
    ],
    "author": {
      "displayName": "Another Example User",
      "kind": "drive#user",
      "me": false,
      "photoLink": "//example.com/another_photo.jpg"
    },
    "deleted": false,
    "htmlContent": "Example comment content with <b>HTML bold</b>.",
    "content": "Example comment content.",
    "quotedFileContent": {
      "mimeType": "text/html",
      "value": "Example quoted content."
    }
  }
]
*/

  const drive = google.drive({ version: 'v3', auth });
  const response = await drive.comments.list({
    fileId: fileId,
    fields: 'comments',
  });

  const comments = response.data.comments;
  return comments.some(comment => comment.resolved === false || comment.deleted === false);
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


export async function wipeDocumentContents(auth, documentId) {
  const docs = google.docs({ version: 'v1', auth });
  const document = await docs.documents.get({ documentId: documentId });

  // document.data.body.content is an array of 'google doc structures'
  // get the max value of `endIndex` to use for the deletion call
  const maxIndex = Math.max(...document.data.body.content?.map((content) => content.endIndex))

  if (maxIndex <= 2) {
    return
  }

  // Generate requests to delete all content. Adjust based on your document structure.
  // This approach assumes the document has content that can be cleared with a single replacement.
  // Complex documents might require more targeted deletions.
  const requests = [
    {
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: maxIndex - 1,
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
