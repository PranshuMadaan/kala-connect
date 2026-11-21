import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  metadata?: Record<string, any>;
  method: 'pdf-parse' | 'mammoth' | 'text-decode' | 'gemini-vision' | 'unsupported';
}

/**
 * Extracts plain text from an uploaded document buffer (PDF, DOCX, TXT, or Image).
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimetype: string,
  filename: string
): Promise<ExtractionResult> {
  const lowerName = filename.toLowerCase();

  // 1. PDF Documents
  if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
    try {
      const data = await pdfParse(buffer);
      return {
        text: data.text.trim(),
        pageCount: data.numpages,
        metadata: data.info || {},
        method: 'pdf-parse'
      };
    } catch (err: any) {
      console.error('PDF extraction failed:', err);
      throw new Error(`Failed to extract text from PDF "${filename}": ${err.message}`);
    }
  }

  // 2. Microsoft Word DOCX
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    lowerName.endsWith('.docx')
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: result.value.trim(),
        method: 'mammoth'
      };
    } catch (err: any) {
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
