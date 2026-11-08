
\restrict eB5CB4r5jvadj3c0OarWzRYkjevgeEiCkU7d1MqpnkXhxCQ3l0noXL6FfIOvI4C

CREATE TABLE public.admin_audit_log (
    id integer NOT NULL,
    admin_user_id integer NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id integer,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.admin_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.admin_audit_log_id_seq OWNED BY public.admin_audit_log.id;

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.bookmarks (
    id integer NOT NULL,
    user_id integer NOT NULL,
    manga_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.bookmarks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.bookmarks_id_seq OWNED BY public.bookmarks.id;

CREATE TABLE public.chapters (
    id integer NOT NULL,
    manga_id integer NOT NULL,
    chapter_number real NOT NULL,
    title text NOT NULL,
    pages text[] DEFAULT '{}'::text[],
    views integer DEFAULT 0 NOT NULL,
    is_scheduled boolean DEFAULT false NOT NULL,
    scheduled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.chapters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.chapters_id_seq OWNED BY public.chapters.id;

CREATE TABLE public.community_posts (
    id integer NOT NULL,
    type text DEFAULT 'discussion'::text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    author_id integer NOT NULL,
    related_manga_id integer,
    likes integer DEFAULT 0 NOT NULL,
    replies integer DEFAULT 0 NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.community_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.community_posts_id_seq OWNED BY public.community_posts.id;

CREATE TABLE public.contest_winners (
    id integer NOT NULL,
    contest_id integer NOT NULL,
    user_id integer NOT NULL,
    place integer NOT NULL,
    prize text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.contest_winners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.contest_winners_id_seq OWNED BY public.contest_winners.id;

CREATE TABLE public.contests (
    id integer NOT NULL,
    title text NOT NULL,
    type text DEFAULT 'weekly_quiz'::text NOT NULL,
    description text NOT NULL,
    prize_pool text NOT NULL,
    entry_token_cost integer DEFAULT 10 NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    status text DEFAULT 'upcoming'::text NOT NULL,
    participant_count integer DEFAULT 0 NOT NULL,
    rules text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.contests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.contests_id_seq OWNED BY public.contests.id;

CREATE TABLE public.creator_applications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    creator_id integer,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    legal_name text NOT NULL,
    pen_name text NOT NULL,
    email text NOT NULL,
    mobile text NOT NULL,
    mobile_verified boolean DEFAULT false NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    portfolio_url text,
    sample_images text[] DEFAULT '{}'::text[] NOT NULL,
    social_links jsonb DEFAULT '{}'::jsonb NOT NULL,
    verification_code text NOT NULL,
    code_verified boolean DEFAULT false NOT NULL,
    original_work_accepted boolean DEFAULT false NOT NULL,
    studio_name text,
    studio_description text,
    studio_logo text,
    studio_banner text,
    website text,
    udyam_number text,
    gst_number text,
    team_members jsonb DEFAULT '[]'::jsonb NOT NULL,
    review_note text,
    reviewed_by integer,
    reviewed_at timestamp with time zone,
    invite_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.creator_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.creator_applications_id_seq OWNED BY public.creator_applications.id;

CREATE TABLE public.creator_invites (
    token text NOT NULL,
    created_by integer NOT NULL,
    note text,
    uses_left integer DEFAULT 1 NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.creator_subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    creator_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.creator_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.creator_subscriptions_id_seq OWNED BY public.creator_subscriptions.id;

CREATE TABLE public.creators (
    id integer NOT NULL,
    name text NOT NULL,
    studio_name text,
    avatar text NOT NULL,
    banner text,
    bio text,
    twitter_url text,
    instagram_url text,
    website_url text,
    youtube_url text,
    type text DEFAULT 'individual'::text NOT NULL,
    status text DEFAULT 'approved'::text NOT NULL,
    city text,
    state text,
    is_registered_studio boolean DEFAULT false NOT NULL,
    referral_code text,
    owner_user_id integer,
    total_manga integer DEFAULT 0 NOT NULL,
    total_views integer DEFAULT 0 NOT NULL,
    total_likes integer DEFAULT 0 NOT NULL,
    followers integer DEFAULT 0 NOT NULL,
    revenue real DEFAULT 0,
    is_verified boolean DEFAULT false NOT NULL,
    upi_id text,
    payout_name text,
    rank integer,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text UNIQUE
);

CREATE SEQUENCE public.creators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.creators_id_seq OWNED BY public.creators.id;

CREATE TABLE public.genres (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    manga_count integer DEFAULT 0 NOT NULL,
    color text DEFAULT '#6366f1'::text NOT NULL,
    icon text
);

CREATE SEQUENCE public.genres_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.genres_id_seq OWNED BY public.genres.id;

CREATE TABLE public.manga (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    creator_id integer NOT NULL,
    cover_image text NOT NULL,
    banner_image text,
    genre text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    language text DEFAULT 'English'::text NOT NULL,
    status text DEFAULT 'ongoing'::text NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    chapter_count integer DEFAULT 0 NOT NULL,
    rating real DEFAULT 0,
    is_featured boolean DEFAULT false NOT NULL,
    is_sponsored boolean DEFAULT false NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    is_mature boolean DEFAULT false NOT NULL,
    weekly_rank integer,
    monthly_rank integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text UNIQUE
);

CREATE SEQUENCE public.manga_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.manga_id_seq OWNED BY public.manga.id;

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type text DEFAULT 'system'::text NOT NULL,
    message text NOT NULL,
    related_id integer,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;

CREATE TABLE public.orders (
    id integer NOT NULL,
    merchant_order_id text NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    creator_id integer NOT NULL,
    format text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    amount integer NOT NULL,
    platform_fee integer NOT NULL,
    creator_earning integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    fulfillment text DEFAULT 'none'::text NOT NULL,
    tracking_info text,
    shipping_name text,
    shipping_phone text,
    shipping_address text,
    shipping_city text,
    shipping_state text,
    shipping_pincode text,
    gateway_order_id text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;

CREATE TABLE public.otp_codes (
    id integer NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.otp_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.otp_codes_id_seq OWNED BY public.otp_codes.id;

CREATE TABLE public.payouts (
    id integer NOT NULL,
    creator_id integer NOT NULL,
    amount integer NOT NULL,
    upi_id text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone
);

CREATE SEQUENCE public.payouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.payouts_id_seq OWNED BY public.payouts.id;

CREATE TABLE public.products (
    id integer NOT NULL,
    creator_id integer NOT NULL,
    title text NOT NULL,
    description text,
    cover_image text NOT NULL,
    preview_images text[] DEFAULT '{}'::text[],
    genre text,
    language text DEFAULT 'English'::text NOT NULL,
    page_count integer,
    format text DEFAULT 'digital'::text NOT NULL,
    digital_price integer,
    physical_price integer,
    shipping_fee integer DEFAULT 0 NOT NULL,
    stock integer,
    digital_file_key text,
    digital_file_name text,
    status text DEFAULT 'active'::text NOT NULL,
    sales integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;

CREATE TABLE public.reading_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    manga_id integer NOT NULL,
    last_chapter real DEFAULT 1 NOT NULL,
    last_chapter_id integer,
    last_page integer DEFAULT 0 NOT NULL,
    progress real DEFAULT 0 NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.reading_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.reading_history_id_seq OWNED BY public.reading_history.id;

CREATE TABLE public.team_members (
    id integer NOT NULL,
    creator_id integer NOT NULL,
    user_id integer,
    name text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'invited'::text NOT NULL,
    invite_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.team_members_id_seq OWNED BY public.team_members.id;

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    email text,
    google_id text,
    role text DEFAULT 'reader'::text NOT NULL,
    creator_id integer,
    display_name text NOT NULL,
    avatar text NOT NULL,
    bio text,
    points integer DEFAULT 0 NOT NULL,
    weekly_points integer DEFAULT 0 NOT NULL,
    monthly_points integer DEFAULT 0 NOT NULL,
    rank integer,
    completed_manga integer DEFAULT 0 NOT NULL,
    is_adult boolean DEFAULT false NOT NULL,
    favorite_genres text[] DEFAULT '{}'::text[] NOT NULL,
    ui_language text DEFAULT 'en'::text NOT NULL,
    onboarded boolean DEFAULT false NOT NULL,
    referred_by integer,
    last_ip text,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE TABLE public.views_daily (
    id integer NOT NULL,
    day date NOT NULL,
    creator_id integer NOT NULL,
    manga_id integer NOT NULL,
    chapter_id integer NOT NULL,
    count integer DEFAULT 0 NOT NULL
);

CREATE SEQUENCE public.views_daily_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.views_daily_id_seq OWNED BY public.views_daily.id;

ALTER TABLE ONLY public.admin_audit_log ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_log_id_seq'::regclass);

ALTER TABLE ONLY public.bookmarks ALTER COLUMN id SET DEFAULT nextval('public.bookmarks_id_seq'::regclass);

ALTER TABLE ONLY public.chapters ALTER COLUMN id SET DEFAULT nextval('public.chapters_id_seq'::regclass);

ALTER TABLE ONLY public.community_posts ALTER COLUMN id SET DEFAULT nextval('public.community_posts_id_seq'::regclass);

ALTER TABLE ONLY public.contest_winners ALTER COLUMN id SET DEFAULT nextval('public.contest_winners_id_seq'::regclass);

ALTER TABLE ONLY public.contests ALTER COLUMN id SET DEFAULT nextval('public.contests_id_seq'::regclass);

ALTER TABLE ONLY public.creator_applications ALTER COLUMN id SET DEFAULT nextval('public.creator_applications_id_seq'::regclass);

ALTER TABLE ONLY public.creator_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.creator_subscriptions_id_seq'::regclass);

ALTER TABLE ONLY public.creators ALTER COLUMN id SET DEFAULT nextval('public.creators_id_seq'::regclass);

ALTER TABLE ONLY public.genres ALTER COLUMN id SET DEFAULT nextval('public.genres_id_seq'::regclass);

ALTER TABLE ONLY public.manga ALTER COLUMN id SET DEFAULT nextval('public.manga_id_seq'::regclass);

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);

ALTER TABLE ONLY public.otp_codes ALTER COLUMN id SET DEFAULT nextval('public.otp_codes_id_seq'::regclass);

ALTER TABLE ONLY public.payouts ALTER COLUMN id SET DEFAULT nextval('public.payouts_id_seq'::regclass);

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);

ALTER TABLE ONLY public.reading_history ALTER COLUMN id SET DEFAULT nextval('public.reading_history_id_seq'::regclass);

ALTER TABLE ONLY public.team_members ALTER COLUMN id SET DEFAULT nextval('public.team_members_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.views_daily ALTER COLUMN id SET DEFAULT nextval('public.views_daily_id_seq'::regclass);

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contest_winners
    ADD CONSTRAINT contest_winners_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.contests
    ADD CONSTRAINT contests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.creator_applications
    ADD CONSTRAINT creator_applications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.creator_invites
    ADD CONSTRAINT creator_invites_pkey PRIMARY KEY (token);

ALTER TABLE ONLY public.creator_subscriptions
    ADD CONSTRAINT creator_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.creators
    ADD CONSTRAINT creators_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.creators
    ADD CONSTRAINT creators_referral_code_unique UNIQUE (referral_code);

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.genres
    ADD CONSTRAINT genres_slug_unique UNIQUE (slug);

ALTER TABLE ONLY public.manga
    ADD CONSTRAINT manga_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_merchant_order_id_unique UNIQUE (merchant_order_id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_invite_token_unique UNIQUE (invite_token);

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);

ALTER TABLE ONLY public.views_daily
    ADD CONSTRAINT views_daily_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX creator_subscriptions_user_creator_idx ON public.creator_subscriptions USING btree (user_id, creator_id);

CREATE UNIQUE INDEX views_daily_day_chapter_idx ON public.views_daily USING btree (day, chapter_id);

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_manga_id_manga_id_fk FOREIGN KEY (manga_id) REFERENCES public.manga(id);

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_manga_id_manga_id_fk FOREIGN KEY (manga_id) REFERENCES public.manga(id);

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_author_id_users_id_fk FOREIGN KEY (author_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.contest_winners
    ADD CONSTRAINT contest_winners_contest_id_contests_id_fk FOREIGN KEY (contest_id) REFERENCES public.contests(id);

ALTER TABLE ONLY public.contest_winners
    ADD CONSTRAINT contest_winners_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.creator_applications
    ADD CONSTRAINT creator_applications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.creator_subscriptions
    ADD CONSTRAINT creator_subscriptions_creator_id_creators_id_fk FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.creator_subscriptions
    ADD CONSTRAINT creator_subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.manga
    ADD CONSTRAINT manga_creator_id_creators_id_fk FOREIGN KEY (creator_id) REFERENCES public.creators(id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_creator_id_creators_id_fk FOREIGN KEY (creator_id) REFERENCES public.creators(id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_product_id_products_id_fk FOREIGN KEY (product_id) REFERENCES public.products(id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.payouts
    ADD CONSTRAINT payouts_creator_id_creators_id_fk FOREIGN KEY (creator_id) REFERENCES public.creators(id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_creator_id_creators_id_fk FOREIGN KEY (creator_id) REFERENCES public.creators(id);

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_manga_id_manga_id_fk FOREIGN KEY (manga_id) REFERENCES public.manga(id);

ALTER TABLE ONLY public.reading_history
    ADD CONSTRAINT reading_history_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_creator_id_creators_id_fk FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE CASCADE;

\unrestrict eB5CB4r5jvadj3c0OarWzRYkjevgeEiCkU7d1MqpnkXhxCQ3l0noXL6FfIOvI4C

