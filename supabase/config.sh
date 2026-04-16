#!/usr/bin/env bash
# Supabase project config for cavestack telemetry
# These are PUBLIC keys — safe to commit (like Firebase public config).
# RLS denies all access to the anon key. All reads and writes go through
# edge functions (which use SUPABASE_SERVICE_ROLE_KEY server-side).

CAVESTACK_SUPABASE_URL="https://frugpmstpnojnhfyimgv.supabase.co"
CAVESTACK_SUPABASE_ANON_KEY="sb_publishable_tR4i6cyMIrYTE3s6OyHGHw_ppx2p6WK"
