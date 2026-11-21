import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseClient && url && key && !url.includes('your-project') && !key.includes('eyJhbGciOi...')) {
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

export interface UploadResult {
  url: string;
  storagePath: string;
  isPublic: boolean;
  provider: 'supabase' | 'local';
}

/**
 * Ensures local upload directories exist.
 */
function ensureLocalDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Uploads a file buffer to Supabase Storage (or local storage fallback).
 */
export async function uploadFile(
  buffer: Buffer,
  bucket: 'product-images' | 'product-documents' | 'product-videos',
  originalFilename: string,
  mimetype: string
): Promise<UploadResult> {
  const ext = path.extname(originalFilename).toLowerCase();
  const fileKey = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
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
      } else {
        if (isPublic) {
          const { data: urlData } = client.storage.from(bucket).getPublicUrl(fileKey);
          return {
            url: urlData.publicUrl,
            storagePath: `${bucket}/${fileKey}`,
            isPublic: true,
            provider: 'supabase'
          };
        } else {
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
    } catch (err: any) {
      console.warn(`Supabase Storage upload exception: ${err.message}. Falling back to server storage.`);
    }
  }

  // Fallback: Local server disk storage in uploads/
  const baseUploadsDir = path.join(process.cwd(), 'uploads', bucket);
  ensureLocalDir(baseUploadsDir);
  const localFilePath = path.join(baseUploadsDir, fileKey);
  fs.writeFileSync(localFilePath, buffer);

  const localUrl = `http://localhost:${process.env.PORT || 3001}/uploads/${bucket}/${fileKey}`;
  return {
    url: localUrl,
    storagePath: `uploads/${bucket}/${fileKey}`,
    isPublic,
    provider: 'local'
  };
}
