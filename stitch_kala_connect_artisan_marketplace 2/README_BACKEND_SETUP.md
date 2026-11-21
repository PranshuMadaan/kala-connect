# Kala Connect — Full-Stack Real Backend Setup Guide

This guide walks you through setting up the real **Supabase** backend, **Gemini AI**, and **Storage** for Kala Connect.

---

## 1. Supabase Setup (Database, Auth & Storage)

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a free project named `kala-connect`.
2. Note your database password.

### Step 2: Run the Database Migration
1. In your Supabase Dashboard, go to the **SQL Editor** (left sidebar).
2. Click **New Query**.
3. Open `supabase/migrations/20260101000000_kala_connect_schema.sql` in this project.
4. Copy the entire file contents and paste into the Supabase SQL editor.
5. Click **Run**.
6. This creates all 12 tables (`profiles`, `artisan_profiles`, `products`, `product_images`, `product_documents`, `document_analyses`, `enquiries`, `enquiry_messages`, `price_offers`, `orders`, `order_items`, `notifications`) along with Row Level Security (RLS) policies and triggers.

### Step 3: Create Storage Buckets
1. In your Supabase Dashboard, go to **Storage** -> **New Bucket**:
   - Bucket 1: `product-images` (Toggle **Public Bucket: ON**).
   - Bucket 2: `product-documents` (Toggle **Public Bucket: OFF** - private document storage).
   - Bucket 3: `product-videos` (Toggle **Public Bucket: ON**).

### Step 4: Configure Authentication
1. Go to **Authentication** -> **Providers**:
   - **Phone**: Enable Phone provider (Twilio, MessageBird, or Supabase test SMS).
   - **Google**: Enable Google OAuth (provide Google Client ID and Secret from Google Cloud Console).
2. Under **URL Configuration**, add your local site address:
   - Site URL: `http://localhost:8080`
   - Redirect URLs: `http://localhost:8080/**`

### Step 5: Copy API Keys
1. Go to **Project Settings** -> **API**:
   - Copy **Project URL** $\rightarrow$ `SUPABASE_URL`
   - Copy **anon / public** key $\rightarrow$ `SUPABASE_ANON_KEY`
   - Copy **service_role** secret $\rightarrow$ `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Google Gemini API Setup (AI Processing)

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key**.
3. Copy the API key $\rightarrow$ `GEMINI_API_KEY`.

---

## 3. Environment Variables Configuration

In the project root, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:
```env
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
GEMINI_API_KEY=AIzaSy...
```

Also copy `.env` to `kala-connect/server/.env` so the backend server reads it:
```bash
cp .env kala-connect/server/.env
```

---

## 4. Starting the Backend Server

```bash
cd "kala-connect/server"
npm install
npm run dev
```

The server starts on `http://localhost:3001` with:
- `POST /api/upload/image`: Image validation and upload.
- `POST /api/upload/document`: Document upload (PDF, DOCX, JPG, PNG).
- `POST /api/ai/analyze-document`: Real Gemini document OCR & structured facts extraction.
- `POST /api/ai/generate-description`: Real Gemini product storytelling and Hindi translation.
- `POST /api/pricing/calculate`: Dynamic cost-plus fair price calculator.
- `GET /api/config-status`: Configuration health checker.

---

## 5. Starting the Frontend

From the root directory:
```bash
python3 -m http.server 8080 --bind 127.0.0.1
```
Open **[http://localhost:8080/index.html](http://localhost:8080/index.html)** in your browser.
