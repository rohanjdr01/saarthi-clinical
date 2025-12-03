/**
 * Queue Consumer Worker for Document Processing
 * 
 * Handles full-mode document processing jobs from Cloudflare Queues.
 * This runs in a separate worker context with higher CPU time limits.
 */

import { DocumentProcessor } from '../services/processing/processor.js';
import { DocumentRepository } from '../repositories/document.repository.js';

/**
 * Queue consumer entry point
 * Processes messages from the document processing queue
 */
export const queue = {
  async queue(batch, env, ctx) {
    // Process each message in the batch
    for (const message of batch.messages) {
      try {
        const job = JSON.parse(message.body);
        console.log(`📥 Processing queue job:`, {
          documentId: job.documentId,
          mode: job.mode,
          provider: job.provider
        });

        // Validate job
        if (!job.documentId) {
          console.error('❌ Invalid job: missing documentId');
          message.ack();
          continue;
        }

        // Initialize processor
        const processor = new DocumentProcessor(env, { provider: job.provider });
        const docRepo = DocumentRepository(env.DB);

        // Process based on mode
        if (job.mode === 'fast') {
          // Fast mode: quick highlight + vectorize
          await processor.processDocumentFast(job.documentId, { provider: job.provider });
        } else {
          // Full mode: complete extraction + patient sync
          await processor.processDocument(job.documentId, { 
            mode: job.mode === 'full' ? 'incremental' : job.mode,
            provider: job.provider 
          });
        }

        console.log(`✅ Successfully processed document ${job.documentId} in ${job.mode} mode`);
        message.ack();

      } catch (error) {
        console.error(`❌ Error processing queue message:`, error);
        
        // Update document status to failed
        try {
          const job = JSON.parse(message.body);
          if (job.documentId) {
            const docRepo = DocumentRepository(env.DB);
            await docRepo.updateProcessingStatus(
              job.documentId, 
              'failed', 
              error.message || 'Queue processing failed'
            );
          }
        } catch (updateError) {
          console.error('Failed to update document status:', updateError);
        }

        // Retry logic: retry up to 3 times, then acknowledge to prevent infinite loops
        const retries = message.attempts || 0;
        if (retries < 3) {
          console.log(`🔄 Retrying message (attempt ${retries + 1}/3)`);
          message.retry();
        } else {
          console.error(`❌ Max retries reached for document ${job?.documentId}, acknowledging to prevent infinite loop`);
          message.ack();
        }
      }
    }
  }
};

