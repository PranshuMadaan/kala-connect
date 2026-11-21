-- =====================================================================
-- KALA CONNECT — PRODUCTION POSTGRESQL DATABASE SCHEMA & RLS POLICIES
-- =====================================================================
-- Migration: 20260101000000_kala_connect_schema.sql
-- Description: Complete schema for Kala Connect Direct Artisan Marketplace
-- Includes: 12 Tables, Foreign Keys, Indexes, Triggers, RLS Policies, and Storage Setup.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. HELPER FUNCTION FOR UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- TABLE 1: PROFILES (User accounts linked to Supabase auth.users)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('artisan', 'buyer', 'admin')),
    full_name TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    city TEXT,
    state TEXT,
    preferred_language TEXT DEFAULT 'en',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- TABLE 2: ARTISAN_PROFILES (Extended profile for verified craft makers)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.artisan_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    bio TEXT DEFAULT '',
    village TEXT NOT NULL,
    district TEXT,
    state TEXT NOT NULL,
    craft_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    craft_tradition TEXT,
    years_experience INTEGER DEFAULT 0,
    is_gi_certified BOOLEAN DEFAULT FALSE,
    gi_registration_number TEXT,
    profile_image_url TEXT,
    total_sales INTEGER DEFAULT 0,
    total_revenue NUMERIC(12, 2) DEFAULT 0.00,
    rating NUMERIC(3, 2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_artisan_profiles_updated_at
    BEFORE UPDATE ON public.artisan_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- TABLE 3: PRODUCTS (Artisan craft listings)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    hindi_description TEXT,
    category TEXT NOT NULL,
    technique TEXT,
    materials TEXT NOT NULL,
    dimensions JSONB DEFAULT '{}'::jsonb,
    time_taken_days INTEGER DEFAULT 1,
    stock_count INTEGER DEFAULT 1,
    village TEXT,
    state TEXT,
    is_gi_tagged BOOLEAN DEFAULT FALSE,
    custom_orders_accepted BOOLEAN DEFAULT FALSE,
    maker_price NUMERIC(10, 2) NOT NULL,
    suggested_price NUMERIC(10, 2),
    buyer_price NUMERIC(10, 2) NOT NULL,
    price_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    care_guide TEXT,
    cover_image_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- TABLE 4: PRODUCT_IMAGES (Multiple angles and photos for each craft)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_cover BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- TABLE 5: PRODUCT_DOCUMENTS (Supporting records, certificates, specs)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.product_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    artisan_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- TABLE 6: DOCUMENT_ANALYSES (Structured AI extraction from documents)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.document_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.product_documents(id) ON DELETE CASCADE,
    document_type TEXT,
    extracted_text TEXT,
    structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_confidence TEXT,
    is_verified_by_user BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- TABLE 7: ENQUIRIES (Direct buyer-to-artisan communication thread)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    artisan_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    initial_message TEXT NOT NULL,
    offered_price NUMERIC(10, 2),
    agreed_price NUMERIC(10, 2),
    status TEXT NOT NULL CHECK (status IN ('pending', 'counter_offered', 'accepted', 'rejected', 'closed')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_enquiries_updated_at
    BEFORE UPDATE ON public.enquiries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- TABLE 8: ENQUIRY_MESSAGES (Individual chat messages in an enquiry)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.enquiry_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    offer_price NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- TABLE 9: PRICE_OFFERS (Formal negotiated price proposals)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.price_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enquiry_id UUID NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'countered', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- TABLE 10: ORDERS (Customer orders created upon agreement)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    enquiry_id UUID REFERENCES public.enquiries(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    artisan_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    agreed_price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    artisan_payout NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('price_agreed', 'order_confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')) DEFAULT 'price_agreed',
    status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    shipping_address TEXT,
    tracking_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- TABLE 11: ORDER_ITEMS (Itemized records for orders)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price NUMERIC(10, 2) NOT NULL
);

-- =====================================================================
-- TABLE 12: NOTIFICATIONS (In-app notifications for users)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_products_artisan ON public.products(artisan_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_documents_product ON public.product_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_buyer ON public.enquiries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_artisan ON public.enquiries(artisan_id);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_enquiry ON public.enquiry_messages(enquiry_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_artisan ON public.orders(artisan_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- 2. ARTISAN_PROFILES RLS
ALTER TABLE public.artisan_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artisan profiles are viewable by everyone" 
    ON public.artisan_profiles FOR SELECT 
    USING (true);

CREATE POLICY "Artisans can insert their own profile" 
    ON public.artisan_profiles FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Artisans can update their own profile" 
    ON public.artisan_profiles FOR UPDATE 
    USING (auth.uid() = user_id);

-- 3. PRODUCTS RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published products are viewable by everyone" 
    ON public.products FOR SELECT 
    USING (status = 'published' OR auth.uid() = artisan_id);

CREATE POLICY "Artisans can insert their own products" 
    ON public.products FOR INSERT 
    WITH CHECK (auth.uid() = artisan_id);

CREATE POLICY "Artisans can update their own products" 
    ON public.products FOR UPDATE 
    USING (auth.uid() = artisan_id);

CREATE POLICY "Artisans can delete their own products" 
    ON public.products FOR DELETE 
    USING (auth.uid() = artisan_id);

-- 4. PRODUCT_IMAGES RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Images of published products are viewable by everyone" 
    ON public.product_images FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.products p 
            WHERE p.id = product_id AND (p.status = 'published' OR p.artisan_id = auth.uid())
        )
    );

CREATE POLICY "Artisans can manage images of their products" 
    ON public.product_images FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.products p 
            WHERE p.id = product_id AND p.artisan_id = auth.uid()
        )
    );

-- 5. PRODUCT_DOCUMENTS RLS
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public documents or owner documents viewable" 
    ON public.product_documents FOR SELECT 
    USING (is_public = TRUE OR auth.uid() = artisan_id);

CREATE POLICY "Artisans can manage their own documents" 
    ON public.product_documents FOR ALL 
    USING (auth.uid() = artisan_id);

-- 6. DOCUMENT_ANALYSES RLS
ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artisans can view analysis of their documents" 
    ON public.document_analyses FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.product_documents d 
            WHERE d.id = document_id AND d.artisan_id = auth.uid()
        )
    );

CREATE POLICY "Artisans can insert analysis for their documents" 
    ON public.document_analyses FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.product_documents d 
            WHERE d.id = document_id AND d.artisan_id = auth.uid()
        )
    );

CREATE POLICY "Artisans can update analysis for their documents" 
    ON public.document_analyses FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.product_documents d 
            WHERE d.id = document_id AND d.artisan_id = auth.uid()
        )
    );

-- 7. ENQUIRIES RLS
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their enquiries" 
    ON public.enquiries FOR SELECT 
    USING (auth.uid() = buyer_id OR auth.uid() = artisan_id);

CREATE POLICY "Authenticated buyers can create enquiries" 
    ON public.enquiries FOR INSERT 
    WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update enquiry status" 
    ON public.enquiries FOR UPDATE 
    USING (auth.uid() = buyer_id OR auth.uid() = artisan_id);

-- 8. ENQUIRY_MESSAGES RLS
ALTER TABLE public.enquiry_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view enquiry messages" 
    ON public.enquiry_messages FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.enquiries e 
            WHERE e.id = enquiry_id AND (e.buyer_id = auth.uid() OR e.artisan_id = auth.uid())
        )
    );

CREATE POLICY "Participants can insert messages" 
    ON public.enquiry_messages FOR INSERT 
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.enquiries e 
            WHERE e.id = enquiry_id AND (e.buyer_id = auth.uid() OR e.artisan_id = auth.uid())
        )
    );

-- 9. PRICE_OFFERS RLS
ALTER TABLE public.price_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view price offers" 
    ON public.price_offers FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.enquiries e 
            WHERE e.id = enquiry_id AND (e.buyer_id = auth.uid() OR e.artisan_id = auth.uid())
        )
    );

CREATE POLICY "Participants can insert price offers" 
    ON public.price_offers FOR INSERT 
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.enquiries e 
            WHERE e.id = enquiry_id AND (e.buyer_id = auth.uid() OR e.artisan_id = auth.uid())
        )
    );

CREATE POLICY "Participants can update price offers" 
    ON public.price_offers FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.enquiries e 
            WHERE e.id = enquiry_id AND (e.buyer_id = auth.uid() OR e.artisan_id = auth.uid())
        )
    );

-- 10. ORDERS RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their orders" 
    ON public.orders FOR SELECT 
    USING (auth.uid() = buyer_id OR auth.uid() = artisan_id);

CREATE POLICY "Authenticated users can create orders from agreed enquiries" 
    ON public.orders FOR INSERT 
    WITH CHECK (auth.uid() = buyer_id OR auth.uid() = artisan_id);

CREATE POLICY "Participants can update their orders" 
    ON public.orders FOR UPDATE 
    USING (auth.uid() = buyer_id OR auth.uid() = artisan_id);

-- 11. ORDER_ITEMS RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order participants can view order items" 
    ON public.order_items FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.artisan_id = auth.uid())
        )
    );

CREATE POLICY "Order participants can insert order items" 
    ON public.order_items FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o 
            WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.artisan_id = auth.uid())
        )
    );

-- 12. NOTIFICATIONS RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own notifications" 
    ON public.notifications FOR ALL 
    USING (auth.uid() = user_id);

-- =====================================================================
-- SUPABASE STORAGE BUCKETS (Run via Storage UI or Supabase Dashboard)
-- =====================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-documents', 'product-documents', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-videos', 'product-videos', true) ON CONFLICT DO NOTHING;
