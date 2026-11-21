"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDocumentWithAI = analyzeDocumentWithAI;
exports.generateProductNarrativeWithAI = generateProductNarrativeWithAI;
const generative_ai_1 = require("@google/generative-ai");
function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('AIzaSy...')) {
        throw new Error('GEMINI_API_KEY is not configured. Please add your real Gemini API key to .env (see README_BACKEND_SETUP.md for instructions).');
    }
    return new generative_ai_1.GoogleGenerativeAI(apiKey.trim());
}
/**
 * Analyzes an uploaded craft document using Gemini LLM.
 */
async function analyzeDocumentWithAI(text, filename, imageBuffer, mimeType) {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
    });
    const prompt = `You are the chief authenticity and craft specifications analyst for Kala Connect, a direct artisan marketplace in India.
Analyze the following document (${filename}) and extract all verified craft facts.

CRITICAL INSTRUCTIONS:
1. Extract ONLY facts explicitly stated in the document.
2. NEVER invent details, dates, materials, or locations absent from the text.
3. DO NOT claim that a certificate is legally authentic merely because it appears in this document; state observations neutrally.
4. Distinguish between verified claims and missing details.

Output valid JSON matching this schema:
{
  "document_type": "string (e.g. Master Artisan Certificate, Material Purity Assay, GI Registration Proof, Craft Spec Sheet, Guild Letter, Studio Invoice)",
  "product_name": "string (name or title of craft mentioned, or empty string)",
  "materials_mentioned": ["array of exact raw materials stated"],
  "product_specifications": "string (dimensions, weights, thread counts, or purity grades)",
  "craft_techniques": ["array of craft methods or tools explicitly mentioned"],
  "origin_village": "string (village or town, or empty string)",
  "origin_state": "string (state, or empty string)",
  "important_dates": ["array of issue dates, validity dates, or craft lineage dates"],
  "registration_numbers": ["array of certificate IDs, GI numbers, or artisan registration codes"],
  "missing_information": ["array of missing technical or origin details needed for complete listing"],
  "potential_inconsistencies": ["array of any conflicting dates, missing signatures, or ambiguities observed"],
  "confidence_score": "High" | "Medium" | "Low",
  "key_quote": "string (verbatim excerpt from the document demonstrating provenance)"
}`;
    let contents = [];
    if (imageBuffer && mimeType) {
        contents = [
            prompt,
            {
                inlineData: {
                    data: imageBuffer.toString('base64'),
                    mimeType
                }
            }
        ];
    }
    else {
        contents = [prompt, `\n\n--- DOCUMENT CONTENT (${filename}) ---\n${text}`];
    }
    const response = await model.generateContent(contents);
    const responseText = response.response.text();
    const parsed = JSON.parse(responseText);
    parsed.disclaimer =
        'AI Document Analysis extracts information directly from provided records. It does not replace legal certification.';
    return parsed;
}
/**
 * Generates rich, authentic, input-grounded product descriptions in English and Hindi.
 */
async function generateProductNarrativeWithAI(input) {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
    });
    const prompt = `You are the master craft storyteller for Kala Connect, India's AI-powered direct artisan marketplace.
Synthesize an authentic, culturally rich, and compelling product listing using the ARTISAN'S EXACT INPUTS.

Artisan's Verified Inputs:
- Product Title: ${input.title}
- Craft Category: ${input.category}
- Specific Crafting Technique: ${input.technique || 'Traditional handcrafting'}
- Raw Materials: ${input.materials}
- Time Taken to Make: ${input.time_taken_days || 1} day(s)
- Artisan Village/Town: ${input.village || 'Heritage craft cluster'}
- State: ${input.state || 'India'}
- Dimensions: ${input.dimensions || 'Handcrafted specifications'}
- Geographical Indication (GI) Tagged: ${input.is_gi_tagged ? 'Yes, certified GI origin' : 'No'}
- Custom Orders: ${input.custom_orders_accepted ? 'Accepted by artisan' : 'Standard piece'}
- Selected Narrative Tone: ${input.tone || 'heritage'} (heritage = ancestral lineage & history, modern = slow luxury & contemporary gifting, artisan = first-person humble voice)
${input.documentFacts ? `\nVerified Document Facts: ${input.documentFacts}` : ''}

STRICT GROUNDING RULES:
1. Ground the story strictly in the specified materials (${input.materials}), technique (${input.technique}), and location (${input.village}, ${input.state}).
2. NEVER hallucinate or invent materials, origins, or GI claims that contradict the inputs.
3. Generate a complete, culturally accurate Hindi translation of the narrative.

Output JSON matching this exact structure:
{
  "title": "Polished, evocative, professional product title",
  "description": "Comprehensive, multi-paragraph product story (approx 150-200 words) highlighting provenance, craftsmanship, and aesthetic value",
  "short_description": "Punchy 2-sentence summary perfect for catalog previews and mobile screens",
  "category": "${input.category}",
  "search_keywords": ["array", "of", "6-8", "relevant", "search", "tags"],
  "material_summary": "Concise bullet-style summary of raw materials",
  "technique_summary": "Concise summary of craft technique",
  "highlights": ["3-4 bullet point highlights (e.g. 100% natural dye, 4 days hand-carved, direct from village)"],
  "care_guide": "Specific care, cleaning, and longevity instructions suitable for these materials",
  "hindi_description": "Full authentic Hindi narrative (हिन्दी में प्रामाणिक शिल्प विवरण)"
}`;
    const response = await model.generateContent([prompt]);
    const responseText = response.response.text();
    return JSON.parse(responseText);
}
