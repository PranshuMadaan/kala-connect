"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
const supabase_js_1 = require("@supabase/supabase-js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
let supabaseClient = null;
function getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseClient && url && key && !url.includes('your-project') && !key.includes('eyJhbGciOi...')) {
        supabaseClient = (0, supabase_js_1.createClient)(url, key);
    }
    return supabaseClient;
}
/**
 * Ensures local upload directories exist.
 */
function ensureLocalDir(dir) {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
/**
 * Uploads a file buffer to Supabase Storage (or local storage fallback).
 */
async function uploadFile(buffer, bucket, originalFilename, mimetype) {
    const ext = path_1.default.extname(originalFilename).toLowerCase();
    const fileKey = `${Date.now()}-${(0, uuid_1.v4)().slice(0, 8)}${ext}`;
    const isPublic = bucket !== 'product-documents';
    const client = getSupabaseClient();
    if (client) {
        try {
            const { data, error } = await client.storage
                .from(bucket)
                .upload(fileKey, buffer, {
                contentType: mimetype,
                upsert: true
            });
            if (error) {
                console.warn(`Supabase storage upload failed, falling back to local: ${error.message}`);
            }
            else {
                if (isPublic) {
                    const { data: urlData } = client.storage.from(bucket).getPublicUrl(fileKey);
                    return {
                        url: urlData.publicUrl,
                        storagePath: `${bucket}/${fileKey}`,
                        isPublic: true,
                        provider: 'supabase'
                    };
                }
                else {
                    // Private document: generate 24h signed URL
                    const { data: signData, error: signError } = await client.storage
                        .from(bucket)
                        .createSignedUrl(fileKey, 60 * 60 * 24);
                    return {
                        url: signData ? signData.signedUrl : '',
                        storagePath: `${bucket}/${fileKey}`,
                        isPublic: false,
                        provider: 'supabase'
                    };
                }
            }
        }
        catch (err) {
            console.warn(`Supabase Storage upload exception: ${err.message}. Falling back to server storage.`);
        }
    }
    // Fallback: Local server disk storage in uploads/
    const baseUploadsDir = path_1.default.join(process.cwd(), 'uploads', bucket);
    ensureLocalDir(baseUploadsDir);
    const localFilePath = path_1.default.join(baseUploadsDir, fileKey);
    fs_1.default.writeFileSync(localFilePath, buffer);
    const localUrl = `http://localhost:${process.env.PORT || 3001}/uploads/${bucket}/${fileKey}`;
    return {
        url: localUrl,
        storagePath: `uploads/${bucket}/${fileKey}`,
        isPublic,
        provider: 'local'
    };
}
