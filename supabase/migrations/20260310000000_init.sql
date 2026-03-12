-- 1) usage_events (anti-abuse)
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id_hash VARCHAR(64) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('lichess', 'chesscom')),
    username_analyzed VARCHAR(255) NOT NULL,
    tier VARCHAR(10) NOT NULL CHECK (tier IN ('free', 'pro', 'elite')),
    ad_verified BOOLEAN NOT NULL DEFAULT false,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_events_device_created ON usage_events(device_id_hash, created_at DESC);
CREATE INDEX idx_usage_events_device_user_created ON usage_events(device_id_hash, username_analyzed, created_at DESC);
CREATE INDEX idx_usage_events_ip_created ON usage_events(ip_address, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON usage_events FROM PUBLIC, anon, authenticated;

-- 2) analysis_cache (SWR cache)
CREATE TABLE analysis_cache (
    cache_key VARCHAR(64) PRIMARY KEY,
    tier VARCHAR(10) NOT NULL,
    algo_version VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ready', 'refreshing', 'failed')),
    result JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    stale_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE analysis_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON analysis_cache FROM PUBLIC, anon, authenticated;

-- 3) jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'failed')),
    progress VARCHAR(50) NOT NULL DEFAULT 'fetch',
    retry_after_seconds INT NOT NULL DEFAULT 0,
    priority INT NOT NULL DEFAULT 3, -- 1=elite, 2=pro, 3=free
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedupe: unique partial index prevents more than one active job for the same cache_key
CREATE UNIQUE INDEX idx_jobs_active_dedupe ON jobs(cache_key) WHERE status IN ('pending', 'processing');

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jobs FROM PUBLIC, anon, authenticated;

-- Cleanup (pg_cron)
-- Note: pg_cron extension needs to be enabled in Supabase
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    DELETE FROM usage_events WHERE created_at < now() - INTERVAL '30 days';
    DELETE FROM analysis_cache WHERE now() > stale_expires_at;
    DELETE FROM jobs WHERE status IN ('done', 'failed') AND updated_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Assuming pg_cron is enabled:
SELECT cron.schedule('cleanup_expired_data_job', '0 3 * * *', 'SELECT cleanup_expired_data()');
