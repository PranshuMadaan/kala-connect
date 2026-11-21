"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDocumentText = extractDocumentText;
/**
 * Extracts plain text from an uploaded document buffer (PDF, DOCX, TXT, or Image).
 */
async function extractDocumentText(buffer, mimetype, filename) {
    const lowerName = filename.toLowerCase();
    // 1. Plain text / Markdown / JSON
    if (mimetype.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.json')) {
        return {
            text: buffer.toString('utf-8').trim(),
            method: 'text-decode'
        };
    }
    // 2. PDF Documents
    if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
        // Check if pdf-parse is available
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            return {
                text: data.text.trim(),
                pageCount: data.numpages,
                metadata: data.info || {},
                method: 'pdf-basic'
            };
        }
        catch {
            // Basic text stream extractor from raw PDF stream
            const rawString = buffer.toString('latin1');
            const textMatches = rawString.match(/\(([^()]+)\)[\s]*Tj/g) || [];
            const extractedText = textMatches.map(m => m.replace(/^\(|\)[\s]*Tj$/g, '')).join(' ');
            return {
                text: extractedText.trim() || 'PDF Document uploaded (Text extraction fallback)',
                pageCount: 1,
                method: 'pdf-basic'
            };
        }
    }
    // 3. Microsoft Word DOCX
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        lowerName.endsWith('.docx')) {
        try {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            return {
                text: result.value.trim(),
                method: 'text-decode'
            };
        }
        catch {
            // DOCX is a zip file; fallback to utf8 string extraction
            const raw = buffer.toString('utf-8');
            const cleaned = raw.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\s]/g, '').trim();
            return {
                text: cleaned.slice(0, 5000),
                method: 'text-decode'
            };
        }
    }
    // 4. Image documents (JPG, PNG, WEBP)
    if (mimetype.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(filename)) {
        return {
            text: '', // Handled directly via multimodal Gemini
            method: 'gemini-vision',
            metadata: { isImageDocument: true }
        };
    }
    return {
        text: buffer.toString('utf-8').slice(0, 2000),
        method: 'text-decode'
    };
}
//# sourceMappingURL=docExtraction.js.map