# Quick Start Guide

Get started with the Saarthi Clinical API in minutes. This guide covers the essential endpoints you need to start using the platform.

## Base URL

- **Development:** `http://localhost:8787/api/v1`
- **Production:** `https://process.saarthihq.com/api/v1`

## Authentication

### Get a Firebase Token

1. **Using Firebase SDK (Recommended):**
   ```javascript
   // In your frontend
   const user = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
   const idToken = await user.user.getIdToken();
   ```

2. **For Testing (Script):**
   ```bash
   FIREBASE_API_KEY=your-key node scripts/generate-firebase-token.js test@example.com
   ```

### Verify Token
```bash
POST /api/v1/auth/verify
Content-Type: application/json

{
  "idToken": "your-firebase-token"
}
```

### Use Token in Requests
Include the token in the `Authorization` header:
```bash
Authorization: Bearer your-firebase-token
```

## Core Workflows

### 1. Create a Patient

```bash
POST /api/v1/patients
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "age": 65,
  "sex": "male",
  "patient_id_uhid": "UHID-12345",
  "primary_oncologist": "Dr. Smith",
  "primary_center": "City Hospital"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "pt_abc123",
    "name": "John Doe",
    ...
  }
}
```

### 2. Upload Documents

```bash
POST /api/v1/patients/pt_abc123/documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

files: @document.pdf
category: pathology
process_immediately: true
provider: openai
```

**Response:**
```json
{
  "success": true,
  "documents_uploaded": 1,
  "processing_status": "processing",
  "data": [{
    "id": "doc_xyz789",
    "filename": "document.pdf",
    "processing_status": "pending"
  }]
}
```

### 3. Check Processing Status

```bash
GET /api/v1/patients/pt_abc123/documents/doc_xyz789
Authorization: Bearer <token>
```

Wait until `processing_status: "completed"` and `vectorize_status: "completed"`.

### 4. Search Documents (RAG)

```bash
POST /api/v1/patients/pt_abc123/documents/search
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "What was the diagnosis?",
  "top_k": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [{
      "document_id": "doc_xyz789",
      "chunk_text": "Primary diagnosis: Adenocarcinoma...",
      "relevance_score": 0.89
    }]
  }
}
```

## Essential Endpoints

### Patients

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/patients` | Create patient |
| `GET` | `/api/v1/patients` | List patients |
| `GET` | `/api/v1/patients/:id` | Get patient details |
| `PATCH` | `/api/v1/patients/:id` | Update patient |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/patients/:id/documents` | Upload documents |
| `GET` | `/api/v1/patients/:id/documents` | List documents |
| `GET` | `/api/v1/patients/:id/documents/:docId` | Get document metadata |
| `POST` | `/api/v1/patients/:id/documents/search` | Semantic search (RAG) |
| `POST` | `/api/v1/patients/:id/documents/:docId/reprocess` | Reprocess document |

### Diagnosis & Staging

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/patients/:id/diagnosis` | Get diagnosis |
| `PUT` | `/api/v1/patients/:id/diagnosis` | Update diagnosis |
| `GET` | `/api/v1/patients/:id/staging` | Get staging |
| `PUT` | `/api/v1/patients/:id/staging` | Update staging |

### Treatment

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/patients/:id/treatment` | Get treatment overview |
| `PUT` | `/api/v1/patients/:id/treatment` | Update treatment |
| `GET` | `/api/v1/patients/:id/treatment/cycles` | List cycles |
| `POST` | `/api/v1/patients/:id/treatment/cycles` | Add cycle |

### Medications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/patients/:id/medications` | Get medications |
| `POST` | `/api/v1/patients/:id/medications` | Add medication |
| `PUT` | `/api/v1/patients/:id/medications/:medId` | Update medication |
| `GET` | `/api/v1/patients/:id/medications/interactions` | Check drug interactions |

### Labs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/patients/:id/labs/latest` | Get latest labs |
| `GET` | `/api/v1/patients/:id/labs/trends?marker=hemoglobin` | Get lab trends |
| `GET` | `/api/v1/patients/:id/tumor-markers` | Get tumor markers |

### Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/patients/:id/alerts` | Get all alerts |
| `POST` | `/api/v1/patients/:id/alerts` | Create alert |

### Timeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/patients/:id/timeline` | Get patient timeline |

## Processing Modes

### Fast Mode (Default)
- Extracts medical highlight
- Vectorizes for search
- Documents searchable immediately
- Use: `process_immediately=true` (default)

### Full Mode
- Complete AI extraction
- Syncs to patient profile
- Updates diagnosis, medications, treatment
- Use: `process_mode=full`

## Common Query Examples

### Search for Diagnosis
```json
{
  "query": "What was the primary diagnosis?",
  "top_k": 3
}
```

### Search for Treatment
```json
{
  "query": "What chemotherapy regimen was used?",
  "top_k": 5
}
```

### Search with Category Filter
```json
{
  "query": "HER2 status",
  "top_k": 5,
  "category_filter": ["pathology"]
}
```

## Health Check

```bash
GET /api/v1/health
```

**Response:**
```json
{
  "success": true,
  "message": "Saarthi Clinical Platform is running",
  "services": {
    "database": true,
    "storage": true,
    "gemini": true,
    "openai": true
  }
}
```

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Not Found",
  "message": "Patient not found",
  "statusCode": 404
}
```

## Next Steps

- See [README.md](./README.md) for architecture and design details
- See [UPCOMING_FEATURES.md](./UPCOMING_FEATURES.md) for planned features
- Check Postman collection: `postman_collection.json`

## Troubleshooting

### 401 Unauthorized
- Check Firebase token is valid (expires after 1 hour)
- Get fresh token: `await auth.currentUser.getIdToken(true)`

### 404 Not Found
- Verify patient/document IDs are correct
- Check endpoint path matches exactly

### Processing Stuck
- Check logs: `npx wrangler tail --env production`
- Reprocess: `POST /api/v1/patients/:id/documents/:docId/reprocess`

### RAG Not Working
- Ensure `vectorize_status: "completed"` on document
- Only works in production/staging (not local)
- Check Vectorize index exists: `npx wrangler vectorize list`
