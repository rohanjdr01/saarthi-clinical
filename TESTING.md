# Testing & Debugging Guide

Complete guide for testing all Saarthi Clinical API endpoints with logging.

---

## 🔍 **Logging System**

### **Request/Response Logger**

Every API request is now logged with full details:

**Log Format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 INCOMING REQUEST
   Method: POST
   Path: /api/v1/patients/pt_abc123/documents
   URL: http://localhost:8787/api/v1/patients/pt_abc123/documents
   Time: 2025-11-30T10:00:00.000Z
   Params: {"patientId":"pt_abc123"}
   Headers: {...}

📤 RESPONSE
   Status: 202
   Duration: 1234ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**What's Logged:**
- ✅ HTTP Method (GET, POST, etc.)
- ✅ Full URL and Path
- ✅ Query Parameters
- ✅ Route Parameters
- ✅ Request Headers (excluding sensitive ones)
- ✅ Response Status Code
- ✅ Request Duration
- ✅ Errors with Stack Traces

**Location:** All logs appear in your dev server console

---

## 🧪 **Running Tests**

### **Quick Test**
```bash
npm test
```

### **Watch Mode** (auto-rerun on changes)
```bash
npm run test:watch
```

### **UI Mode** (visual test runner)
```bash
npm run test:ui
```

### **Test Coverage**
```bash
npm test -- --coverage
```

---

## 📮 **Using Postman**

### **Import Collection**
1. Open Postman
2. Click **Import**
3. Select file: `postman_collection.json`
4. Collection imported with all 23 endpoints!

### **Collection Variables**
The collection uses variables that auto-update:
- `{{baseUrl}}` - API base URL (default: http://localhost:8787/api/v1)
- `{{patientId}}` - Auto-saved from patient creation
- `{{documentId}}` - Auto-saved from document upload

### **Test Flow**
1. **Create Patient** → Saves `patientId`
2. **Upload Documents** → Saves `documentId`
3. **All other endpoints** → Use saved IDs

---

## 🔧 **Debugging the 404 Error**

### **Check the Request URL**

The document upload endpoint has **NO trailing slash**:

**✅ Correct:**
```
POST /api/v1/patients/{patientId}/documents
```

**❌ Wrong:**
```
POST /api/v1/patients/{patientId}/documents/
```

### **Common Issues**

#### **Issue 1: Trailing Slash**
Frontend might be adding a trailing slash:
```javascript
// Check your frontend code
fetch(`${API_BASE}/patients/${patientId}/documents/`)  // ❌ Wrong
fetch(`${API_BASE}/patients/${patientId}/documents`)   // ✅ Correct
```

#### **Issue 2: Patient ID Format**
```bash
# Check logs for actual patient ID being sent
# Should be like: pt_abc123xyz
```

#### **Issue 3: CORS**
```bash
# Allowed origins:
# - http://localhost:3000
# - http://localhost:5000
# - http://localhost:8000
```

### **Debug Steps**

1. **Start dev server with logging:**
   ```bash
   npm run dev
   ```

2. **Check console logs** - You'll see:
   ```
   📥 INCOMING REQUEST
      Method: POST
      Path: /api/v1/patients/pt_abc123/documents
   ```

3. **If you see 404:**
   - Check the exact path in logs
   - Verify patient ID exists
   - Check for trailing slashes

4. **Test with curl:**
   ```bash
   # Create patient first
   curl -X POST http://localhost:8787/api/v1/patients \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Patient",
       "age": 65,
       "gender": "male",
       "caregiver": {
         "name": "Test Caregiver",
         "relation": "daughter",
         "contact": "+91-9999999999"
       }
     }'

   # Note the patient ID from response
   # Then upload document (replace pt_xxx with actual ID)
   curl -X POST http://localhost:8787/api/v1/patients/pt_xxx/documents \
     -F "files=@test.pdf"
   ```

---

## 📊 **Test Coverage**

### **Current Test Suite Covers:**

**✅ Health (1 test)**
- Health check

**✅ Patients (5 tests)**
- Create patient
- List patients
- Get patient by ID
- Update patient
- 404 for invalid ID

**✅ Documents (4 tests)**
- Upload multiple documents
- List documents
- Get document by ID
- Validation errors

**✅ Case-Packs (2 tests)**
- Get case-pack
- Update metadata

**✅ Processing (3 tests)**
- Get status
- Get log
- Process document

**✅ Views (2 tests)**
- Get summary
- Get detailed section

**✅ Timeline (2 tests)**
- Get timeline
- Get tracks

**Total: 19 automated tests**

---

## 🚀 **Manual Testing Checklist**

### **1. Basic Flow**
- [ ] Create patient
- [ ] Upload 2-3 documents
- [ ] Check processing status
- [ ] View case-pack
- [ ] Verify medical highlights appear

### **2. Multi-File Upload**
- [ ] Upload 3+ files at once
- [ ] Mix file types (PDF, JPG, TXT)
- [ ] Check all files saved
- [ ] Verify case-pack contains all

### **3. Processing**
- [ ] Upload with `process_immediately=false`
- [ ] Verify status is "pending"
- [ ] Manually trigger processing
- [ ] Upload with `process_immediately=true`
- [ ] Verify processing starts immediately

### **4. Error Handling**
- [ ] Upload with no files → 400 error
- [ ] Invalid patient ID → 404 error
- [ ] Invalid document type → 400 error

---

## 📝 **Sample Test Data**

### **Test Patient**
```json
{
  "name": "Test Patient",
  "age": 65,
  "gender": "male",
  "caregiver": {
    "name": "Test Caregiver",
    "relation": "daughter",
    "contact": "+91-9999999999"
  }
}
```

### **Test Document Upload**
```bash
# Create a test file
echo "This is a test pathology report." > test_report.txt

# Upload it
curl -X POST http://localhost:8787/api/v1/patients/pt_xxx/documents \
  -F "files=@test_report.txt" \
  -F "document_type=pathology" \
  -F "process_immediately=true"
```

---

## 🐛 **Troubleshooting**

### **Server Not Starting**
```bash
# Check if port is in use
lsof -i :8787

# Kill existing process
kill -9 <PID>

# Restart
npm run dev
```

### **Database Errors**
```bash
# Re-run migration
npm run d1:migrate

# Check tables exist
wrangler d1 execute DB --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### **CORS Errors**
```bash
# Check if your origin is allowed
# Edit src/index.js line 18-20 to add your origin
```

### **Test Failures**
```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run specific test
npm test -- -t "should upload multiple documents"
```

---

## 📚 **Logs Location**

**Development Server:**
```
Console output from: npm run dev
```

**Test Results:**
```
Console output from: npm test
Coverage report: coverage/index.html
```

**Wrangler Logs:**
```
Console output when running wrangler commands
```

---

## ✅ **Testing Checklist**

Before deploying, verify:

- [ ] All 19 automated tests pass
- [ ] Logging shows requests/responses clearly
- [ ] Postman collection works for all endpoints
- [ ] Multi-file upload works in frontend
- [ ] Processing screen shows progress
- [ ] Medical highlights appear in documents
- [ ] Case-pack view displays correctly
- [ ] Error messages are clear

---

## 🔗 **Quick Links**

- **API Docs:** `API_ENDPOINTS.md`
- **Postman Collection:** `postman_collection.json`
- **Test Suite:** `src/tests/api.test.js`
- **Logger Middleware:** `src/middleware/logger.js`

---

**Last Updated:** 2025-11-30
