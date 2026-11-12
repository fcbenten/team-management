-- ==============================================================================
-- FC Benten チーム管理システム Supabase Database Schema
-- Generated: 2026-11-10
-- Target: PostgreSQL 15+ (Supabase)
-- ==============================================================================

-- 1. メンバー名簿 (members)
CREATE TABLE IF NOT EXISTS public.members (
    member_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    number VARCHAR(10),
    role VARCHAR(50) DEFAULT '選手',
    position VARCHAR(20) DEFAULT 'FP',
    birthday VARCHAR(20),
    email VARCHAR(255),
    phone VARCHAR(50),
    password_hash TEXT,
    token TEXT,
    linked_at TIMESTAMPTZ,
    avatar_url TEXT,
    notification_type VARCHAR(50),
    line_user_id VARCHAR(100),
    push_subscription TEXT,
    notify_settings TEXT,
    is_past BOOLEAN DEFAULT FALSE,
    member_type VARCHAR(20) DEFAULT 'REGULAR', -- 'REGULAR': 通常選手, 'SPECIAL': 助っ人・OG等のシステム予約枠
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 試合記録 (matches)
CREATE TABLE IF NOT EXISTS public.matches (
    match_id VARCHAR(50) PRIMARY KEY,
    match_date VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    opponent VARCHAR(100),
    my_score INTEGER DEFAULT 0,
    opp_score INTEGER DEFAULT 0,
    result VARCHAR(20),
    attended_players TEXT,
    location TEXT,
    mom_member_id VARCHAR(50) REFERENCES public.members(member_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 得点・カード詳細ログ (score_logs)
CREATE TABLE IF NOT EXISTS public.score_logs (
    log_id VARCHAR(50) PRIMARY KEY,
    match_id VARCHAR(50) NOT NULL REFERENCES public.matches(match_id) ON DELETE CASCADE,
    period VARCHAR(20),
    minute INTEGER DEFAULT 0,
    log_type VARCHAR(50) NOT NULL,
    member_id VARCHAR(50) REFERENCES public.members(member_id) ON DELETE SET NULL,
    assist_member_id VARCHAR(50) REFERENCES public.members(member_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 予定出欠 (attendance)
CREATE TABLE IF NOT EXISTS public.attendance (
    event_id VARCHAR(255) NOT NULL,
    member_id VARCHAR(50) NOT NULL REFERENCES public.members(member_id) ON DELETE CASCADE,
    event_date VARCHAR(20),
    event_title VARCHAR(255),
    status VARCHAR(20) NOT NULL, -- 'yes', 'no', 'maybe'
    comment TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_id, member_id)
);

-- 5. 備品マスタ (equipment_master)
CREATE TABLE IF NOT EXISTS public.equipment_master (
    equipment_code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(20) DEFAULT 'ROTATION',
    req_tr VARCHAR(20) DEFAULT 'NONE',
    req_trm VARCHAR(20) DEFAULT 'NONE',
    req_official VARCHAR(20) DEFAULT 'NONE',
    notes TEXT,
    sort_order INTEGER DEFAULT 999,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 備品現物アイテム管理 (equipment_items)
CREATE TABLE IF NOT EXISTS public.equipment_items (
    item_id VARCHAR(50) PRIMARY KEY,
    equipment_code VARCHAR(50) NOT NULL REFERENCES public.equipment_master(equipment_code) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    member_id VARCHAR(50) REFERENCES public.members(member_id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT '保管中',
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 備品当番割当 (equipment_event_logs)
CREATE TABLE IF NOT EXISTS public.equipment_event_logs (
    log_id VARCHAR(50) PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    event_date VARCHAR(20) NOT NULL,
    item_id VARCHAR(50) REFERENCES public.equipment_items(item_id) ON DELETE SET NULL,
    assigned_member_id VARCHAR(50) REFERENCES public.members(member_id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT '割当済',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 活動記録・掲示板 (bulletin_posts)
CREATE TABLE IF NOT EXISTS public.bulletin_posts (
    post_id VARCHAR(50) PRIMARY KEY,
    category VARCHAR(50) DEFAULT '連絡',
    title VARCHAR(255) NOT NULL,
    content TEXT,
    event_id VARCHAR(255),
    event_title VARCHAR(255),
    event_date VARCHAR(20),
    is_pinned BOOLEAN DEFAULT FALSE,
    author_member_id VARCHAR(50) REFERENCES public.members(member_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by_member_id VARCHAR(50) REFERENCES public.members(member_id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- 9. 掲示板既読 (bulletin_reads)
CREATE TABLE IF NOT EXISTS public.bulletin_reads (
    read_id VARCHAR(50) PRIMARY KEY,
    post_id VARCHAR(50) NOT NULL REFERENCES public.bulletin_posts(post_id) ON DELETE CASCADE,
    member_id VARCHAR(50) NOT NULL REFERENCES public.members(member_id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_post_member_read UNIQUE (post_id, member_id)
);

-- 10. 掲示板コメント (bulletin_comments)
CREATE TABLE IF NOT EXISTS public.bulletin_comments (
    comment_id VARCHAR(50) PRIMARY KEY,
    post_id VARCHAR(50) NOT NULL REFERENCES public.bulletin_posts(post_id) ON DELETE CASCADE,
    author_member_id VARCHAR(50) REFERENCES public.members(member_id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- ==============================================================================
-- インデックス作成（高速検索・0.3秒レスポンス保証）
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);
CREATE INDEX IF NOT EXISTS idx_members_is_past ON public.members(is_past);
CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(match_date DESC);
CREATE INDEX IF NOT EXISTS idx_score_logs_match ON public.score_logs(match_id);
CREATE INDEX IF NOT EXISTS idx_score_logs_member ON public.score_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event ON public.attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_code ON public.equipment_items(equipment_code);
CREATE INDEX IF NOT EXISTS idx_equipment_logs_event ON public.equipment_event_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_bulletin_posts_list ON public.bulletin_posts(is_pinned DESC, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_bulletin_reads_post ON public.bulletin_reads(post_id);
CREATE INDEX IF NOT EXISTS idx_bulletin_comments_post ON public.bulletin_comments(post_id) WHERE is_deleted = FALSE;

-- ==============================================================================
-- Row Level Security (RLS) 設定
-- Webアプリ（PWA）およびGAS移行バッチからの直接読み書きを許可
-- ==============================================================================
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulletin_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulletin_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulletin_comments ENABLE ROW LEVEL SECURITY;

-- 全テーブルに対して anon / authenticated ロールへの全権限ポリシーを設定
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon full access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Allow anon full access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

-- ==============================================================================
-- プロフィール画像用ストレージバケット作成 (member-avatars)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-avatars', 'member-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ストレージバケットへのパブリックアクセス許可ポリシー
DROP POLICY IF EXISTS "Allow public avatar access" ON storage.objects;
CREATE POLICY "Allow public avatar access" ON storage.objects FOR ALL USING (bucket_id = 'member-avatars') WITH CHECK (bucket_id = 'member-avatars');


-- ==============================================================================
-- データベース最適化トリガー & ビュー
-- ==============================================================================

-- 1. 試合スコア・勝敗の完全自動計算トリガー (score_logs -> matches)
CREATE OR REPLACE FUNCTION public.sync_match_scores()
RETURNS TRIGGER AS $$
DECLARE
    target_match_id VARCHAR(50);
    new_my_score INTEGER := 0;
    new_opp_score INTEGER := 0;
    new_result VARCHAR(20) := '引き分け';
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_match_id := OLD.match_id;
    ELSE
        target_match_id := NEW.match_id;
    END IF;

    SELECT 
        COALESCE(COUNT(CASE WHEN log_type = '得点' THEN 1 END), 0),
        COALESCE(COUNT(CASE WHEN log_type = '相手得点' THEN 1 END), 0)
    INTO new_my_score, new_opp_score
    FROM public.score_logs
    WHERE match_id = target_match_id;

    IF new_my_score > new_opp_score THEN
        new_result := '勝利';
    ELSIF new_my_score < new_opp_score THEN
        new_result := '敗北';
    ELSE
        new_result := '引き分け';
    END IF;

    UPDATE public.matches
    SET 
        my_score = new_my_score,
        opp_score = new_opp_score,
        result = new_result,
        updated_at = NOW()
    WHERE match_id = target_match_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_match_scores ON public.score_logs;
CREATE TRIGGER trg_sync_match_scores
AFTER INSERT OR UPDATE OR DELETE ON public.score_logs
FOR EACH ROW EXECUTE FUNCTION public.sync_match_scores();

-- 2. 全更新系テーブルの updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_updated_at ON public.members;
CREATE TRIGGER trg_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_matches_updated_at ON public.matches;
CREATE TRIGGER trg_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_equipment_items_updated_at ON public.equipment_items;
CREATE TRIGGER trg_equipment_items_updated_at BEFORE UPDATE ON public.equipment_items FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_bulletin_posts_updated_at ON public.bulletin_posts;
CREATE TRIGGER trg_bulletin_posts_updated_at BEFORE UPDATE ON public.bulletin_posts FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- 3. 出欠・出席率のリアルタイム自動集計ビュー (深夜バッチ完全不要化)
CREATE OR REPLACE VIEW public.view_player_attendance_stats AS
SELECT 
    m.member_id,
    m.name AS member_name,
    m.number AS member_number,
    m.role,
    m.position,
    m.avatar_url,
    COUNT(a.event_id) AS total_events,
    COUNT(CASE WHEN a.status = 'yes' THEN 1 END) AS attended_events,
    COUNT(CASE WHEN a.status = 'no' THEN 1 END) AS absent_events,
    COUNT(CASE WHEN a.status = 'maybe' THEN 1 END) AS tentative_events,
    CASE 
        WHEN COUNT(a.event_id) > 0 THEN 
            ROUND((COUNT(CASE WHEN a.status = 'yes' THEN 1 END)::numeric / COUNT(a.event_id)::numeric) * 100, 1)
        ELSE 0.0
    END AS attendance_rate
FROM public.members m
LEFT JOIN public.attendance a ON m.member_id = a.member_id
WHERE m.is_past = FALSE AND m.member_type = 'REGULAR'
GROUP BY m.member_id, m.name, m.number, m.role, m.position, m.avatar_url;

-- 4. 掲示板既読数・コメント数の自動集計ビュー (members と動的JOIN)
CREATE OR REPLACE VIEW public.view_bulletin_summary AS
SELECT 
    p.post_id,
    p.category,
    p.title,
    p.content,
    p.event_id,
    p.event_title,
    p.event_date,
    p.is_pinned,
    p.author_member_id,
    m.name AS author_member_name,
    m.avatar_url AS author_avatar_url,
    p.created_at,
    p.updated_by_member_id,
    p.updated_at,
    p.is_deleted,
    COUNT(DISTINCT r.read_id) AS read_count,
    COUNT(DISTINCT c.comment_id) AS comment_count
FROM public.bulletin_posts p
LEFT JOIN public.members m ON p.author_member_id = m.member_id
LEFT JOIN public.bulletin_reads r ON p.post_id = r.post_id
LEFT JOIN public.bulletin_comments c ON p.post_id = c.post_id AND c.is_deleted = FALSE
WHERE p.is_deleted = FALSE
GROUP BY p.post_id, m.name, m.avatar_url;
