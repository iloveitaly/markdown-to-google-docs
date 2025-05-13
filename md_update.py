# /// script
# dependencies = [
#   "google-auth-oauthlib>=1.2.1,<2",
#   "google-api-python-client>=2.149.0,<3"
# ]
# ///

from secrets import token_bytes
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import os

SCOPES = ['https://www.googleapis.com/auth/drive']
INPUT_FILE = 'test/fixtures/nested-bullets.md'
CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'token_py.json'
TARGET_DOC_ID = '1Avm-zf1dCOoAfscy8wqSL7DO5u65rtDnneYgHMQx-jk'  # TODO: Replace with actual doc ID

from googleapiclient.errors import HttpError

def get_credentials():
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    else:
        if not os.path.exists(CREDENTIALS_FILE):
            raise FileNotFoundError("Credentials file not found. Please provide credentials.json.")
        flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
        creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    return creds

def create_temp_doc_from_markdown():
    creds = get_credentials()
    drive_service = build('drive', 'v3', credentials=creds)
    docs_service = build('docs', 'v1', credentials=creds)

    file_metadata = {
        'name': f'temp test {os.path.basename(INPUT_FILE)}',
        'mimeType': 'application/vnd.google-apps.document'
    }
    media = MediaFileUpload(INPUT_FILE, mimetype='text/markdown')
    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id'
    ).execute()
    doc_id = file.get('id')
    print(f"Created temp doc with ID: {doc_id}")
    # Get the structure of the new doc
    doc = docs_service.documents().get(documentId=doc_id).execute()
    breakpoint()
    return doc_id, doc

def wipe_document_contents(docs_service, document_id):
    doc = docs_service.documents().get(documentId=document_id).execute()
    content = doc['body'].get('content', [])
    max_index = max([c.get('endIndex', 0) for c in content], default=1)
    if max_index <= 2:
        return
    requests = [{
        'deleteContentRange': {
            'range': {
                'startIndex': 1,
                'endIndex': max_index - 1
            }
        }
    }]
    docs_service.documents().batchUpdate(
        documentId=document_id,
        body={'requests': requests}
    ).execute()
    print('Document content wiped.')

def insert_content_from_structure(docs_service, document_id, structure):
    docs_service.documents().batchUpdate(
        documentId=document_id,
        body={'requests': google_doc_to_batch_update_requests(structure,0)}
    ).execute()

    print("Content inserted from structure.")

def generate_requests(source_doc, elements, location, start_index):
    """
    Generate batch update requests for a list of structural elements.
    
    Args:
        source_doc: The source Google Docs document object.
        elements: List of structural elements to process.
        location: Dict specifying the insertion location (None for body, or table cell location).
        start_index: Starting index within the specified location.
    
    Returns:
        List of batch update requests.
    """
    requests = []
    current_index = start_index
    
    for element in elements:
        if 'paragraph' in element:
            for sub_elem in element['paragraph']['elements']:
                if 'textRun' in sub_elem:
                    text = sub_elem['textRun']['content']
                    style = sub_elem['textRun'].get('textStyle', {})
                    # Insert text request
                    insert_request = {
                        'insertText': {
                            'location': {'index': current_index},
                            'text': text
                        }
                    }
                    if location:
                        insert_request['insertText']['location'].update(location)
                    requests.append(insert_request)
                    # Apply text style if present
                    if style:
                        style_request = {
                            'updateTextStyle': {
                                'range': {
                                    'startIndex': current_index,
                                    'endIndex': current_index + len(text)
                                },
                                'textStyle': style,
                                'fields': '*'
                            }
                        }
                        if location:
                            style_request['updateTextStyle']['range'].update(location)
                        requests.append(style_request)
                    current_index += len(text)
                elif 'inlineObjectElement' in sub_elem:
                    object_id = sub_elem['inlineObjectElement']['inlineObjectId']
                    inline_object = source_doc['inlineObjects'][object_id]
                    uri = inline_object['inlineObjectProperties']['embeddedObject']['imageProperties']['contentUri']
                    # Insert inline image request
                    insert_request = {
                        'insertInlineImage': {
                            'location': {'index': current_index},
                            'uri': uri
                        }
                    }
                    if location:
                        insert_request['insertInlineImage']['location'].update(location)
                    requests.append(insert_request)
                    current_index += 1
        elif 'table' in element:
            if location is not None:
                raise Exception("Nested tables are not supported")
            rows = element['table']['rows']
            columns = element['table']['columns']
            # Insert table request
            insert_table_request = {
                'insertTable': {
                    'rows': rows,
                    'columns': columns,
                    'location': {'index': current_index}
                }
            }
            requests.append(insert_table_request)
            # Process each cell's content
            for row in range(rows):
                for col in range(columns):
                    cell = element['table']['tableRows'][row]['tableCells'][col]
                    cell_content = cell.get('content', [])
                    cell_location = {
                        'tableStartLocation': {'index': current_index},
                        'rowIndex': row,
                        'columnIndex': col
                    }
                    cell_requests = generate_requests(source_doc, cell_content, cell_location, 1)
                    requests.extend(cell_requests)
            current_index += 1  # Table occupies one slot
        else:
            # raise Exception(f"Unknown element type: {element.get('type')}. {element}")
            continue
    
    return requests

def google_doc_to_batch_update_requests(source_doc, starting_index):
    """
    Convert a Google Docs document object into batch update requests.
    
    Args:
        source_doc: The source document object from the Google Docs API.
        starting_index: The index in the target document where insertion begins.
    
    Returns:
        List of batch update requests compatible with the Google Docs batchUpdate API.
    
    Raises:
        Exception: If an unknown element type is encountered.
    """
    source_content = source_doc['body']['content']
    requests = generate_requests(source_doc, source_content, None, starting_index)
    return requests

def update_gdoc_with_markdown():
    creds = get_credentials()
    docs_service = build('docs', 'v1', credentials=creds)
    # 1. Create temp doc and get structure
    temp_doc_id, temp_doc = create_temp_doc_from_markdown()
    # 2. Wipe target doc
    wipe_document_contents(docs_service, TARGET_DOC_ID)
    # 3. Insert content from temp doc
    insert_content_from_structure(docs_service, TARGET_DOC_ID, temp_doc)
    print(f"Updated Google Doc: https://docs.google.com/document/d/{TARGET_DOC_ID}")
    # Optionally: delete temp doc
    # drive_service = build('drive', 'v3', credentials=creds)
    # drive_service.files().delete(fileId=temp_doc_id).execute()

if __name__ == '__main__':
    update_gdoc_with_markdown()