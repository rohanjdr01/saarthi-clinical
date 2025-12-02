#!/usr/bin/env node
/**
 * Merge Postman collections - combines backup with Phase 2-3 additions
 */

const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, 'postman_collection.backup.json');
const additionsPath = path.join(__dirname, 'postman_collection_phase2_additions.json');
const outputPath = path.join(__dirname, 'postman_collection.json');

// Read both files
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const additions = JSON.parse(fs.readFileSync(additionsPath, 'utf8'));

// Update info
backup.info.name = "Saarthi Clinical API (Complete - Phase 2-3)";
backup.info.description = `Complete API collection for Saarthi Clinical Platform - Medical document processing with AI

## Phase 2-3 Updates
- ✅ Diagnosis & Staging endpoints with version history
- ✅ Treatment & Cycles management
- ✅ Document vectorization & semantic search (RAG)
- ✅ Field-level source tracking
- ✅ Admin editing with version history

## Authentication

### Option 1: Phone OTP (Backend Endpoints)
1. Send OTP: \`POST /api/v1/auth/phone/send\` with \`{phoneNumber: "+1234567890"}\`
2. Verify OTP: \`POST /api/v1/auth/phone/verify\` with \`{sessionInfo, code}\`
3. Token is automatically saved to \`firebaseToken\` variable

### Option 2: Generate Token (For Testing)
1. Generate a Firebase ID token using:
   \`\`\`bash
   FIREBASE_API_KEY=your-key node scripts/generate-firebase-token.js test@example.com
   \`\`\`
2. Set the \`firebaseToken\` variable in this collection with the generated token

### Using Token
Use the token in the \`Authorization: Bearer <token>\` header for protected endpoints

## Endpoints

- **Auth**: \`/api/v1/auth/*\` - Authentication endpoints
- **Health**: \`/api/v1/health\` - Health check
- **Patients**: \`/api/v1/patients/*\` - Patient management (with extended fields)
- **Documents**: \`/api/v1/patients/:id/documents/*\` - Document upload, vectorization, search
- **Diagnosis & Staging**: \`/api/v1/patients/:id/diagnosis\` & \`/staging\` - Clinical data with version history
- **Treatment**: \`/api/v1/patients/:id/treatment/*\` - Treatment regimens & cycles
- **Processing**: \`/api/v1/patients/:id/processing/*\` - AI document processing
- **Timeline**: \`/api/v1/patients/:id/timeline/*\` - Medical timeline
- **Intake**: \`/api/v1/intake\` - One-step patient creation from documents`;

backup.info._exporter_id = "saarthi-clinical-v3";

// Add document reorder endpoint to Documents section if not present
const documentsSection = backup.item.find(item => item.name === "Documents");
if (documentsSection) {
  // Check if reorder endpoint exists
  const hasReorder = documentsSection.item.some(item =>
    item.name === "Reorder Case-Pack Documents" || item.name === "Reorder Documents"
  );

  if (!hasReorder) {
    documentsSection.item.push({
      "name": "Reorder Case-Pack Documents",
      "request": {
        "method": "POST",
        "header": [
          {"key": "Content-Type", "value": "application/json"}
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"document_orders\": [\n    {\"document_id\": \"doc_123\", \"order\": 1},\n    {\"document_id\": \"doc_456\", \"order\": 2}\n  ]\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/patients/{{patientId}}/documents/reorder",
          "host": ["{{baseUrl}}"],
          "path": ["patients", "{{patientId}}", "documents", "reorder"]
        },
        "description": "Reorder documents in case-pack (Phase 2: merged functionality)"
      }
    });
  }

  // Check if reprocess endpoint exists
  const hasReprocess = documentsSection.item.some(item =>
    item.name === "Reprocess Document"
  );

  if (!hasReprocess) {
    documentsSection.item.push({
      "name": "Reprocess Document",
      "request": {
        "method": "POST",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/patients/{{patientId}}/documents/{{documentId}}/reprocess",
          "host": ["{{baseUrl}}"],
          "path": ["patients", "{{patientId}}", "documents", "{{documentId}}", "reprocess"]
        },
        "description": "Trigger reprocessing of a document with AI (Phase 2)"
      }
    });
  }

  // Update existing vectorize and search endpoints to use baseUrl instead of localUrl
  documentsSection.item.forEach(item => {
    if (item.name === "Vectorize Document" && item.request.url.raw.includes("{{localUrl}}")) {
      item.request.url.raw = item.request.url.raw.replace("{{localUrl}}", "{{baseUrl}}");
      item.request.url.host = ["{{baseUrl}}"];
      item.description = "Manually trigger vectorization for a document (Phase 3: Workers AI embeddings)";
    }
    if (item.name === "Semantic Search" && item.request.url.raw.includes("{{localUrl}}")) {
      item.request.url.raw = item.request.url.raw.replace("{{localUrl}}", "{{baseUrl}}");
      item.request.url.host = ["{{baseUrl}}"];
      item.description = "Semantic search over document chunks using Vectorize + Workers AI (Phase 3)";
    }
  });
}

// Find the index where we want to insert new sections (after Processing, before Case-Packs)
const processingIndex = backup.item.findIndex(item => item.name === "Processing");
const insertIndex = processingIndex + 1;

// Insert all new sections from additions
additions.item.forEach((section, idx) => {
  // Check if section already exists
  const existingIndex = backup.item.findIndex(item => item.name === section.name);

  if (existingIndex === -1) {
    // Section doesn't exist, insert it
    backup.item.splice(insertIndex + idx, 0, section);
  }
});

// Write merged collection
fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2));

console.log('✅ Successfully merged Postman collections!');
console.log(`📄 Output: ${outputPath}`);
console.log('\n📋 New sections added:');
console.log('  - Diagnosis & Staging (4 endpoints)');
console.log('  - Treatment (6 endpoints)');
console.log('  - Document Vectorization & Search (2 additional endpoints)');
console.log('\nYou can now import postman_collection.json into Postman!');
