"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDocumentText = extractDocumentText;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
/**
 * Extracts plain text from an uploaded document buffer (PDF, DOCX, TXT, or Image).
 */
async function extractDocumentText(buffer, mimetype, filename) {
    const lowerName = filename.toLowerCase();
    // 1. PDF Documents
    if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
        try {
            const data = await (0, pdf_parse_1.default)(buffer);
            return {
                text: data.text.trim(),
                pageCount: data.numpages,
                metadata: data.info || {},
                method: 'pdf-parse'
            };
        }
        catch (err) {
            console.error('PDF extraction failed:', err);
            throw new Error(`Failed to extract text from PDF "${filename}": ${err.message}`);
        }
    }
    // 2. Microsoft Word DOCX
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        lowerName.endsWith('.docx')) {
        try {
            const result = await mammoth_1.default.extractRawText({ buffer });
            return {
                text: result.value.trim(),
                method: 'mammoth'
            };
        }
        catch (err) {
            console.error('DOCX extraction failed:', err);
            throw new Error(`Failed to extract text from DOCX "${filename}": ${err.message}`);
        }
    }
    // 3. Plain text / Markdown
    if (mimetype.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
        return {
            text: buffer.toString('utf-8').trim(),
            method: 'text-decode'
        };
    }
    // 4. Image documents (JPG, PNG, WEBP)
    if (mimetype.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(filename)) {
        return {
            text: '', // Handled directly via multimodal Gemini
            method: 'gemini-vision',
            metadata: { isImageDocument: true }
        };
    }
    throw new Error(`Unsupported document format for "${filename}" (MIME: ${mimetype}). Please upload a PDF, DOCX, or Image file.`);
}
