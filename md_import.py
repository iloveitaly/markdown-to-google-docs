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

def create_google_doc():
    creds = get_credentials()
    drive_service = build('drive', 'v3', credentials=creds)
    
    file_metadata = {
        'name': 'New Markdown Doc',
        'mimeType': 'application/vnd.google-apps.document'
    }
    
    media = MediaFileUpload(INPUT_FILE, mimetype='text/markdown')
    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id'
    ).execute()
    
    doc_id = file.get('id')
    return f"https://docs.google.com/document/d/{doc_id}"

if __name__ == '__main__':
    doc_url = create_google_doc()
    print(f"Created Google Doc: {doc_url}")