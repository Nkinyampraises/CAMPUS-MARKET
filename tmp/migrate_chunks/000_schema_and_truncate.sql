-- chunk: schema+truncate
SET statement_timeout = 0;
SET lock_timeout = 0;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.kv_store_50b25a4f (
  key text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NULL,
  created_at timestamp with time zone NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  item_id uuid NOT NULL,
  amount numeric NOT NULL,
  platform_fee numeric NOT NULL,
  status text NOT NULL,
  payment_method text NULL,
  phone_number text NULL,
  pickup_location text NULL,
  pickup_date text NULL,
  pickup_time text NULL,
  proof_image_url text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT escrow_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT escrow_transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id),
  CONSTRAINT escrow_transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id)
);
CREATE TABLE IF NOT EXISTS public.listings (
  id bigint NOT NULL,
  seller_id uuid NOT NULL,
  title character varying(255) NOT NULL,
  description text NULL,
  category_id bigint NULL,
  price numeric(10,2) NOT NULL,
  type text NOT NULL,
  rental_period text NULL,
  condition text NULL,
  location_id bigint NULL,
  university character varying(255) NULL,
  images text[] NULL,
  status text NULL DEFAULT 'available'::text,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT listings_pkey PRIMARY KEY (id),
  CONSTRAINT listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NULL,
  university text NULL,
  student_id text NULL,
  rating numeric NULL DEFAULT 0,
  review_count integer NULL DEFAULT 0,
  is_verified boolean NULL DEFAULT false,
  is_approved boolean NULL DEFAULT false,
  role text NOT NULL DEFAULT 'student'::text,
  user_type text NULL DEFAULT 'buyer'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.transactions (
  id bigint NOT NULL,
  listing_id bigint NULL,
  buyer_id uuid NULL,
  seller_id uuid NULL,
  amount numeric(10,2) NOT NULL,
  payment_method text NULL,
  status text NULL DEFAULT 'pending'::text,
  reference text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT transactions_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
  CONSTRAINT transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS public.reviews (
  id bigint NOT NULL,
  transaction_id bigint NULL,
  reviewer_id uuid NULL,
  reviewee_id uuid NULL,
  rating integer NULL,
  comment text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT reviews_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  available_balance numeric NULL DEFAULT 0,
  pending_balance numeric NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT wallets_pkey PRIMARY KEY (id),
  CONSTRAINT wallets_user_id_key UNIQUE (user_id),
  CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
TRUNCATE TABLE
  public.escrow_transactions,
  public.reviews,
  public.transactions,
  public.listings,
  public.profiles,
  public.wallets,
  public.users,
  public.kv_store_50b25a4f
RESTART IDENTITY CASCADE;
