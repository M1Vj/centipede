# Supabase SQL Snippets

This directory contains clean, human-readable SQL artifacts extracted from the latest applied migrations.

Migrations in supabase/migrations are append-only and remain the source of truth.
Snippets here are for readability, review, and reuse only.

## Conventions

- Keep snippets transaction-free (no BEGIN/COMMIT wrappers).
- Keep function snippets complete (CREATE OR REPLACE plus REVOKE/GRANT).
- Update snippets whenever a later migration changes function behavior.

## Current Canonical Sources

- functions/approve_and_provision_organizer_application.sql
  - Source migration: 20260405160000_fix_approve_and_provision_use_column.sql
- functions/anonymize_user_account.sql
  - Source migration: 20260404100000_fix_anonymize_user_digest_qualification.sql

## Update Workflow

1. Add the migration first.
2. Copy the final function definition into the matching snippet file.
3. Remove transaction wrappers.
4. Keep grants/revokes aligned with the latest migration state.
5. Update source migration references in this README.
