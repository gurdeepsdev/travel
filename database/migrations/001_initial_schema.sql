--
-- PostgreSQL database dump
--

\restrict BIISmqMuYspWOtSTNbcIpzkDjfC4Eb8WTBqu0BrtlFZaS0ZvInlNqwD0AYbikCo

-- Dumped from database version 17.10 (Debian 17.10-1.pgdg13+1)
-- Dumped by pg_dump version 18.4 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: chat; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA chat;


--
-- Name: community; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA community;


--
-- Name: explore; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA explore;


--
-- Name: groups; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA groups;


--
-- Name: itinerary; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA itinerary;


--
-- Name: media; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA media;


--
-- Name: poi; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA poi;


--
-- Name: trip; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA trip;


--
-- Name: users; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA users;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    provider_identifier character varying(255) NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Stores authentication identities for users.';


--
-- Name: COLUMN identities.id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.id IS 'Primary key.';


--
-- Name: COLUMN identities.user_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.user_id IS 'Reference to auth.users.';


--
-- Name: COLUMN identities.provider; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.provider IS 'Authentication provider.';


--
-- Name: COLUMN identities.provider_identifier; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.provider_identifier IS 'Unique identifier received from the provider.';


--
-- Name: COLUMN identities.is_verified; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.is_verified IS 'Whether the identity has been verified.';


--
-- Name: COLUMN identities.is_primary; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.is_primary IS 'Whether this is the primary identity.';


--
-- Name: COLUMN identities.created_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.created_at IS 'Creation timestamp.';


--
-- Name: COLUMN identities.updated_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.updated_at IS 'Last update timestamp.';


--
-- Name: login_history; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.login_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    identifier character varying(255) NOT NULL,
    provider character varying(50) NOT NULL,
    ip_address character varying(100),
    user_agent text,
    status character varying(50) NOT NULL,
    failure_reason character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE login_history; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.login_history IS 'Stores login attempt history.';


--
-- Name: COLUMN login_history.id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.id IS 'Primary key.';


--
-- Name: COLUMN login_history.user_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.user_id IS 'Reference to auth.users.';


--
-- Name: COLUMN login_history.identifier; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.identifier IS 'Phone number or email used for login.';


--
-- Name: COLUMN login_history.provider; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.provider IS 'Authentication provider.';


--
-- Name: COLUMN login_history.ip_address; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.ip_address IS 'Client IP address.';


--
-- Name: COLUMN login_history.user_agent; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.user_agent IS 'Client user agent.';


--
-- Name: COLUMN login_history.status; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.status IS 'Login result.';


--
-- Name: COLUMN login_history.failure_reason; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.failure_reason IS 'Failure reason if login failed.';


--
-- Name: COLUMN login_history.created_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.login_history.created_at IS 'Login timestamp.';


--
-- Name: otp_requests; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.otp_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier character varying(255) NOT NULL,
    provider character varying(50) NOT NULL,
    otp_hash text,
    attempt_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    external_verification_id text
);


--
-- Name: TABLE otp_requests; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.otp_requests IS 'Stores OTP requests.';


--
-- Name: COLUMN otp_requests.id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.otp_requests.id IS 'Primary key.';


--
-- Name: COLUMN otp_requests.identifier; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.otp_requests.identifier IS 'Phone number or email address.';


--
-- Name: COLUMN otp_requests.provider; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.otp_requests.provider IS 'OTP provider used.';


--
-- Name: COLUMN otp_requests.otp_hash; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.otp_requests.otp_hash IS 'BCrypt hash of generated OTP.';


--
-- Name: COLUMN otp_requests.attempt_count; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.otp_requests.attempt_count IS 'Number of verification attempts.';


--
-- Name: COLUMN otp_requests.expires_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.otp_requests.expires_at IS 'OTP expiry timestamp.';


--
-- Name: COLUMN otp_requests.verified_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.otp_requests.verified_at IS 'Verification timestamp.';


--
-- Name: COLUMN otp_requests.created_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.otp_requests.created_at IS 'Creation timestamp.';


--
-- Name: security_events; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.security_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type character varying(100) NOT NULL,
    ip_address character varying(100),
    user_agent text,
    metadata json,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE security_events; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.security_events IS 'Stores authentication security events.';


--
-- Name: COLUMN security_events.id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.security_events.id IS 'Primary key.';


--
-- Name: COLUMN security_events.user_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.security_events.user_id IS 'Reference to auth.users.';


--
-- Name: COLUMN security_events.event_type; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.security_events.event_type IS 'Security event type.';


--
-- Name: COLUMN security_events.ip_address; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.security_events.ip_address IS 'Client IP address.';


--
-- Name: COLUMN security_events.user_agent; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.security_events.user_agent IS 'Client user agent.';


--
-- Name: COLUMN security_events.metadata; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.security_events.metadata IS 'Additional event information.';


--
-- Name: COLUMN security_events.created_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.security_events.created_at IS 'Event timestamp.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash text NOT NULL,
    device_name character varying(255),
    device_type character varying(100),
    ip_address character varying(100),
    user_agent text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Stores authenticated user sessions.';


--
-- Name: COLUMN sessions.id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.id IS 'Primary key.';


--
-- Name: COLUMN sessions.user_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.user_id IS 'Reference to auth.users.';


--
-- Name: COLUMN sessions.refresh_token_hash; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hash IS 'BCrypt hash of refresh token.';


--
-- Name: COLUMN sessions.device_name; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.device_name IS 'Device name.';


--
-- Name: COLUMN sessions.device_type; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.device_type IS 'Device type.';


--
-- Name: COLUMN sessions.ip_address; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.ip_address IS 'Client IP address.';


--
-- Name: COLUMN sessions.user_agent; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.user_agent IS 'Client user agent.';


--
-- Name: COLUMN sessions.expires_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.expires_at IS 'Session expiry timestamp.';


--
-- Name: COLUMN sessions.created_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.created_at IS 'Creation timestamp.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Stores authentication users.';


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.id IS 'Primary identifier of the authenticated user.';


--
-- Name: COLUMN users.status; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.status IS 'Current account status.';


--
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.created_at IS 'Creation timestamp.';


--
-- Name: COLUMN users.updated_at; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.updated_at IS 'Last update timestamp.';


--
-- Name: chat_messages; Type: TABLE; Schema: chat; Owner: -
--

CREATE TABLE chat.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sent_by uuid NOT NULL,
    message_type character varying(50) NOT NULL,
    message_content character varying(512) NOT NULL,
    itinerary_id uuid,
    reply_to_message_id uuid,
    edited_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_chat_messages_content_not_blank CHECK ((btrim((message_content)::text) <> ''::text)),
    CONSTRAINT chk_chat_messages_not_self_reply CHECK (((reply_to_message_id IS NULL) OR (reply_to_message_id <> id))),
    CONSTRAINT chk_chat_messages_type CHECK (((message_type)::text = ANY ((ARRAY['TEXT'::character varying, 'IMAGE'::character varying, 'VIDEO'::character varying, 'AUDIO'::character varying, 'DOCUMENT'::character varying, 'LOCATION'::character varying, 'ITINERARY'::character varying, 'SYSTEM'::character varying])::text[])))
);


--
-- Name: conversation_participants; Type: TABLE; Schema: chat; Owner: -
--

CREATE TABLE chat.conversation_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    left_at timestamp without time zone,
    last_read_message_id uuid,
    last_read_at timestamp without time zone,
    is_muted boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_conversation_participants_left_at CHECK (((left_at IS NULL) OR (left_at >= joined_at))),
    CONSTRAINT chk_conversation_participants_role CHECK (((role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'member'::character varying])::text[])))
);


--
-- Name: conversations; Type: TABLE; Schema: chat; Owner: -
--

CREATE TABLE chat.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    last_message_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    conversation_type character varying(20) DEFAULT 'group'::character varying NOT NULL,
    direct_key character varying(100),
    CONSTRAINT chk_conversations_direct_key CHECK (((((conversation_type)::text = 'direct'::text) AND (direct_key IS NOT NULL)) OR (((conversation_type)::text = 'group'::text) AND (direct_key IS NULL)))),
    CONSTRAINT chk_conversations_group_requirement CHECK (((((conversation_type)::text = 'group'::text) AND (group_id IS NOT NULL)) OR (((conversation_type)::text = 'direct'::text) AND (group_id IS NULL)))),
    CONSTRAINT chk_conversations_type CHECK (((conversation_type)::text = ANY ((ARRAY['direct'::character varying, 'group'::character varying])::text[])))
);


--
-- Name: message_assets; Type: TABLE; Schema: chat; Owner: -
--

CREATE TABLE chat.message_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    display_order integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_message_assets_display_order CHECK ((display_order > 0))
);


--
-- Name: message_mentions; Type: TABLE; Schema: chat; Owner: -
--

CREATE TABLE chat.message_mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    mentioned_user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: message_reactions; Type: TABLE; Schema: chat; Owner: -
--

CREATE TABLE chat.message_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_message_reactions_not_blank CHECK ((btrim((reaction)::text) <> ''::text))
);


--
-- Name: communities; Type: TABLE; Schema: community; Owner: -
--

CREATE TABLE community.communities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(250),
    icon_asset_id uuid NOT NULL,
    join_type character varying(50),
    member_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_communities_description_not_blank CHECK (((description IS NULL) OR (btrim((description)::text) <> ''::text))),
    CONSTRAINT chk_communities_join_type_not_blank CHECK (((join_type IS NULL) OR (btrim((join_type)::text) <> ''::text))),
    CONSTRAINT chk_communities_member_count CHECK ((member_count >= 0)),
    CONSTRAINT chk_communities_name_not_blank CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: community_bans; Type: TABLE; Schema: community; Owner: -
--

CREATE TABLE community.community_bans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid NOT NULL,
    user_id uuid NOT NULL,
    banned_user_id uuid NOT NULL,
    reason character varying(250),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_community_bans_not_self CHECK ((user_id <> banned_user_id)),
    CONSTRAINT chk_community_bans_reason_not_blank CHECK (((reason IS NULL) OR (btrim((reason)::text) <> ''::text)))
);


--
-- Name: community_member_request; Type: TABLE; Schema: community; Owner: -
--

CREATE TABLE community.community_member_request (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid NOT NULL,
    request_type character varying(50),
    request_by uuid NOT NULL,
    target_user_id uuid NOT NULL,
    status character varying(50),
    reviewed_by uuid NOT NULL,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_community_member_request_not_self_target CHECK ((request_by <> target_user_id)),
    CONSTRAINT chk_community_member_request_request_type_not_blank CHECK (((request_type IS NULL) OR (btrim((request_type)::text) <> ''::text))),
    CONSTRAINT chk_community_member_request_status_not_blank CHECK (((status IS NULL) OR (btrim((status)::text) <> ''::text)))
);


--
-- Name: community_members; Type: TABLE; Schema: community; Owner: -
--

CREATE TABLE community.community_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    community_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50),
    status character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_community_members_role_not_blank CHECK (((role IS NULL) OR (btrim((role)::text) <> ''::text))),
    CONSTRAINT chk_community_members_status_not_blank CHECK (((status IS NULL) OR (btrim((status)::text) <> ''::text)))
);


--
-- Name: comments; Type: TABLE; Schema: explore; Owner: -
--

CREATE TABLE explore.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment character varying(250) NOT NULL,
    parent_comment_id uuid,
    like_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_comments_comment_not_blank CHECK ((btrim((comment)::text) <> ''::text)),
    CONSTRAINT chk_comments_like_count_non_negative CHECK ((like_count >= 0)),
    CONSTRAINT chk_comments_not_self_parent CHECK (((parent_comment_id IS NULL) OR (parent_comment_id <> id)))
);


--
-- Name: post_assets; Type: TABLE; Schema: explore; Owner: -
--

CREATE TABLE explore.post_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    display_order bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_post_assets_display_order_non_negative CHECK ((display_order >= 0))
);


--
-- Name: post_been_there; Type: TABLE; Schema: explore; Owner: -
--

CREATE TABLE explore.post_been_there (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: post_itineraries; Type: TABLE; Schema: explore; Owner: -
--

CREATE TABLE explore.post_itineraries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    itinerary_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: post_likes; Type: TABLE; Schema: explore; Owner: -
--

CREATE TABLE explore.post_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: post_reshare; Type: TABLE; Schema: explore; Owner: -
--

CREATE TABLE explore.post_reshare (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    shared_post_id uuid NOT NULL,
    caption character varying(250),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_post_reshare_caption_not_blank CHECK (((caption IS NULL) OR (btrim((caption)::text) <> ''::text))),
    CONSTRAINT chk_post_reshare_not_self CHECK ((post_id <> shared_post_id))
);


--
-- Name: posts; Type: TABLE; Schema: explore; Owner: -
--

CREATE TABLE explore.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    caption character varying(250),
    post_type character varying(50),
    visibility character varying(50),
    place_id uuid NOT NULL,
    comment_count bigint DEFAULT 0 NOT NULL,
    share_count bigint DEFAULT 0 NOT NULL,
    view_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_posts_caption_not_blank CHECK (((caption IS NULL) OR (btrim((caption)::text) <> ''::text))),
    CONSTRAINT chk_posts_comment_count_non_negative CHECK ((comment_count >= 0)),
    CONSTRAINT chk_posts_post_type_not_blank CHECK (((post_type IS NULL) OR (btrim((post_type)::text) <> ''::text))),
    CONSTRAINT chk_posts_share_count_non_negative CHECK ((share_count >= 0)),
    CONSTRAINT chk_posts_view_count_non_negative CHECK ((view_count >= 0)),
    CONSTRAINT chk_posts_visibility_not_blank CHECK (((visibility IS NULL) OR (btrim((visibility)::text) <> ''::text)))
);


--
-- Name: group_invitations; Type: TABLE; Schema: groups; Owner: -
--

CREATE TABLE groups.group_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    invited_user_id uuid NOT NULL,
    invited_by uuid NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    message text,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    responded_at timestamp without time zone,
    CONSTRAINT chk_group_invitation_status CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACCEPTED'::character varying, 'DECLINED'::character varying, 'EXPIRED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: group_members; Type: TABLE; Schema: groups; Owner: -
--

CREATE TABLE groups.group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) DEFAULT 'MEMBER'::character varying NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_group_member_role CHECK (((role)::text = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MEMBER'::character varying])::text[])))
);


--
-- Name: groups; Type: TABLE; Schema: groups; Owner: -
--

CREATE TABLE groups.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    cover_asset_id uuid,
    itinerary_id uuid,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_group_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'ARCHIVED'::character varying])::text[]))),
    CONSTRAINT chk_groups_name_not_blank CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: itineraries; Type: TABLE; Schema: itinerary; Owner: -
--

CREATE TABLE itinerary.itineraries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    cover_asset_id uuid,
    start_date date,
    end_date date,
    duration_days smallint,
    budget_amount numeric(12,2),
    currency_code character(3),
    visibility character varying(20) DEFAULT 'private'::character varying NOT NULL,
    trip_status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    ai_generated boolean DEFAULT false NOT NULL,
    itinerary_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_budget_amount CHECK (((budget_amount IS NULL) OR (budget_amount >= (0)::numeric))),
    CONSTRAINT chk_duration_days CHECK (((duration_days IS NULL) OR (duration_days > 0))),
    CONSTRAINT chk_trip_dates CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT chk_trip_status CHECK (((trip_status)::text = ANY ((ARRAY['draft'::character varying, 'planned'::character varying, 'ongoing'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT chk_visibility CHECK (((visibility)::text = ANY ((ARRAY['private'::character varying, 'friends'::character varying, 'public'::character varying])::text[])))
);


--
-- Name: itinerary_change_requests; Type: TABLE; Schema: itinerary; Owner: -
--

CREATE TABLE itinerary.itinerary_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    itinerary_id uuid NOT NULL,
    itinerary_item_id uuid,
    requested_by uuid NOT NULL,
    request_type character varying(30) NOT NULL,
    proposed_data jsonb NOT NULL,
    message text,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_request_status CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACCEPTED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT chk_request_type CHECK (((request_type)::text = ANY ((ARRAY['ADD_ITEM'::character varying, 'UPDATE_ITEM'::character varying, 'DELETE_ITEM'::character varying, 'UPDATE_ITINERARY'::character varying])::text[])))
);


--
-- Name: itinerary_forks; Type: TABLE; Schema: itinerary; Owner: -
--

CREATE TABLE itinerary.itinerary_forks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    original_itinerary_id uuid NOT NULL,
    forked_itinerary_id uuid NOT NULL,
    forked_by uuid NOT NULL,
    fork_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_not_self_fork CHECK ((original_itinerary_id <> forked_itinerary_id))
);


--
-- Name: itinerary_items; Type: TABLE; Schema: itinerary; Owner: -
--

CREATE TABLE itinerary.itinerary_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    itinerary_id uuid NOT NULL,
    day_number smallint NOT NULL,
    sequence_number smallint NOT NULL,
    activity_type character varying(30) NOT NULL,
    poi_id uuid,
    title character varying(255) NOT NULL,
    description text,
    location_name character varying(255),
    start_time time without time zone,
    end_time time without time zone,
    estimated_cost numeric(12,2),
    currency_code character(3),
    status character varying(20) DEFAULT 'planned'::character varying NOT NULL,
    cover_asset_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_activity_status CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'completed'::character varying, 'skipped'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT chk_activity_type CHECK (((activity_type)::text = ANY ((ARRAY['poi'::character varying, 'hotel'::character varying, 'restaurant'::character varying, 'flight'::character varying, 'train'::character varying, 'bus'::character varying, 'taxi'::character varying, 'walk'::character varying, 'shopping'::character varying, 'activity'::character varying, 'transport'::character varying, 'note'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT chk_day_number CHECK ((day_number > 0)),
    CONSTRAINT chk_estimated_cost CHECK (((estimated_cost IS NULL) OR (estimated_cost >= (0)::numeric))),
    CONSTRAINT chk_item_time CHECK (((start_time IS NULL) OR (end_time IS NULL) OR (end_time >= start_time))),
    CONSTRAINT chk_sequence_number CHECK ((sequence_number > 0))
);


--
-- Name: itinerary_shares; Type: TABLE; Schema: itinerary; Owner: -
--

CREATE TABLE itinerary.itinerary_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    itinerary_id uuid NOT NULL,
    share_token character varying(128) NOT NULL,
    access_type character varying(20) DEFAULT 'private'::character varying NOT NULL,
    password_hash text,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_access_type CHECK (((access_type)::text = ANY ((ARRAY['private'::character varying, 'public'::character varying, 'password'::character varying])::text[])))
);


--
-- Name: itinerary_versions; Type: TABLE; Schema: itinerary; Owner: -
--

CREATE TABLE itinerary.itinerary_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    itinerary_id uuid NOT NULL,
    version_number integer NOT NULL,
    generation_type character varying(30) NOT NULL,
    snapshot_json jsonb NOT NULL,
    change_summary text,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_generation_type CHECK (((generation_type)::text = ANY ((ARRAY['MANUAL'::character varying, 'AI_GENERATED'::character varying, 'AI_REGENERATED'::character varying, 'RESTORED'::character varying, 'IMPORTED'::character varying])::text[])))
);


--
-- Name: asset_usage; Type: TABLE; Schema: media; Owner: -
--

CREATE TABLE media.asset_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    asset_role character varying(50) NOT NULL,
    display_order smallint DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_asset_role CHECK (((asset_role)::text = ANY ((ARRAY['avatar'::character varying, 'cover'::character varying, 'hero'::character varying, 'gallery'::character varying, 'attachment'::character varying, 'logo'::character varying, 'banner'::character varying, 'thumbnail'::character varying])::text[]))),
    CONSTRAINT chk_display_order CHECK ((display_order >= 1)),
    CONSTRAINT chk_entity_type CHECK (((entity_type)::text = ANY ((ARRAY['user_profile'::character varying, 'page'::character varying, 'itinerary'::character varying, 'poi'::character varying, 'community_post'::character varying, 'community_comment'::character varying, 'message'::character varying, 'review'::character varying, 'album'::character varying])::text[])))
);


--
-- Name: asset_variants; Type: TABLE; Schema: media; Owner: -
--

CREATE TABLE media.asset_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    variant_name character varying(50) NOT NULL,
    format character varying(20) NOT NULL,
    quality smallint,
    width integer NOT NULL,
    height integer NOT NULL,
    storage_key text NOT NULL,
    file_size bigint NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_variant_dimensions CHECK (((width > 0) AND (height > 0))),
    CONSTRAINT chk_variant_file_size CHECK ((file_size >= 0)),
    CONSTRAINT chk_variant_format CHECK (((format)::text = ANY ((ARRAY['jpg'::character varying, 'jpeg'::character varying, 'png'::character varying, 'webp'::character varying, 'avif'::character varying, 'gif'::character varying, 'mp4'::character varying, 'webm'::character varying])::text[]))),
    CONSTRAINT chk_variant_name CHECK (((variant_name)::text = ANY ((ARRAY['original'::character varying, 'thumbnail'::character varying, 'small'::character varying, 'medium'::character varying, 'large'::character varying, 'custom'::character varying])::text[]))),
    CONSTRAINT chk_variant_quality CHECK (((quality IS NULL) OR ((quality >= 1) AND (quality <= 100))))
);


--
-- Name: assets; Type: TABLE; Schema: media; Owner: -
--

CREATE TABLE media.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    storage_provider character varying(30) NOT NULL,
    bucket character varying(255) NOT NULL,
    storage_key text NOT NULL,
    original_filename character varying(255) NOT NULL,
    mime_type character varying(100) NOT NULL,
    extension character varying(20),
    file_size bigint NOT NULL,
    checksum character varying(64) NOT NULL,
    original_width integer,
    original_height integer,
    duration_seconds integer,
    uploaded_by uuid NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_dimensions CHECK ((((original_width IS NULL) AND (original_height IS NULL)) OR ((original_width > 0) AND (original_height > 0)))),
    CONSTRAINT chk_duration CHECK (((duration_seconds IS NULL) OR (duration_seconds >= 0))),
    CONSTRAINT chk_file_size CHECK ((file_size >= 0)),
    CONSTRAINT chk_storage_provider CHECK (((storage_provider)::text = ANY ((ARRAY['local'::character varying, 's3'::character varying, 'r2'::character varying, 'azure'::character varying, 'cloudinary'::character varying])::text[])))
);


--
-- Name: categories; Type: TABLE; Schema: poi; Owner: -
--

CREATE TABLE poi.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    icon_asset_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_categories_name_not_blank CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: cities; Type: TABLE; Schema: poi; Owner: -
--

CREATE TABLE poi.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_id uuid NOT NULL,
    country_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    official_name character varying(100),
    longitude double precision,
    latitude double precision,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_cities_latitude_range CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)))),
    CONSTRAINT chk_cities_longitude_range CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))),
    CONSTRAINT chk_cities_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_cities_official_name_not_blank CHECK (((official_name IS NULL) OR (btrim((official_name)::text) <> ''::text)))
);


--
-- Name: countries; Type: TABLE; Schema: poi; Owner: -
--

CREATE TABLE poi.countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    code character varying(50) NOT NULL,
    phone_prefix character varying(10),
    currency_id uuid,
    timezone character varying(10),
    flag_asset_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    description character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_countries_code_not_blank CHECK ((btrim((code)::text) <> ''::text)),
    CONSTRAINT chk_countries_description_not_blank CHECK (((description IS NULL) OR (btrim((description)::text) <> ''::text))),
    CONSTRAINT chk_countries_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_countries_phone_prefix_not_blank CHECK (((phone_prefix IS NULL) OR (btrim((phone_prefix)::text) <> ''::text))),
    CONSTRAINT chk_countries_timezone_not_blank CHECK (((timezone IS NULL) OR (btrim((timezone)::text) <> ''::text)))
);


--
-- Name: currencies; Type: TABLE; Schema: poi; Owner: -
--

CREATE TABLE poi.currencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    symbol character varying(10) NOT NULL,
    exchange_rate double precision NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_currencies_exchange_rate_positive CHECK ((exchange_rate > (0)::double precision)),
    CONSTRAINT chk_currencies_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_currencies_symbol_not_blank CHECK ((btrim((symbol)::text) <> ''::text))
);


--
-- Name: places; Type: TABLE; Schema: poi; Owner: -
--

CREATE TABLE poi.places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    city_id uuid NOT NULL,
    region_id uuid NOT NULL,
    country_id uuid NOT NULL,
    category_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(500),
    address character varying(300),
    postal_code character varying(50),
    longitude double precision,
    latitude double precision,
    opening_hour jsonb,
    closing_hour jsonb,
    recommended_duration character varying(50),
    booking_type character varying(50),
    is_verified boolean DEFAULT false NOT NULL,
    require_ticket boolean DEFAULT false NOT NULL,
    review_count bigint DEFAULT 0 NOT NULL,
    rating double precision,
    provider character varying(50),
    provider_id character varying(100),
    is_closed boolean DEFAULT false NOT NULL,
    media_id uuid,
    itinerary_worthiness boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_places_address_not_blank CHECK (((address IS NULL) OR (btrim((address)::text) <> ''::text))),
    CONSTRAINT chk_places_booking_type_not_blank CHECK (((booking_type IS NULL) OR (btrim((booking_type)::text) <> ''::text))),
    CONSTRAINT chk_places_closing_hour_object CHECK (((closing_hour IS NULL) OR (jsonb_typeof(closing_hour) = ANY (ARRAY['object'::text, 'array'::text, 'string'::text])))),
    CONSTRAINT chk_places_description_not_blank CHECK (((description IS NULL) OR (btrim((description)::text) <> ''::text))),
    CONSTRAINT chk_places_latitude_range CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)))),
    CONSTRAINT chk_places_longitude_range CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))),
    CONSTRAINT chk_places_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_places_opening_hour_object CHECK (((opening_hour IS NULL) OR (jsonb_typeof(opening_hour) = ANY (ARRAY['object'::text, 'array'::text, 'string'::text])))),
    CONSTRAINT chk_places_postal_code_not_blank CHECK (((postal_code IS NULL) OR (btrim((postal_code)::text) <> ''::text))),
    CONSTRAINT chk_places_provider_id_not_blank CHECK (((provider_id IS NULL) OR (btrim((provider_id)::text) <> ''::text))),
    CONSTRAINT chk_places_provider_not_blank CHECK (((provider IS NULL) OR (btrim((provider)::text) <> ''::text))),
    CONSTRAINT chk_places_rating_range CHECK (((rating IS NULL) OR ((rating >= (0)::double precision) AND (rating <= (5)::double precision)))),
    CONSTRAINT chk_places_recommended_duration_not_blank CHECK (((recommended_duration IS NULL) OR (btrim((recommended_duration)::text) <> ''::text))),
    CONSTRAINT chk_places_review_count_non_negative CHECK ((review_count >= 0))
);


--
-- Name: places_tags; Type: TABLE; Schema: poi; Owner: -
--

CREATE TABLE poi.places_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    icon_asset_id uuid,
    tag_name character varying(50) NOT NULL,
    category_id uuid NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_places_tags_name_not_blank CHECK ((btrim((tag_name)::text) <> ''::text))
);


--
-- Name: regions; Type: TABLE; Schema: poi; Owner: -
--

CREATE TABLE poi.regions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_id uuid NOT NULL,
    name character varying(50) NOT NULL,
    official_name character varying(100),
    longitude double precision,
    latitude double precision,
    description character varying(500),
    timezone character varying(10),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_regions_description_not_blank CHECK (((description IS NULL) OR (btrim((description)::text) <> ''::text))),
    CONSTRAINT chk_regions_latitude_range CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)))),
    CONSTRAINT chk_regions_longitude_range CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))),
    CONSTRAINT chk_regions_name_not_blank CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT chk_regions_official_name_not_blank CHECK (((official_name IS NULL) OR (btrim((official_name)::text) <> ''::text))),
    CONSTRAINT chk_regions_timezone_not_blank CHECK (((timezone IS NULL) OR (btrim((timezone)::text) <> ''::text)))
);


--
-- Name: trip_documents; Type: TABLE; Schema: trip; Owner: -
--

CREATE TABLE trip.trip_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    document_type character varying(30) NOT NULL,
    title character varying(255) NOT NULL,
    asset_id uuid NOT NULL,
    document_number character varying(100),
    issue_date date,
    expiry_date date,
    issuing_country_id uuid,
    visibility character varying(20) DEFAULT 'PRIVATE'::character varying NOT NULL,
    notes text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_trip_document_dates CHECK (((expiry_date IS NULL) OR (issue_date IS NULL) OR (expiry_date >= issue_date))),
    CONSTRAINT chk_trip_document_type CHECK (((document_type)::text = ANY ((ARRAY['PASSPORT'::character varying, 'VISA'::character varying, 'INSURANCE'::character varying, 'FLIGHT_TICKET'::character varying, 'TRAIN_TICKET'::character varying, 'BUS_TICKET'::character varying, 'HOTEL_BOOKING'::character varying, 'DRIVING_LICENSE'::character varying, 'ID_CARD'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT chk_trip_document_visibility CHECK (((visibility)::text = ANY ((ARRAY['PRIVATE'::character varying, 'GROUP'::character varying])::text[])))
);


--
-- Name: trip_essentials; Type: TABLE; Schema: trip; Owner: -
--

CREATE TABLE trip.trip_essentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    category character varying(30) NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    display_order smallint DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_trip_essentials_category CHECK (((category)::text = ANY ((ARRAY['DOCUMENT'::character varying, 'ELECTRONICS'::character varying, 'MEDICINE'::character varying, 'CLOTHES'::character varying, 'TOILETRIES'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT chk_trip_essentials_display_order CHECK ((display_order > 0))
);


--
-- Name: trip_expense_splits; Type: TABLE; Schema: trip; Owner: -
--

CREATE TABLE trip.trip_expense_splits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    percentage numeric(5,2),
    settlement_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    reminder character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_trip_expense_splits_amount CHECK ((amount >= (0)::numeric)),
    CONSTRAINT chk_trip_expense_splits_percentage CHECK (((percentage IS NULL) OR ((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))),
    CONSTRAINT chk_trip_expense_splits_status CHECK (((settlement_status)::text = ANY ((ARRAY['PENDING'::character varying, 'PARTIALLY_PAID'::character varying, 'SETTLED'::character varying, 'WAIVED'::character varying])::text[])))
);


--
-- Name: trip_expenses; Type: TABLE; Schema: trip; Owner: -
--

CREATE TABLE trip.trip_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    paid_by uuid NOT NULL,
    expense_category character varying(30) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    amount numeric(12,2) NOT NULL,
    currency_code character(3) NOT NULL,
    payment_method character varying(20) NOT NULL,
    expense_date date NOT NULL,
    receipt_asset_id uuid,
    location_name character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    CONSTRAINT chk_trip_expense_amount CHECK ((amount >= (0)::numeric)),
    CONSTRAINT chk_trip_expense_category CHECK (((expense_category)::text = ANY ((ARRAY['FOOD'::character varying, 'TRANSPORT'::character varying, 'HOTEL'::character varying, 'SHOPPING'::character varying, 'ACTIVITY'::character varying, 'MEDICAL'::character varying, 'ENTERTAINMENT'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT chk_trip_payment_method CHECK (((payment_method)::text = ANY ((ARRAY['CASH'::character varying, 'CARD'::character varying, 'UPI'::character varying, 'BANK_TRANSFER'::character varying, 'OTHER'::character varying])::text[])))
);


--
-- Name: trips; Type: TABLE; Schema: trip; Owner: -
--

CREATE TABLE trip.trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    itinerary_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying(20) DEFAULT 'UPCOMING'::character varying NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_trip_dates CHECK (((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))),
    CONSTRAINT chk_trip_status CHECK (((status)::text = ANY ((ARRAY['UPCOMING'::character varying, 'ONGOING'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: blocked_users; Type: TABLE; Schema: users; Owner: -
--

CREATE TABLE users.blocked_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    blocked_user_id uuid NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_block_self CHECK ((user_id <> blocked_user_id))
);


--
-- Name: preferences; Type: TABLE; Schema: users; Owner: -
--

CREATE TABLE users.preferences (
    user_id uuid NOT NULL,
    preferences_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: users; Owner: -
--

CREATE TABLE users.profiles (
    user_id uuid NOT NULL,
    username character varying(100) NOT NULL,
    display_name character varying(255),
    bio text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    profile_photo_asset_id uuid,
    cover_photo_asset_id uuid,
    country_id uuid,
    city_id uuid,
    social_links jsonb DEFAULT '{}'::jsonb,
    is_verified boolean DEFAULT false NOT NULL,
    profile_completed_at timestamp without time zone,
    deleted_at timestamp without time zone
);


--
-- Name: TABLE profiles; Type: COMMENT; Schema: users; Owner: -
--

COMMENT ON TABLE users.profiles IS 'Stores public user profile information.';


--
-- Name: COLUMN profiles.user_id; Type: COMMENT; Schema: users; Owner: -
--

COMMENT ON COLUMN users.profiles.user_id IS 'Reference to auth.users.';


--
-- Name: COLUMN profiles.username; Type: COMMENT; Schema: users; Owner: -
--

COMMENT ON COLUMN users.profiles.username IS 'Unique public username.';


--
-- Name: COLUMN profiles.display_name; Type: COMMENT; Schema: users; Owner: -
--

COMMENT ON COLUMN users.profiles.display_name IS 'Display name shown publicly.';


--
-- Name: COLUMN profiles.bio; Type: COMMENT; Schema: users; Owner: -
--

COMMENT ON COLUMN users.profiles.bio IS 'User biography.';


--
-- Name: COLUMN profiles.created_at; Type: COMMENT; Schema: users; Owner: -
--

COMMENT ON COLUMN users.profiles.created_at IS 'Creation timestamp.';


--
-- Name: COLUMN profiles.updated_at; Type: COMMENT; Schema: users; Owner: -
--

COMMENT ON COLUMN users.profiles.updated_at IS 'Last update timestamp.';


--
-- Name: saved_items; Type: TABLE; Schema: users; Owner: -
--

CREATE TABLE users.saved_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_type character varying(20) NOT NULL,
    item_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_saved_item_type CHECK (((item_type)::text = ANY ((ARRAY['PLACE'::character varying, 'ITINERARY'::character varying, 'MEDIA'::character varying, 'POST'::character varying])::text[])))
);


--
-- Name: user_settings; Type: TABLE; Schema: users; Owner: -
--

CREATE TABLE users.user_settings (
    user_id uuid NOT NULL,
    settings_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: visited_places; Type: TABLE; Schema: users; Owner: -
--

CREATE TABLE users.visited_places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    place_id uuid NOT NULL,
    trip_id uuid,
    verification_asset_id uuid,
    verification_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    visit_source character varying(30) DEFAULT 'MANUAL'::character varying NOT NULL,
    visited_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_verification_status CHECK (((verification_status)::text = ANY ((ARRAY['PENDING'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT chk_visit_source CHECK (((visit_source)::text = ANY ((ARRAY['MANUAL'::character varying, 'TRIP_COMPLETION'::character varying, 'PHOTO_VERIFICATION'::character varying, 'ADMIN'::character varying])::text[])))
);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: login_history login_history_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.login_history
    ADD CONSTRAINT login_history_pkey PRIMARY KEY (id);


--
-- Name: otp_requests otp_requests_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.otp_requests
    ADD CONSTRAINT otp_requests_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: message_assets message_assets_pkey; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_assets
    ADD CONSTRAINT message_assets_pkey PRIMARY KEY (id);


--
-- Name: message_mentions message_mentions_pkey; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_mentions
    ADD CONSTRAINT message_mentions_pkey PRIMARY KEY (id);


--
-- Name: message_reactions message_reactions_pkey; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_reactions
    ADD CONSTRAINT message_reactions_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants uq_conversation_participants_user; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.conversation_participants
    ADD CONSTRAINT uq_conversation_participants_user UNIQUE (conversation_id, user_id);


--
-- Name: message_assets uq_message_assets_message_asset; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_assets
    ADD CONSTRAINT uq_message_assets_message_asset UNIQUE (message_id, asset_id);


--
-- Name: message_mentions uq_message_mentions_user; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_mentions
    ADD CONSTRAINT uq_message_mentions_user UNIQUE (message_id, mentioned_user_id);


--
-- Name: message_reactions uq_message_reactions_message_user_reaction; Type: CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_reactions
    ADD CONSTRAINT uq_message_reactions_message_user_reaction UNIQUE (message_id, user_id, reaction);


--
-- Name: communities communities_pkey; Type: CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.communities
    ADD CONSTRAINT communities_pkey PRIMARY KEY (id);


--
-- Name: community_bans community_bans_pkey; Type: CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_bans
    ADD CONSTRAINT community_bans_pkey PRIMARY KEY (id);


--
-- Name: community_member_request community_member_request_pkey; Type: CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_member_request
    ADD CONSTRAINT community_member_request_pkey PRIMARY KEY (id);


--
-- Name: community_members community_members_pkey; Type: CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_members
    ADD CONSTRAINT community_members_pkey PRIMARY KEY (id);


--
-- Name: community_bans uq_community_bans_community_banned_user; Type: CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_bans
    ADD CONSTRAINT uq_community_bans_community_banned_user UNIQUE (community_id, banned_user_id);


--
-- Name: community_members uq_community_members_community_user; Type: CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_members
    ADD CONSTRAINT uq_community_members_community_user UNIQUE (community_id, user_id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: post_assets post_assets_pkey; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_assets
    ADD CONSTRAINT post_assets_pkey PRIMARY KEY (id);


--
-- Name: post_been_there post_been_there_pkey; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_been_there
    ADD CONSTRAINT post_been_there_pkey PRIMARY KEY (id);


--
-- Name: post_itineraries post_itineraries_pkey; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_itineraries
    ADD CONSTRAINT post_itineraries_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (id);


--
-- Name: post_reshare post_reshare_pkey; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_reshare
    ADD CONSTRAINT post_reshare_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: post_assets uq_post_assets_post_asset; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_assets
    ADD CONSTRAINT uq_post_assets_post_asset UNIQUE (post_id, asset_id);


--
-- Name: post_assets uq_post_assets_post_display_order; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_assets
    ADD CONSTRAINT uq_post_assets_post_display_order UNIQUE (post_id, display_order);


--
-- Name: post_been_there uq_post_been_there_post_user; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_been_there
    ADD CONSTRAINT uq_post_been_there_post_user UNIQUE (post_id, user_id);


--
-- Name: post_itineraries uq_post_itineraries_post_itinerary; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_itineraries
    ADD CONSTRAINT uq_post_itineraries_post_itinerary UNIQUE (post_id, itinerary_id);


--
-- Name: post_likes uq_post_likes_post_user; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_likes
    ADD CONSTRAINT uq_post_likes_post_user UNIQUE (post_id, user_id);


--
-- Name: post_reshare uq_post_reshare_user_post; Type: CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_reshare
    ADD CONSTRAINT uq_post_reshare_user_post UNIQUE (user_id, shared_post_id);


--
-- Name: group_invitations group_invitations_pkey; Type: CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.group_invitations
    ADD CONSTRAINT group_invitations_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (id);


--
-- Name: groups groups_itinerary_id_key; Type: CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.groups
    ADD CONSTRAINT groups_itinerary_id_key UNIQUE (itinerary_id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: group_members uq_group_member; Type: CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.group_members
    ADD CONSTRAINT uq_group_member UNIQUE (group_id, user_id);


--
-- Name: itineraries itineraries_pkey; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itineraries
    ADD CONSTRAINT itineraries_pkey PRIMARY KEY (id);


--
-- Name: itinerary_change_requests itinerary_change_requests_pkey; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_change_requests
    ADD CONSTRAINT itinerary_change_requests_pkey PRIMARY KEY (id);


--
-- Name: itinerary_forks itinerary_forks_pkey; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_forks
    ADD CONSTRAINT itinerary_forks_pkey PRIMARY KEY (id);


--
-- Name: itinerary_items itinerary_items_pkey; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_items
    ADD CONSTRAINT itinerary_items_pkey PRIMARY KEY (id);


--
-- Name: itinerary_shares itinerary_shares_pkey; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_shares
    ADD CONSTRAINT itinerary_shares_pkey PRIMARY KEY (id);


--
-- Name: itinerary_versions itinerary_versions_pkey; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_versions
    ADD CONSTRAINT itinerary_versions_pkey PRIMARY KEY (id);


--
-- Name: itinerary_forks uq_itinerary_fork; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_forks
    ADD CONSTRAINT uq_itinerary_fork UNIQUE (original_itinerary_id, forked_itinerary_id);


--
-- Name: itinerary_items uq_itinerary_item_order; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_items
    ADD CONSTRAINT uq_itinerary_item_order UNIQUE (itinerary_id, day_number, sequence_number);


--
-- Name: itinerary_shares uq_itinerary_share_token; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_shares
    ADD CONSTRAINT uq_itinerary_share_token UNIQUE (share_token);


--
-- Name: itinerary_versions uq_itinerary_version; Type: CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_versions
    ADD CONSTRAINT uq_itinerary_version UNIQUE (itinerary_id, version_number);


--
-- Name: asset_usage asset_usage_pkey; Type: CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.asset_usage
    ADD CONSTRAINT asset_usage_pkey PRIMARY KEY (id);


--
-- Name: asset_variants asset_variants_pkey; Type: CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.asset_variants
    ADD CONSTRAINT asset_variants_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: asset_variants uq_asset_variant; Type: CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.asset_variants
    ADD CONSTRAINT uq_asset_variant UNIQUE (asset_id, variant_name, format, quality);


--
-- Name: assets uq_assets_checksum; Type: CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.assets
    ADD CONSTRAINT uq_assets_checksum UNIQUE (checksum);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);


--
-- Name: places places_pkey; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);


--
-- Name: places_tags places_tags_pkey; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places_tags
    ADD CONSTRAINT places_tags_pkey PRIMARY KEY (id);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: categories uq_categories_name; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.categories
    ADD CONSTRAINT uq_categories_name UNIQUE (name);


--
-- Name: cities uq_cities_region_name; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.cities
    ADD CONSTRAINT uq_cities_region_name UNIQUE (region_id, name);


--
-- Name: countries uq_countries_code; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.countries
    ADD CONSTRAINT uq_countries_code UNIQUE (code);


--
-- Name: places uq_places_provider_provider_id; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places
    ADD CONSTRAINT uq_places_provider_provider_id UNIQUE (provider, provider_id);


--
-- Name: places_tags uq_places_tags_category_name; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places_tags
    ADD CONSTRAINT uq_places_tags_category_name UNIQUE (category_id, tag_name);


--
-- Name: regions uq_regions_country_name; Type: CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.regions
    ADD CONSTRAINT uq_regions_country_name UNIQUE (country_id, name);


--
-- Name: trip_documents trip_documents_pkey; Type: CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_documents
    ADD CONSTRAINT trip_documents_pkey PRIMARY KEY (id);


--
-- Name: trip_essentials trip_essentials_pkey; Type: CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_essentials
    ADD CONSTRAINT trip_essentials_pkey PRIMARY KEY (id);


--
-- Name: trip_expense_splits trip_expense_splits_pkey; Type: CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_expense_splits
    ADD CONSTRAINT trip_expense_splits_pkey PRIMARY KEY (id);


--
-- Name: trip_expenses trip_expenses_pkey; Type: CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_expenses
    ADD CONSTRAINT trip_expenses_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: trip_expense_splits uq_trip_expense_splits_expense_user; Type: CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_expense_splits
    ADD CONSTRAINT uq_trip_expense_splits_expense_user UNIQUE (expense_id, user_id);


--
-- Name: trips uq_trip_itinerary; Type: CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trips
    ADD CONSTRAINT uq_trip_itinerary UNIQUE (itinerary_id);


--
-- Name: blocked_users blocked_users_pkey; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.blocked_users
    ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (id);


--
-- Name: preferences preferences_pkey; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);


--
-- Name: saved_items saved_items_pkey; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.saved_items
    ADD CONSTRAINT saved_items_pkey PRIMARY KEY (id);


--
-- Name: blocked_users uq_blocked_users; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.blocked_users
    ADD CONSTRAINT uq_blocked_users UNIQUE (user_id, blocked_user_id);


--
-- Name: saved_items uq_saved_item; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.saved_items
    ADD CONSTRAINT uq_saved_item UNIQUE (user_id, item_type, item_id);


--
-- Name: visited_places uq_user_place_visit; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.visited_places
    ADD CONSTRAINT uq_user_place_visit UNIQUE (user_id, place_id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- Name: visited_places visited_places_pkey; Type: CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.visited_places
    ADD CONSTRAINT visited_places_pkey PRIMARY KEY (id);


--
-- Name: idx_auth_identities_provider; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_identities_provider ON auth.identities USING btree (provider);


--
-- Name: idx_auth_identities_provider_identifier; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX idx_auth_identities_provider_identifier ON auth.identities USING btree (provider, provider_identifier);


--
-- Name: idx_auth_identities_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_identities_user_id ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_login_history_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_login_history_created_at ON auth.login_history USING btree (created_at);


--
-- Name: idx_auth_login_history_identifier; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_login_history_identifier ON auth.login_history USING btree (identifier);


--
-- Name: idx_auth_login_history_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_login_history_user_id ON auth.login_history USING btree (user_id);


--
-- Name: idx_auth_otp_expires; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_otp_expires ON auth.otp_requests USING btree (expires_at);


--
-- Name: idx_auth_otp_identifier; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_otp_identifier ON auth.otp_requests USING btree (identifier);


--
-- Name: idx_auth_security_events_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_security_events_created_at ON auth.security_events USING btree (created_at);


--
-- Name: idx_auth_security_events_type; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_security_events_type ON auth.security_events USING btree (event_type);


--
-- Name: idx_auth_security_events_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_security_events_user_id ON auth.security_events USING btree (user_id);


--
-- Name: idx_auth_sessions_expires_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_sessions_expires_at ON auth.sessions USING btree (expires_at);


--
-- Name: idx_auth_sessions_user_id; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_sessions_user_id ON auth.sessions USING btree (user_id);


--
-- Name: idx_auth_users_status; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_users_status ON auth.users USING btree (status);


--
-- Name: idx_chat_messages_conversation_created; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_chat_messages_conversation_created ON chat.chat_messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_chat_messages_itinerary; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_chat_messages_itinerary ON chat.chat_messages USING btree (itinerary_id) WHERE (itinerary_id IS NOT NULL);


--
-- Name: idx_chat_messages_reply_to; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_chat_messages_reply_to ON chat.chat_messages USING btree (reply_to_message_id) WHERE (reply_to_message_id IS NOT NULL);


--
-- Name: idx_chat_messages_sender; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_chat_messages_sender ON chat.chat_messages USING btree (sent_by);


--
-- Name: idx_chat_messages_type; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_chat_messages_type ON chat.chat_messages USING btree (message_type);


--
-- Name: idx_conversation_participants_active_user; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversation_participants_active_user ON chat.conversation_participants USING btree (user_id, conversation_id) WHERE (left_at IS NULL);


--
-- Name: idx_conversation_participants_conversation; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversation_participants_conversation ON chat.conversation_participants USING btree (conversation_id);


--
-- Name: idx_conversation_participants_last_read; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversation_participants_last_read ON chat.conversation_participants USING btree (last_read_message_id) WHERE (last_read_message_id IS NOT NULL);


--
-- Name: idx_conversation_participants_user; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversation_participants_user ON chat.conversation_participants USING btree (user_id);


--
-- Name: idx_conversations_created_at; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversations_created_at ON chat.conversations USING btree (created_at);


--
-- Name: idx_conversations_deleted_at; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversations_deleted_at ON chat.conversations USING btree (deleted_at);


--
-- Name: idx_conversations_last_message; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversations_last_message ON chat.conversations USING btree (last_message_id) WHERE (last_message_id IS NOT NULL);


--
-- Name: idx_conversations_type; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversations_type ON chat.conversations USING btree (conversation_type);


--
-- Name: idx_conversations_updated_at; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_conversations_updated_at ON chat.conversations USING btree (updated_at);


--
-- Name: idx_message_assets_asset; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_message_assets_asset ON chat.message_assets USING btree (asset_id);


--
-- Name: idx_message_assets_message_display; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_message_assets_message_display ON chat.message_assets USING btree (message_id, display_order);


--
-- Name: idx_message_mentions_message; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_message_mentions_message ON chat.message_mentions USING btree (message_id);


--
-- Name: idx_message_mentions_user; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_message_mentions_user ON chat.message_mentions USING btree (mentioned_user_id);


--
-- Name: idx_message_reactions_message; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_message_reactions_message ON chat.message_reactions USING btree (message_id);


--
-- Name: idx_message_reactions_message_reaction; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_message_reactions_message_reaction ON chat.message_reactions USING btree (message_id, reaction);


--
-- Name: idx_message_reactions_user; Type: INDEX; Schema: chat; Owner: -
--

CREATE INDEX idx_message_reactions_user ON chat.message_reactions USING btree (user_id);


--
-- Name: uq_conversations_direct_key; Type: INDEX; Schema: chat; Owner: -
--

CREATE UNIQUE INDEX uq_conversations_direct_key ON chat.conversations USING btree (direct_key) WHERE ((conversation_type)::text = 'direct'::text);


--
-- Name: idx_communities_created_at; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_communities_created_at ON community.communities USING btree (created_at);


--
-- Name: idx_communities_deleted_at; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_communities_deleted_at ON community.communities USING btree (deleted_at);


--
-- Name: idx_communities_icon_asset; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_communities_icon_asset ON community.communities USING btree (icon_asset_id);


--
-- Name: idx_communities_join_type; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_communities_join_type ON community.communities USING btree (join_type);


--
-- Name: idx_communities_owner; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_communities_owner ON community.communities USING btree (owner_id);


--
-- Name: idx_community_bans_banned_user; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_bans_banned_user ON community.community_bans USING btree (banned_user_id);


--
-- Name: idx_community_bans_community; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_bans_community ON community.community_bans USING btree (community_id);


--
-- Name: idx_community_bans_created_at; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_bans_created_at ON community.community_bans USING btree (created_at);


--
-- Name: idx_community_bans_user; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_bans_user ON community.community_bans USING btree (user_id);


--
-- Name: idx_community_member_request_community; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_member_request_community ON community.community_member_request USING btree (community_id);


--
-- Name: idx_community_member_request_created_at; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_member_request_created_at ON community.community_member_request USING btree (created_at);


--
-- Name: idx_community_member_request_request_by; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_member_request_request_by ON community.community_member_request USING btree (request_by);


--
-- Name: idx_community_member_request_reviewed_by; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_member_request_reviewed_by ON community.community_member_request USING btree (reviewed_by);


--
-- Name: idx_community_member_request_status; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_member_request_status ON community.community_member_request USING btree (status);


--
-- Name: idx_community_member_request_target_user; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_member_request_target_user ON community.community_member_request USING btree (target_user_id);


--
-- Name: idx_community_members_community; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_members_community ON community.community_members USING btree (community_id);


--
-- Name: idx_community_members_created_at; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_members_created_at ON community.community_members USING btree (created_at);


--
-- Name: idx_community_members_role; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_members_role ON community.community_members USING btree (role);


--
-- Name: idx_community_members_status; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_members_status ON community.community_members USING btree (status);


--
-- Name: idx_community_members_user; Type: INDEX; Schema: community; Owner: -
--

CREATE INDEX idx_community_members_user ON community.community_members USING btree (user_id);


--
-- Name: idx_comments_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_comments_created_at ON explore.comments USING btree (created_at);


--
-- Name: idx_comments_parent; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_comments_parent ON explore.comments USING btree (parent_comment_id);


--
-- Name: idx_comments_post; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_comments_post ON explore.comments USING btree (post_id);


--
-- Name: idx_comments_post_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_comments_post_created_at ON explore.comments USING btree (post_id, created_at);


--
-- Name: idx_comments_user; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_comments_user ON explore.comments USING btree (user_id);


--
-- Name: idx_post_assets_asset; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_assets_asset ON explore.post_assets USING btree (asset_id);


--
-- Name: idx_post_assets_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_assets_created_at ON explore.post_assets USING btree (created_at);


--
-- Name: idx_post_assets_post; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_assets_post ON explore.post_assets USING btree (post_id);


--
-- Name: idx_post_been_there_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_been_there_created_at ON explore.post_been_there USING btree (created_at);


--
-- Name: idx_post_been_there_post; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_been_there_post ON explore.post_been_there USING btree (post_id);


--
-- Name: idx_post_been_there_user; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_been_there_user ON explore.post_been_there USING btree (user_id);


--
-- Name: idx_post_itineraries_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_itineraries_created_at ON explore.post_itineraries USING btree (created_at);


--
-- Name: idx_post_itineraries_itinerary; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_itineraries_itinerary ON explore.post_itineraries USING btree (itinerary_id);


--
-- Name: idx_post_itineraries_post; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_itineraries_post ON explore.post_itineraries USING btree (post_id);


--
-- Name: idx_post_likes_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_likes_created_at ON explore.post_likes USING btree (created_at);


--
-- Name: idx_post_likes_post; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_likes_post ON explore.post_likes USING btree (post_id);


--
-- Name: idx_post_likes_user; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_likes_user ON explore.post_likes USING btree (user_id);


--
-- Name: idx_post_reshare_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_reshare_created_at ON explore.post_reshare USING btree (created_at);


--
-- Name: idx_post_reshare_post; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_reshare_post ON explore.post_reshare USING btree (post_id);


--
-- Name: idx_post_reshare_shared_post; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_reshare_shared_post ON explore.post_reshare USING btree (shared_post_id);


--
-- Name: idx_post_reshare_user; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_post_reshare_user ON explore.post_reshare USING btree (user_id);


--
-- Name: idx_posts_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_posts_created_at ON explore.posts USING btree (created_at);


--
-- Name: idx_posts_place; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_posts_place ON explore.posts USING btree (place_id);


--
-- Name: idx_posts_place_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_posts_place_created_at ON explore.posts USING btree (place_id, created_at DESC);


--
-- Name: idx_posts_post_type; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_posts_post_type ON explore.posts USING btree (post_type);


--
-- Name: idx_posts_user; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_posts_user ON explore.posts USING btree (user_id);


--
-- Name: idx_posts_user_created_at; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_posts_user_created_at ON explore.posts USING btree (user_id, created_at DESC);


--
-- Name: idx_posts_visibility; Type: INDEX; Schema: explore; Owner: -
--

CREATE INDEX idx_posts_visibility ON explore.posts USING btree (visibility);


--
-- Name: idx_group_invitations_expires_at; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_invitations_expires_at ON groups.group_invitations USING btree (expires_at);


--
-- Name: idx_group_invitations_group; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_invitations_group ON groups.group_invitations USING btree (group_id);


--
-- Name: idx_group_invitations_responded_at; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_invitations_responded_at ON groups.group_invitations USING btree (responded_at);


--
-- Name: idx_group_invitations_status; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_invitations_status ON groups.group_invitations USING btree (status);


--
-- Name: idx_group_invitations_user; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_invitations_user ON groups.group_invitations USING btree (invited_user_id);


--
-- Name: idx_group_members_group; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_members_group ON groups.group_members USING btree (group_id);


--
-- Name: idx_group_members_joined_at; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_members_joined_at ON groups.group_members USING btree (joined_at);


--
-- Name: idx_group_members_role; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_members_role ON groups.group_members USING btree (role);


--
-- Name: idx_group_members_user; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_group_members_user ON groups.group_members USING btree (user_id);


--
-- Name: idx_groups_cover_asset_id; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_groups_cover_asset_id ON groups.groups USING btree (cover_asset_id) WHERE (cover_asset_id IS NOT NULL);


--
-- Name: idx_groups_created_at; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_groups_created_at ON groups.groups USING btree (created_at);


--
-- Name: idx_groups_deleted_at; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_groups_deleted_at ON groups.groups USING btree (deleted_at);


--
-- Name: idx_groups_owner; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_groups_owner ON groups.groups USING btree (owner_id);


--
-- Name: idx_groups_status; Type: INDEX; Schema: groups; Owner: -
--

CREATE INDEX idx_groups_status ON groups.groups USING btree (status);


--
-- Name: idx_change_requests_created_at; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_change_requests_created_at ON itinerary.itinerary_change_requests USING btree (created_at);


--
-- Name: idx_change_requests_item; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_change_requests_item ON itinerary.itinerary_change_requests USING btree (itinerary_item_id);


--
-- Name: idx_change_requests_itinerary; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_change_requests_itinerary ON itinerary.itinerary_change_requests USING btree (itinerary_id);


--
-- Name: idx_change_requests_requested_by; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_change_requests_requested_by ON itinerary.itinerary_change_requests USING btree (requested_by);


--
-- Name: idx_change_requests_status; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_change_requests_status ON itinerary.itinerary_change_requests USING btree (status);


--
-- Name: idx_itineraries_ai_generated; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itineraries_ai_generated ON itinerary.itineraries USING btree (ai_generated);


--
-- Name: idx_itineraries_created_at; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itineraries_created_at ON itinerary.itineraries USING btree (created_at);


--
-- Name: idx_itineraries_created_by; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itineraries_created_by ON itinerary.itineraries USING btree (created_by);


--
-- Name: idx_itineraries_deleted_at; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itineraries_deleted_at ON itinerary.itineraries USING btree (deleted_at);


--
-- Name: idx_itineraries_start_date; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itineraries_start_date ON itinerary.itineraries USING btree (start_date);


--
-- Name: idx_itineraries_status; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itineraries_status ON itinerary.itineraries USING btree (trip_status);


--
-- Name: idx_itineraries_visibility; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itineraries_visibility ON itinerary.itineraries USING btree (visibility);


--
-- Name: idx_itinerary_forks_created_at; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_forks_created_at ON itinerary.itinerary_forks USING btree (created_at);


--
-- Name: idx_itinerary_forks_forked; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_forks_forked ON itinerary.itinerary_forks USING btree (forked_itinerary_id);


--
-- Name: idx_itinerary_forks_original; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_forks_original ON itinerary.itinerary_forks USING btree (original_itinerary_id);


--
-- Name: idx_itinerary_forks_user; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_forks_user ON itinerary.itinerary_forks USING btree (forked_by);


--
-- Name: idx_itinerary_items_activity_type; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_items_activity_type ON itinerary.itinerary_items USING btree (activity_type);


--
-- Name: idx_itinerary_items_cover_asset; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_items_cover_asset ON itinerary.itinerary_items USING btree (cover_asset_id);


--
-- Name: idx_itinerary_items_day; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_items_day ON itinerary.itinerary_items USING btree (itinerary_id, day_number);


--
-- Name: idx_itinerary_items_deleted_at; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_items_deleted_at ON itinerary.itinerary_items USING btree (deleted_at);


--
-- Name: idx_itinerary_items_itinerary; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_items_itinerary ON itinerary.itinerary_items USING btree (itinerary_id);


--
-- Name: idx_itinerary_items_poi; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_items_poi ON itinerary.itinerary_items USING btree (poi_id);


--
-- Name: idx_itinerary_items_status; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_items_status ON itinerary.itinerary_items USING btree (status);


--
-- Name: idx_itinerary_shares_active; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_shares_active ON itinerary.itinerary_shares USING btree (is_active);


--
-- Name: idx_itinerary_shares_created_by; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_shares_created_by ON itinerary.itinerary_shares USING btree (created_by);


--
-- Name: idx_itinerary_shares_expires_at; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_shares_expires_at ON itinerary.itinerary_shares USING btree (expires_at);


--
-- Name: idx_itinerary_shares_itinerary; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_shares_itinerary ON itinerary.itinerary_shares USING btree (itinerary_id);


--
-- Name: idx_itinerary_versions_created_at; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_versions_created_at ON itinerary.itinerary_versions USING btree (created_at);


--
-- Name: idx_itinerary_versions_created_by; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_versions_created_by ON itinerary.itinerary_versions USING btree (created_by);


--
-- Name: idx_itinerary_versions_generation_type; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_versions_generation_type ON itinerary.itinerary_versions USING btree (generation_type);


--
-- Name: idx_itinerary_versions_itinerary; Type: INDEX; Schema: itinerary; Owner: -
--

CREATE INDEX idx_itinerary_versions_itinerary ON itinerary.itinerary_versions USING btree (itinerary_id);


--
-- Name: idx_asset_usage_asset; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_usage_asset ON media.asset_usage USING btree (asset_id);


--
-- Name: idx_asset_usage_created_at; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_usage_created_at ON media.asset_usage USING btree (created_at);


--
-- Name: idx_asset_usage_display_order; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_usage_display_order ON media.asset_usage USING btree (display_order);


--
-- Name: idx_asset_usage_entity; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_usage_entity ON media.asset_usage USING btree (entity_type, entity_id);


--
-- Name: idx_asset_usage_role; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_usage_role ON media.asset_usage USING btree (asset_role);


--
-- Name: idx_asset_variants_asset; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_variants_asset ON media.asset_variants USING btree (asset_id);


--
-- Name: idx_asset_variants_dimensions; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_variants_dimensions ON media.asset_variants USING btree (width, height);


--
-- Name: idx_asset_variants_format; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_variants_format ON media.asset_variants USING btree (format);


--
-- Name: idx_asset_variants_name; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_variants_name ON media.asset_variants USING btree (variant_name);


--
-- Name: idx_asset_variants_quality; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_asset_variants_quality ON media.asset_variants USING btree (quality);


--
-- Name: idx_assets_created_at; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_assets_created_at ON media.assets USING btree (created_at);


--
-- Name: idx_assets_mime_type; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_assets_mime_type ON media.assets USING btree (mime_type);


--
-- Name: idx_assets_public; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_assets_public ON media.assets USING btree (is_public);


--
-- Name: idx_assets_storage_provider; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_assets_storage_provider ON media.assets USING btree (storage_provider);


--
-- Name: idx_assets_uploaded_by; Type: INDEX; Schema: media; Owner: -
--

CREATE INDEX idx_assets_uploaded_by ON media.assets USING btree (uploaded_by);


--
-- Name: idx_categories_created_at; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_categories_created_at ON poi.categories USING btree (created_at);


--
-- Name: idx_categories_icon_asset; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_categories_icon_asset ON poi.categories USING btree (icon_asset_id);


--
-- Name: idx_categories_is_active; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_categories_is_active ON poi.categories USING btree (is_active);


--
-- Name: idx_cities_coordinates; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_cities_coordinates ON poi.cities USING btree (latitude, longitude);


--
-- Name: idx_cities_country; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_cities_country ON poi.cities USING btree (country_id);


--
-- Name: idx_cities_created_at; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_cities_created_at ON poi.cities USING btree (created_at);


--
-- Name: idx_cities_is_active; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_cities_is_active ON poi.cities USING btree (is_active);


--
-- Name: idx_cities_name; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_cities_name ON poi.cities USING btree (name);


--
-- Name: idx_cities_region; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_cities_region ON poi.cities USING btree (region_id);


--
-- Name: idx_countries_created_at; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_countries_created_at ON poi.countries USING btree (created_at);


--
-- Name: idx_countries_currency; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_countries_currency ON poi.countries USING btree (currency_id);


--
-- Name: idx_countries_flag_asset; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_countries_flag_asset ON poi.countries USING btree (flag_asset_id);


--
-- Name: idx_countries_is_active; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_countries_is_active ON poi.countries USING btree (is_active);


--
-- Name: idx_countries_name; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_countries_name ON poi.countries USING btree (name);


--
-- Name: idx_currencies_name; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_currencies_name ON poi.currencies USING btree (name);


--
-- Name: idx_currencies_symbol; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_currencies_symbol ON poi.currencies USING btree (symbol);


--
-- Name: idx_places_category; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_category ON poi.places USING btree (category_id);


--
-- Name: idx_places_city; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_city ON poi.places USING btree (city_id);


--
-- Name: idx_places_closing_hour_gin; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_closing_hour_gin ON poi.places USING gin (closing_hour);


--
-- Name: idx_places_coordinates; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_coordinates ON poi.places USING btree (latitude, longitude);


--
-- Name: idx_places_country; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_country ON poi.places USING btree (country_id);


--
-- Name: idx_places_created_at; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_created_at ON poi.places USING btree (created_at);


--
-- Name: idx_places_is_closed; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_is_closed ON poi.places USING btree (is_closed);


--
-- Name: idx_places_is_verified; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_is_verified ON poi.places USING btree (is_verified);


--
-- Name: idx_places_itinerary_worthiness; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_itinerary_worthiness ON poi.places USING btree (itinerary_worthiness);


--
-- Name: idx_places_media; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_media ON poi.places USING btree (media_id);


--
-- Name: idx_places_name; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_name ON poi.places USING btree (name);


--
-- Name: idx_places_opening_hour_gin; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_opening_hour_gin ON poi.places USING gin (opening_hour);


--
-- Name: idx_places_rating; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_rating ON poi.places USING btree (rating);


--
-- Name: idx_places_region; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_region ON poi.places USING btree (region_id);


--
-- Name: idx_places_tags_category; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_tags_category ON poi.places_tags USING btree (category_id);


--
-- Name: idx_places_tags_created_at; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_tags_created_at ON poi.places_tags USING btree (created_at);


--
-- Name: idx_places_tags_icon_asset; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_tags_icon_asset ON poi.places_tags USING btree (icon_asset_id);


--
-- Name: idx_places_tags_tag_name; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_places_tags_tag_name ON poi.places_tags USING btree (tag_name);


--
-- Name: idx_regions_coordinates; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_regions_coordinates ON poi.regions USING btree (latitude, longitude);


--
-- Name: idx_regions_country; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_regions_country ON poi.regions USING btree (country_id);


--
-- Name: idx_regions_created_at; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_regions_created_at ON poi.regions USING btree (created_at);


--
-- Name: idx_regions_is_active; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_regions_is_active ON poi.regions USING btree (is_active);


--
-- Name: idx_regions_name; Type: INDEX; Schema: poi; Owner: -
--

CREATE INDEX idx_regions_name ON poi.regions USING btree (name);


--
-- Name: idx_trip_created_at; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_created_at ON trip.trips USING btree (created_at);


--
-- Name: idx_trip_documents_asset; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_documents_asset ON trip.trip_documents USING btree (asset_id);


--
-- Name: idx_trip_documents_deleted; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_documents_deleted ON trip.trip_documents USING btree (deleted_at);


--
-- Name: idx_trip_documents_document_type; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_documents_document_type ON trip.trip_documents USING btree (document_type);


--
-- Name: idx_trip_documents_expiry; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_documents_expiry ON trip.trip_documents USING btree (expiry_date);


--
-- Name: idx_trip_documents_owner; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_documents_owner ON trip.trip_documents USING btree (owner_id);


--
-- Name: idx_trip_documents_trip; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_documents_trip ON trip.trip_documents USING btree (trip_id);


--
-- Name: idx_trip_documents_visibility; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_documents_visibility ON trip.trip_documents USING btree (visibility);


--
-- Name: idx_trip_essentials_category; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_essentials_category ON trip.trip_essentials USING btree (category);


--
-- Name: idx_trip_essentials_completed; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_essentials_completed ON trip.trip_essentials USING btree (is_completed);


--
-- Name: idx_trip_essentials_created_at; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_essentials_created_at ON trip.trip_essentials USING btree (created_at);


--
-- Name: idx_trip_essentials_display_order; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_essentials_display_order ON trip.trip_essentials USING btree (display_order);


--
-- Name: idx_trip_essentials_owner; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_essentials_owner ON trip.trip_essentials USING btree (owner_id);


--
-- Name: idx_trip_essentials_trip; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_essentials_trip ON trip.trip_essentials USING btree (trip_id);


--
-- Name: idx_trip_expense_splits_created_at; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expense_splits_created_at ON trip.trip_expense_splits USING btree (created_at);


--
-- Name: idx_trip_expense_splits_status; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expense_splits_status ON trip.trip_expense_splits USING btree (settlement_status);


--
-- Name: idx_trip_expense_splits_user; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expense_splits_user ON trip.trip_expense_splits USING btree (user_id);


--
-- Name: idx_trip_expenses_category; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expenses_category ON trip.trip_expenses USING btree (expense_category);


--
-- Name: idx_trip_expenses_created_at; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expenses_created_at ON trip.trip_expenses USING btree (created_at);


--
-- Name: idx_trip_expenses_deleted; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expenses_deleted ON trip.trip_expenses USING btree (deleted_at);


--
-- Name: idx_trip_expenses_expense_date; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expenses_expense_date ON trip.trip_expenses USING btree (expense_date);


--
-- Name: idx_trip_expenses_paid_by; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expenses_paid_by ON trip.trip_expenses USING btree (paid_by);


--
-- Name: idx_trip_expenses_receipt; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expenses_receipt ON trip.trip_expenses USING btree (receipt_asset_id);


--
-- Name: idx_trip_expenses_trip; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_expenses_trip ON trip.trip_expenses USING btree (trip_id);


--
-- Name: idx_trip_status; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_status ON trip.trips USING btree (status);


--
-- Name: idx_trip_updated_at; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_updated_at ON trip.trips USING btree (updated_at);


--
-- Name: idx_trip_user; Type: INDEX; Schema: trip; Owner: -
--

CREATE INDEX idx_trip_user ON trip.trips USING btree (user_id);


--
-- Name: idx_blocked_users_blocked; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_blocked_users_blocked ON users.blocked_users USING btree (blocked_user_id);


--
-- Name: idx_blocked_users_user; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_blocked_users_user ON users.blocked_users USING btree (user_id);


--
-- Name: idx_profiles_city; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_profiles_city ON users.profiles USING btree (city_id);


--
-- Name: idx_profiles_country; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_profiles_country ON users.profiles USING btree (country_id);


--
-- Name: idx_profiles_deleted; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_profiles_deleted ON users.profiles USING btree (deleted_at);


--
-- Name: idx_profiles_verified; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_profiles_verified ON users.profiles USING btree (is_verified);


--
-- Name: idx_saved_items_created_at; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_saved_items_created_at ON users.saved_items USING btree (created_at);


--
-- Name: idx_saved_items_item; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_saved_items_item ON users.saved_items USING btree (item_id);


--
-- Name: idx_saved_items_type; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_saved_items_type ON users.saved_items USING btree (item_type);


--
-- Name: idx_saved_items_user; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_saved_items_user ON users.saved_items USING btree (user_id);


--
-- Name: idx_saved_items_user_type_created_id; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_saved_items_user_type_created_id ON users.saved_items USING btree (user_id, item_type, created_at DESC, id DESC);


--
-- Name: idx_users_preferences_updated_at; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_users_preferences_updated_at ON users.preferences USING btree (updated_at);


--
-- Name: idx_users_profiles_username; Type: INDEX; Schema: users; Owner: -
--

CREATE UNIQUE INDEX idx_users_profiles_username ON users.profiles USING btree (username);


--
-- Name: idx_users_settings_updated_at; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_users_settings_updated_at ON users.user_settings USING btree (updated_at);


--
-- Name: idx_visited_places_created_at; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_visited_places_created_at ON users.visited_places USING btree (created_at);


--
-- Name: idx_visited_places_place; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_visited_places_place ON users.visited_places USING btree (place_id);


--
-- Name: idx_visited_places_source; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_visited_places_source ON users.visited_places USING btree (visit_source);


--
-- Name: idx_visited_places_status; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_visited_places_status ON users.visited_places USING btree (verification_status);


--
-- Name: idx_visited_places_trip; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_visited_places_trip ON users.visited_places USING btree (trip_id);


--
-- Name: idx_visited_places_user; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_visited_places_user ON users.visited_places USING btree (user_id);


--
-- Name: idx_visited_places_user_visited_id; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_visited_places_user_visited_id ON users.visited_places USING btree (user_id, visited_at DESC, id DESC);


--
-- Name: idx_visited_places_visited_at; Type: INDEX; Schema: users; Owner: -
--

CREATE INDEX idx_visited_places_visited_at ON users.visited_places USING btree (visited_at);


--
-- Name: conversation_participants trg_conversation_participants_set_updated_at; Type: TRIGGER; Schema: chat; Owner: -
--

CREATE TRIGGER trg_conversation_participants_set_updated_at BEFORE UPDATE ON chat.conversation_participants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: conversations trg_conversations_set_updated_at; Type: TRIGGER; Schema: chat; Owner: -
--

CREATE TRIGGER trg_conversations_set_updated_at BEFORE UPDATE ON chat.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: communities trg_communities_set_updated_at; Type: TRIGGER; Schema: community; Owner: -
--

CREATE TRIGGER trg_communities_set_updated_at BEFORE UPDATE ON community.communities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: community_bans trg_community_bans_set_updated_at; Type: TRIGGER; Schema: community; Owner: -
--

CREATE TRIGGER trg_community_bans_set_updated_at BEFORE UPDATE ON community.community_bans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: community_member_request trg_community_member_request_set_updated_at; Type: TRIGGER; Schema: community; Owner: -
--

CREATE TRIGGER trg_community_member_request_set_updated_at BEFORE UPDATE ON community.community_member_request FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: community_members trg_community_members_set_updated_at; Type: TRIGGER; Schema: community; Owner: -
--

CREATE TRIGGER trg_community_members_set_updated_at BEFORE UPDATE ON community.community_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: comments trg_comments_set_updated_at; Type: TRIGGER; Schema: explore; Owner: -
--

CREATE TRIGGER trg_comments_set_updated_at BEFORE UPDATE ON explore.comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: posts trg_posts_set_updated_at; Type: TRIGGER; Schema: explore; Owner: -
--

CREATE TRIGGER trg_posts_set_updated_at BEFORE UPDATE ON explore.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: groups trg_groups_set_updated_at; Type: TRIGGER; Schema: groups; Owner: -
--

CREATE TRIGGER trg_groups_set_updated_at BEFORE UPDATE ON groups.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories trg_categories_set_updated_at; Type: TRIGGER; Schema: poi; Owner: -
--

CREATE TRIGGER trg_categories_set_updated_at BEFORE UPDATE ON poi.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cities trg_cities_set_updated_at; Type: TRIGGER; Schema: poi; Owner: -
--

CREATE TRIGGER trg_cities_set_updated_at BEFORE UPDATE ON poi.cities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: countries trg_countries_set_updated_at; Type: TRIGGER; Schema: poi; Owner: -
--

CREATE TRIGGER trg_countries_set_updated_at BEFORE UPDATE ON poi.countries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: currencies trg_currencies_set_updated_at; Type: TRIGGER; Schema: poi; Owner: -
--

CREATE TRIGGER trg_currencies_set_updated_at BEFORE UPDATE ON poi.currencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: places trg_places_set_updated_at; Type: TRIGGER; Schema: poi; Owner: -
--

CREATE TRIGGER trg_places_set_updated_at BEFORE UPDATE ON poi.places FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: places_tags trg_places_tags_set_updated_at; Type: TRIGGER; Schema: poi; Owner: -
--

CREATE TRIGGER trg_places_tags_set_updated_at BEFORE UPDATE ON poi.places_tags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: regions trg_regions_set_updated_at; Type: TRIGGER; Schema: poi; Owner: -
--

CREATE TRIGGER trg_regions_set_updated_at BEFORE UPDATE ON poi.regions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: trip_expense_splits trg_trip_expense_splits_set_updated_at; Type: TRIGGER; Schema: trip; Owner: -
--

CREATE TRIGGER trg_trip_expense_splits_set_updated_at BEFORE UPDATE ON trip.trip_expense_splits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_set_updated_at; Type: TRIGGER; Schema: users; Owner: -
--

CREATE TRIGGER trg_profiles_set_updated_at BEFORE UPDATE ON users.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: visited_places trg_visited_places_set_updated_at; Type: TRIGGER; Schema: users; Owner: -
--

CREATE TRIGGER trg_visited_places_set_updated_at BEFORE UPDATE ON users.visited_places FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: identities fk_auth_identities_user; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT fk_auth_identities_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: login_history fk_auth_login_history_user; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.login_history
    ADD CONSTRAINT fk_auth_login_history_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: security_events fk_auth_security_events_user; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.security_events
    ADD CONSTRAINT fk_auth_security_events_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: sessions fk_auth_sessions_user; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages fk_chat_messages_conversation; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.chat_messages
    ADD CONSTRAINT fk_chat_messages_conversation FOREIGN KEY (conversation_id) REFERENCES chat.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_messages fk_chat_messages_itinerary; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.chat_messages
    ADD CONSTRAINT fk_chat_messages_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE SET NULL;


--
-- Name: chat_messages fk_chat_messages_reply_to; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.chat_messages
    ADD CONSTRAINT fk_chat_messages_reply_to FOREIGN KEY (reply_to_message_id) REFERENCES chat.chat_messages(id) ON DELETE SET NULL;


--
-- Name: chat_messages fk_chat_messages_sender; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.chat_messages
    ADD CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sent_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: conversation_participants fk_conversation_participants_conversation; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.conversation_participants
    ADD CONSTRAINT fk_conversation_participants_conversation FOREIGN KEY (conversation_id) REFERENCES chat.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants fk_conversation_participants_last_read_message; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.conversation_participants
    ADD CONSTRAINT fk_conversation_participants_last_read_message FOREIGN KEY (last_read_message_id) REFERENCES chat.chat_messages(id) ON DELETE SET NULL;


--
-- Name: conversation_participants fk_conversation_participants_user; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.conversation_participants
    ADD CONSTRAINT fk_conversation_participants_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations fk_conversations_group; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.conversations
    ADD CONSTRAINT fk_conversations_group FOREIGN KEY (group_id) REFERENCES groups.groups(id) ON DELETE CASCADE;


--
-- Name: conversations fk_conversations_last_message; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.conversations
    ADD CONSTRAINT fk_conversations_last_message FOREIGN KEY (last_message_id) REFERENCES chat.chat_messages(id) ON DELETE SET NULL;


--
-- Name: message_assets fk_message_assets_asset; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_assets
    ADD CONSTRAINT fk_message_assets_asset FOREIGN KEY (asset_id) REFERENCES media.assets(id) ON DELETE RESTRICT;


--
-- Name: message_assets fk_message_assets_message; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_assets
    ADD CONSTRAINT fk_message_assets_message FOREIGN KEY (message_id) REFERENCES chat.chat_messages(id) ON DELETE CASCADE;


--
-- Name: message_mentions fk_message_mentions_message; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_mentions
    ADD CONSTRAINT fk_message_mentions_message FOREIGN KEY (message_id) REFERENCES chat.chat_messages(id) ON DELETE CASCADE;


--
-- Name: message_mentions fk_message_mentions_user; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_mentions
    ADD CONSTRAINT fk_message_mentions_user FOREIGN KEY (mentioned_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: message_reactions fk_message_reactions_message; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_reactions
    ADD CONSTRAINT fk_message_reactions_message FOREIGN KEY (message_id) REFERENCES chat.chat_messages(id) ON DELETE CASCADE;


--
-- Name: message_reactions fk_message_reactions_user; Type: FK CONSTRAINT; Schema: chat; Owner: -
--

ALTER TABLE ONLY chat.message_reactions
    ADD CONSTRAINT fk_message_reactions_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: communities fk_communities_icon_asset; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.communities
    ADD CONSTRAINT fk_communities_icon_asset FOREIGN KEY (icon_asset_id) REFERENCES media.assets(id) ON DELETE RESTRICT;


--
-- Name: communities fk_communities_owner; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.communities
    ADD CONSTRAINT fk_communities_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: community_bans fk_community_bans_banned_user; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_bans
    ADD CONSTRAINT fk_community_bans_banned_user FOREIGN KEY (banned_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: community_bans fk_community_bans_community; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_bans
    ADD CONSTRAINT fk_community_bans_community FOREIGN KEY (community_id) REFERENCES community.communities(id) ON DELETE CASCADE;


--
-- Name: community_bans fk_community_bans_user; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_bans
    ADD CONSTRAINT fk_community_bans_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: community_member_request fk_community_member_request_community; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_member_request
    ADD CONSTRAINT fk_community_member_request_community FOREIGN KEY (community_id) REFERENCES community.communities(id) ON DELETE CASCADE;


--
-- Name: community_member_request fk_community_member_request_request_by; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_member_request
    ADD CONSTRAINT fk_community_member_request_request_by FOREIGN KEY (request_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: community_member_request fk_community_member_request_reviewed_by; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_member_request
    ADD CONSTRAINT fk_community_member_request_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: community_member_request fk_community_member_request_target_user; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_member_request
    ADD CONSTRAINT fk_community_member_request_target_user FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: community_members fk_community_members_community; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_members
    ADD CONSTRAINT fk_community_members_community FOREIGN KEY (community_id) REFERENCES community.communities(id) ON DELETE CASCADE;


--
-- Name: community_members fk_community_members_user; Type: FK CONSTRAINT; Schema: community; Owner: -
--

ALTER TABLE ONLY community.community_members
    ADD CONSTRAINT fk_community_members_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comments fk_comments_parent; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.comments
    ADD CONSTRAINT fk_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES explore.comments(id) ON DELETE CASCADE;


--
-- Name: comments fk_comments_post; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.comments
    ADD CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES explore.posts(id) ON DELETE CASCADE;


--
-- Name: comments fk_comments_user; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.comments
    ADD CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: post_assets fk_post_assets_asset; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_assets
    ADD CONSTRAINT fk_post_assets_asset FOREIGN KEY (asset_id) REFERENCES media.assets(id) ON DELETE RESTRICT;


--
-- Name: post_assets fk_post_assets_post; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_assets
    ADD CONSTRAINT fk_post_assets_post FOREIGN KEY (post_id) REFERENCES explore.posts(id) ON DELETE CASCADE;


--
-- Name: post_been_there fk_post_been_there_post; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_been_there
    ADD CONSTRAINT fk_post_been_there_post FOREIGN KEY (post_id) REFERENCES explore.posts(id) ON DELETE CASCADE;


--
-- Name: post_been_there fk_post_been_there_user; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_been_there
    ADD CONSTRAINT fk_post_been_there_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: post_itineraries fk_post_itineraries_itinerary; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_itineraries
    ADD CONSTRAINT fk_post_itineraries_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE CASCADE;


--
-- Name: post_itineraries fk_post_itineraries_post; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_itineraries
    ADD CONSTRAINT fk_post_itineraries_post FOREIGN KEY (post_id) REFERENCES explore.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes fk_post_likes_post; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_likes
    ADD CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES explore.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes fk_post_likes_user; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_likes
    ADD CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: post_reshare fk_post_reshare_post; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_reshare
    ADD CONSTRAINT fk_post_reshare_post FOREIGN KEY (post_id) REFERENCES explore.posts(id) ON DELETE CASCADE;


--
-- Name: post_reshare fk_post_reshare_shared_post; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_reshare
    ADD CONSTRAINT fk_post_reshare_shared_post FOREIGN KEY (shared_post_id) REFERENCES explore.posts(id) ON DELETE CASCADE;


--
-- Name: post_reshare fk_post_reshare_user; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.post_reshare
    ADD CONSTRAINT fk_post_reshare_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: posts fk_posts_place; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.posts
    ADD CONSTRAINT fk_posts_place FOREIGN KEY (place_id) REFERENCES poi.places(id) ON DELETE RESTRICT;


--
-- Name: posts fk_posts_user; Type: FK CONSTRAINT; Schema: explore; Owner: -
--

ALTER TABLE ONLY explore.posts
    ADD CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: group_invitations fk_group_invitations_group; Type: FK CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.group_invitations
    ADD CONSTRAINT fk_group_invitations_group FOREIGN KEY (group_id) REFERENCES groups.groups(id) ON DELETE CASCADE;


--
-- Name: group_invitations fk_group_invited_by; Type: FK CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.group_invitations
    ADD CONSTRAINT fk_group_invited_by FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: group_invitations fk_group_invited_user; Type: FK CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.group_invitations
    ADD CONSTRAINT fk_group_invited_user FOREIGN KEY (invited_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: group_members fk_group_members_group; Type: FK CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.group_members
    ADD CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES groups.groups(id) ON DELETE CASCADE;


--
-- Name: group_members fk_group_members_user; Type: FK CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.group_members
    ADD CONSTRAINT fk_group_members_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: groups fk_groups_cover_asset; Type: FK CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.groups
    ADD CONSTRAINT fk_groups_cover_asset FOREIGN KEY (cover_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: groups fk_groups_itinerary; Type: FK CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.groups
    ADD CONSTRAINT fk_groups_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE SET NULL;


--
-- Name: groups fk_groups_owner; Type: FK CONSTRAINT; Schema: groups; Owner: -
--

ALTER TABLE ONLY groups.groups
    ADD CONSTRAINT fk_groups_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: itinerary_change_requests fk_change_request_item; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_change_requests
    ADD CONSTRAINT fk_change_request_item FOREIGN KEY (itinerary_item_id) REFERENCES itinerary.itinerary_items(id) ON DELETE CASCADE;


--
-- Name: itinerary_change_requests fk_change_request_itinerary; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_change_requests
    ADD CONSTRAINT fk_change_request_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE CASCADE;


--
-- Name: itinerary_change_requests fk_change_request_requested_by; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_change_requests
    ADD CONSTRAINT fk_change_request_requested_by FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: itinerary_change_requests fk_change_request_reviewed_by; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_change_requests
    ADD CONSTRAINT fk_change_request_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: itineraries fk_itineraries_cover_asset; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itineraries
    ADD CONSTRAINT fk_itineraries_cover_asset FOREIGN KEY (cover_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: itineraries fk_itineraries_created_by; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itineraries
    ADD CONSTRAINT fk_itineraries_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: itinerary_forks fk_itinerary_forks_forked; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_forks
    ADD CONSTRAINT fk_itinerary_forks_forked FOREIGN KEY (forked_itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE CASCADE;


--
-- Name: itinerary_forks fk_itinerary_forks_original; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_forks
    ADD CONSTRAINT fk_itinerary_forks_original FOREIGN KEY (original_itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE CASCADE;


--
-- Name: itinerary_forks fk_itinerary_forks_user; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_forks
    ADD CONSTRAINT fk_itinerary_forks_user FOREIGN KEY (forked_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: itinerary_items fk_itinerary_items_cover_asset; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_items
    ADD CONSTRAINT fk_itinerary_items_cover_asset FOREIGN KEY (cover_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: itinerary_items fk_itinerary_items_itinerary; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_items
    ADD CONSTRAINT fk_itinerary_items_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE CASCADE;


--
-- Name: itinerary_shares fk_itinerary_shares_created_by; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_shares
    ADD CONSTRAINT fk_itinerary_shares_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: itinerary_shares fk_itinerary_shares_itinerary; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_shares
    ADD CONSTRAINT fk_itinerary_shares_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE CASCADE;


--
-- Name: itinerary_versions fk_itinerary_versions_created_by; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_versions
    ADD CONSTRAINT fk_itinerary_versions_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: itinerary_versions fk_itinerary_versions_itinerary; Type: FK CONSTRAINT; Schema: itinerary; Owner: -
--

ALTER TABLE ONLY itinerary.itinerary_versions
    ADD CONSTRAINT fk_itinerary_versions_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE CASCADE;


--
-- Name: asset_usage fk_asset_usage_asset; Type: FK CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.asset_usage
    ADD CONSTRAINT fk_asset_usage_asset FOREIGN KEY (asset_id) REFERENCES media.assets(id) ON DELETE CASCADE;


--
-- Name: asset_variants fk_asset_variants_asset; Type: FK CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.asset_variants
    ADD CONSTRAINT fk_asset_variants_asset FOREIGN KEY (asset_id) REFERENCES media.assets(id) ON DELETE CASCADE;


--
-- Name: assets fk_assets_uploaded_by; Type: FK CONSTRAINT; Schema: media; Owner: -
--

ALTER TABLE ONLY media.assets
    ADD CONSTRAINT fk_assets_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: categories fk_categories_icon_asset; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.categories
    ADD CONSTRAINT fk_categories_icon_asset FOREIGN KEY (icon_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: cities fk_cities_country; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.cities
    ADD CONSTRAINT fk_cities_country FOREIGN KEY (country_id) REFERENCES poi.countries(id) ON DELETE RESTRICT;


--
-- Name: cities fk_cities_region; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.cities
    ADD CONSTRAINT fk_cities_region FOREIGN KEY (region_id) REFERENCES poi.regions(id) ON DELETE RESTRICT;


--
-- Name: countries fk_countries_currency; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.countries
    ADD CONSTRAINT fk_countries_currency FOREIGN KEY (currency_id) REFERENCES poi.currencies(id) ON DELETE SET NULL;


--
-- Name: countries fk_countries_flag_asset; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.countries
    ADD CONSTRAINT fk_countries_flag_asset FOREIGN KEY (flag_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: places fk_places_category; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places
    ADD CONSTRAINT fk_places_category FOREIGN KEY (category_id) REFERENCES poi.categories(id) ON DELETE RESTRICT;


--
-- Name: places fk_places_city; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places
    ADD CONSTRAINT fk_places_city FOREIGN KEY (city_id) REFERENCES poi.cities(id) ON DELETE RESTRICT;


--
-- Name: places fk_places_country; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places
    ADD CONSTRAINT fk_places_country FOREIGN KEY (country_id) REFERENCES poi.countries(id) ON DELETE RESTRICT;


--
-- Name: places fk_places_media; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places
    ADD CONSTRAINT fk_places_media FOREIGN KEY (media_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: places fk_places_region; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places
    ADD CONSTRAINT fk_places_region FOREIGN KEY (region_id) REFERENCES poi.regions(id) ON DELETE RESTRICT;


--
-- Name: places_tags fk_places_tags_category; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places_tags
    ADD CONSTRAINT fk_places_tags_category FOREIGN KEY (category_id) REFERENCES poi.categories(id) ON DELETE RESTRICT;


--
-- Name: places_tags fk_places_tags_icon_asset; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.places_tags
    ADD CONSTRAINT fk_places_tags_icon_asset FOREIGN KEY (icon_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: regions fk_regions_country; Type: FK CONSTRAINT; Schema: poi; Owner: -
--

ALTER TABLE ONLY poi.regions
    ADD CONSTRAINT fk_regions_country FOREIGN KEY (country_id) REFERENCES poi.countries(id) ON DELETE RESTRICT;


--
-- Name: trip_documents fk_trip_documents_asset; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_documents
    ADD CONSTRAINT fk_trip_documents_asset FOREIGN KEY (asset_id) REFERENCES media.assets(id) ON DELETE CASCADE;


--
-- Name: trip_documents fk_trip_documents_owner; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_documents
    ADD CONSTRAINT fk_trip_documents_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trip_documents fk_trip_documents_trip; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_documents
    ADD CONSTRAINT fk_trip_documents_trip FOREIGN KEY (trip_id) REFERENCES trip.trips(id) ON DELETE CASCADE;


--
-- Name: trip_essentials fk_trip_essentials_owner; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_essentials
    ADD CONSTRAINT fk_trip_essentials_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trip_essentials fk_trip_essentials_trip; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_essentials
    ADD CONSTRAINT fk_trip_essentials_trip FOREIGN KEY (trip_id) REFERENCES trip.trips(id) ON DELETE CASCADE;


--
-- Name: trip_expense_splits fk_trip_expense_splits_expense; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_expense_splits
    ADD CONSTRAINT fk_trip_expense_splits_expense FOREIGN KEY (expense_id) REFERENCES trip.trip_expenses(id) ON DELETE CASCADE;


--
-- Name: trip_expense_splits fk_trip_expense_splits_user; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_expense_splits
    ADD CONSTRAINT fk_trip_expense_splits_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: trip_expenses fk_trip_expenses_paid_by; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_expenses
    ADD CONSTRAINT fk_trip_expenses_paid_by FOREIGN KEY (paid_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: trip_expenses fk_trip_expenses_receipt; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_expenses
    ADD CONSTRAINT fk_trip_expenses_receipt FOREIGN KEY (receipt_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: trip_expenses fk_trip_expenses_trip; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trip_expenses
    ADD CONSTRAINT fk_trip_expenses_trip FOREIGN KEY (trip_id) REFERENCES trip.trips(id) ON DELETE CASCADE;


--
-- Name: trips fk_trip_itinerary; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trips
    ADD CONSTRAINT fk_trip_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary.itineraries(id) ON DELETE CASCADE;


--
-- Name: trips fk_trip_user; Type: FK CONSTRAINT; Schema: trip; Owner: -
--

ALTER TABLE ONLY trip.trips
    ADD CONSTRAINT fk_trip_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blocked_users fk_blocked_users_blocked_user; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.blocked_users
    ADD CONSTRAINT fk_blocked_users_blocked_user FOREIGN KEY (blocked_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blocked_users fk_blocked_users_user; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.blocked_users
    ADD CONSTRAINT fk_blocked_users_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles fk_profiles_city; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.profiles
    ADD CONSTRAINT fk_profiles_city FOREIGN KEY (city_id) REFERENCES poi.cities(id) ON DELETE SET NULL;


--
-- Name: profiles fk_profiles_country; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.profiles
    ADD CONSTRAINT fk_profiles_country FOREIGN KEY (country_id) REFERENCES poi.countries(id) ON DELETE SET NULL;


--
-- Name: profiles fk_profiles_cover_photo; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.profiles
    ADD CONSTRAINT fk_profiles_cover_photo FOREIGN KEY (cover_photo_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: profiles fk_profiles_profile_photo; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.profiles
    ADD CONSTRAINT fk_profiles_profile_photo FOREIGN KEY (profile_photo_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: saved_items fk_saved_items_user; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.saved_items
    ADD CONSTRAINT fk_saved_items_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: preferences fk_users_preferences_user; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.preferences
    ADD CONSTRAINT fk_users_preferences_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles fk_users_profiles_user; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.profiles
    ADD CONSTRAINT fk_users_profiles_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_settings fk_users_settings_user; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.user_settings
    ADD CONSTRAINT fk_users_settings_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: visited_places fk_visited_places_asset; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.visited_places
    ADD CONSTRAINT fk_visited_places_asset FOREIGN KEY (verification_asset_id) REFERENCES media.assets(id) ON DELETE SET NULL;


--
-- Name: visited_places fk_visited_places_place; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.visited_places
    ADD CONSTRAINT fk_visited_places_place FOREIGN KEY (place_id) REFERENCES poi.places(id) ON DELETE RESTRICT;


--
-- Name: visited_places fk_visited_places_trip; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.visited_places
    ADD CONSTRAINT fk_visited_places_trip FOREIGN KEY (trip_id) REFERENCES trip.trips(id) ON DELETE SET NULL;


--
-- Name: visited_places fk_visited_places_user; Type: FK CONSTRAINT; Schema: users; Owner: -
--

ALTER TABLE ONLY users.visited_places
    ADD CONSTRAINT fk_visited_places_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict BIISmqMuYspWOtSTNbcIpzkDjfC4Eb8WTBqu0BrtlFZaS0ZvInlNqwD0AYbikCo

