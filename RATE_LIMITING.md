# Rate Limiting & Queue Management

Comprehensive guide for Gemini API rate limiting to prevent quota exhaustion.

---

## 🚦 **Overview**

The system now includes intelligent rate limiting for all Gemini API calls to prevent hitting quota limits.

**What's Protected:**
- ✅ Document processing (highlight extraction)
- ✅ Medical data extraction
- ✅ Timeline event generation
- ✅ Summary generation
- ✅ All AI-powered features

---

## ⚙️ **Default Limits**

Based on Gemini 2.0 Flash **Free Tier**:

```
Requests Per Minute (RPM): 15
Tokens Per Minute (TPM):   1,000,000
Max Retries:               3
Base Retry Delay:          2 seconds
```

---

## 🎯 **How It Works**

### **1. Request Queuing**
When you upload multiple documents:
```
Upload 5 documents → All queued
↓
Process 1st document → Send to Gemini
Wait for response
↓
Process 2nd document → Send to Gemini
... and so on
```

### **2. Rate Limit Checking**
Before each request:
```
✓ Check requests in last 60 seconds
✓ Check tokens used in last 60 seconds
✓ Wait if limit reached
✓ Proceed when safe
```

### **3. Automatic Retries**
If request fails:
```
Attempt 1: Immediate
↓ Fails
Attempt 2: Wait 2 seconds
↓ Fails
Attempt 3: Wait 4 seconds
↓ Fails
Attempt 4: Wait 8 seconds
↓
Final result (success or error)
```

### **4. Exponential Backoff**
```
Retry 1: 2 seconds
Retry 2: 4 seconds
Retry 3: 8 seconds
```

---

## 📊 **Monitoring**

### **View Rate Limiter Stats**

The system automatically logs stats every time you process documents:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Rate Limiter Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Requests:      45
Successful:          42
Failed:              3
Retried:             8
Currently Queued:    0
Avg Wait Time:       1234ms

Requests (last min): 12/15
Tokens (last min):   45,000/1,000,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### **Real-Time Logging**

You'll see detailed logs in your dev console:

```
📋 Request queued (queue size: 3)
⏳ Rate limit reached. Waiting 5000ms...
🔄 Processing request (waited 234ms, queue: 2)
🤖 Making Gemini API request...
✅ Gemini request successful (tokens: 1500)
```

---

## 🔧 **Configuration**

### **Customize Rate Limits**

Edit `src/utils/rate-limiter.js`:

```javascript
export const geminiRateLimiter = new RateLimiter({
  maxRequestsPerMinute: 15,    // Change this
  maxTokensPerMinute: 1000000, // Or this
  maxRetries: 3,               // Number of retries
  baseRetryDelay: 2000         // Initial retry delay
});
```

### **Gemini API Tiers**

**Free Tier (Default):**
```
15 RPM
1M TPM
```

**Pay-as-you-go:**
```
1,000 RPM (increase maxRequestsPerMinute to 1000)
4M TPM (increase maxTokensPerMinute to 4000000)
```

**Higher Tiers:**
```
2,000 RPM
4M TPM
```

Update the configuration based on your Gemini API tier!

---

## 🎨 **User Experience**

### **What Users See**

**1. Upload Screen:**
```
Processing Documents
1 of 3 completed

doc1.pdf [processing]
  ✓ Upload
  ✓ Save to storage
  ⟳ Extract highlight  ← Currently waiting in queue
  ○ Extract data
  ○ Update timeline
```

**2. Processing Delays:**
- If queue is long, processing steps will pause
- Users see "⟳" spinning icon
- Progress continues automatically
- No user action needed

---

## 🐛 **Troubleshooting**

### **Issue: "Rate limit exceeded" Error**

**Cause:** Too many requests too fast

**Solution:**
1. Wait 1 minute
2. System will automatically retry
3. Queue will process when limits reset

**Or increase limits if you have paid tier:**
```javascript
maxRequestsPerMinute: 1000,  // For paid tier
```

---

### **Issue: Long Processing Times**

**Cause:** Many documents in queue

**What happens:**
```
Document 1: 0-2 seconds
Document 2: 2-4 seconds
Document 3: 4-6 seconds
... etc
```

**This is normal!** The rate limiter spaces out requests to avoid hitting limits.

**To speed up:**
1. Upgrade to paid Gemini tier
2. Increase `maxRequestsPerMinute`
3. Process fewer documents at once

---

### **Issue: Retries Exhausted**

**Cause:** Gemini API is down or returning errors

**Error message:**
```
Max retries (3) exceeded. Last error: [error details]
```

**Solutions:**
1. Check Gemini API status
2. Verify API key is valid
3. Check network connection
4. Increase `maxRetries` if needed

---

## 📈 **Performance Tips**

### **Optimize Token Usage**

**Before:** Each document uses ~2,000 tokens
```
10 documents = 20,000 tokens
```

**After optimization:**
- Reduce prompt length
- Use smaller model
- Extract only essential data

### **Batch Processing**

**Good:**
```
Upload 5 documents with process_immediately=false
→ No queue, instant upload
→ Process later manually
```

**Also Good:**
```
Upload 3 documents with process_immediately=true
→ Manageable queue
→ Completes in ~10-15 seconds
```

**Problematic:**
```
Upload 20 documents with process_immediately=true
→ Long queue
→ May hit rate limits
→ Takes 2-3 minutes
```

---

## 🎯 **Best Practices**

### **1. For Users:**
- Upload in batches of 3-5 documents
- Use `process_immediately=false` for large uploads
- Process manually when ready
- Check processing status before uploading more

### **2. For Developers:**
- Monitor rate limiter stats
- Adjust limits based on API tier
- Add delays between large operations
- Use queue size to show users wait time

### **3. For Production:**
- Upgrade to paid Gemini tier
- Set higher rate limits
- Monitor token usage
- Set up alerts for quota

---

## 📊 **Rate Limit Examples**

### **Example 1: Small Upload**
```
Upload 3 documents (process_immediately=true)

Request 1: 0s    ✓ Success (1,200 tokens)
Request 2: 0.2s  ✓ Success (1,500 tokens)
Request 3: 0.4s  ✓ Success (1,100 tokens)

Total time: ~5 seconds
Total tokens: 3,800
```

### **Example 2: Large Upload**
```
Upload 10 documents (process_immediately=true)

Requests 1-10: Queued
Processing sequentially...

Request 1:  0s    ✓
Request 2:  4s    ✓
Request 3:  8s    ✓
Request 4:  12s   ✓
Request 5:  16s   ✓
Request 6:  20s   ✓
Request 7:  24s   ✓
Request 8:  28s   ✓
Request 9:  32s   ✓
Request 10: 36s   ✓

Total time: ~40 seconds
```

### **Example 3: Rate Limit Hit**
```
Upload 20 documents

Requests 1-15: Process normally (0-60s)
Request 16: WAIT - Rate limit reached
           Wait 10 seconds...
           Retry ✓
Continue processing...
```

---

## 🔍 **Debugging**

### **Enable Detailed Logging**

Rate limiter logs are enabled by default. You'll see:

```
🚦 Rate Limiter initialized
   Max RPM: 15
   Max TPM: 1000000

📋 Request queued (queue size: 1)
🔄 Processing request (waited 0ms, queue: 0)
🤖 Making Gemini API request...
✅ Gemini request successful (tokens: 1500)
```

### **Get Current Stats**

In your code:
```javascript
import { geminiRateLimiter } from './utils/rate-limiter.js';

const stats = geminiRateLimiter.getStats();
console.log(stats);

// Or print formatted:
geminiRateLimiter.printStats();
```

---

## 🚀 **Quick Start**

The rate limiter is **automatic** - no setup needed!

Just use the system normally:
1. Upload documents
2. Process them
3. Rate limiter handles the rest

**It will:**
- ✅ Queue requests automatically
- ✅ Respect rate limits
- ✅ Retry on failures
- ✅ Log all activity
- ✅ Track usage

---

## 📝 **Summary**

**Pros:**
- ✅ Never hit rate limits
- ✅ Automatic retry on errors
- ✅ Queue management
- ✅ Token tracking
- ✅ No manual configuration needed

**Cons:**
- ⏱️ Processing may be slower (by design)
- 📊 Need to monitor queue size
- 💰 May need paid tier for high volume

**Bottom line:** Rate limiting prevents errors and ensures reliable processing, even at the cost of slightly longer processing times.

---

**Last Updated:** 2025-11-30
