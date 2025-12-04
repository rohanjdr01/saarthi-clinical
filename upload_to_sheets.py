import csv
import sys
import os

try:
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
except ImportError:
    print("Error: Missing dependencies.")
    print("Please run: pip install gspread oauth2client")
    sys.exit(1)

def upload_to_sheets(csv_file, credentials_file, sheet_name):
    # Define the scope
    scope = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]

    # Authenticate using the service account
    try:
        creds = ServiceAccountCredentials.from_json_keyfile_name(credentials_file, scope)
        client = gspread.authorize(creds)
    except Exception as e:
        print(f"Error authenticating: {e}")
        return

    # Open the spreadsheet
    try:
        # Try to open existing sheet
        sheet = client.open(sheet_name)
        print(f"Opened existing sheet: {sheet_name}")
    except gspread.SpreadsheetNotFound:
        # Create new sheet
        try:
            sheet = client.create(sheet_name)
            # Share with the user's email if possible, but we don't know it.
            # The service account owns it. The user needs to share the folder with the service account
            # or we print the URL and hope they can access it (they can't unless shared).
            # Better to ask user to create a blank sheet and share with service account email.
            print(f"Created new sheet: {sheet_name}")
            print(f"URL: {sheet.url}")
            print("IMPORTANT: Ensure you have access to this sheet or share a folder with the service account email.")
        except Exception as e:
            print(f"Error creating sheet: {e}")
            return

    # Select the first worksheet
    worksheet = sheet.get_worksheet(0)

    # Read CSV
    with open(csv_file, 'r') as f:
        reader = csv.reader(f)
        data = list(reader)

    # Clear existing content and update
    worksheet.clear()
    worksheet.update(data)
    
    print(f"Successfully uploaded {len(data)} rows to '{sheet_name}'.")
    print(f"Link: {sheet.url}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 upload_to_sheets.py <credentials_json> <sheet_name> [csv_file]")
        print("Example: python3 upload_to_sheets.py credentials.json 'Clinical Routes' route_details_final.csv")
        sys.exit(1)

    creds_file = sys.argv[1]
    sheet_name = sys.argv[2]
    csv_file = sys.argv[3] if len(sys.argv) > 3 else 'route_details_final.csv'

    if not os.path.exists(creds_file):
        print(f"Error: Credentials file '{creds_file}' not found.")
        sys.exit(1)
        
    if not os.path.exists(csv_file):
        print(f"Error: CSV file '{csv_file}' not found.")
        sys.exit(1)

    upload_to_sheets(csv_file, creds_file, sheet_name)
