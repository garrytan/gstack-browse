# Solana Specialist Review Checklist

Scope: When STACK contains "rust" AND (project contains Anchor.toml OR Cargo.toml references anchor-lang, solana-program, solana-sdk, or pinocchio)
Output: JSON objects, one finding per line. Schema:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"solana","summary":"...","fix":"...","fingerprint":"path:line:solana","specialist":"solana"}
If no findings: output `NO FINDINGS` and nothing else.

---

This specialist targets Solana/Sealevel runtime vulnerabilities. The generic security specialist already covers auth, injection, and crypto misuse. This specialist covers what the Sealevel execution model makes uniquely dangerous: account validation failures, PDA collisions, CPI reentrancy, and arithmetic bugs that drain funds.

## Categories

### Missing Signer Verification
- Instruction handler accepts an authority/admin/payer account without `Signer` type (Anchor) or `is_signer` check (native)
- PDA-gated operations where the PDA seeds are not fully validated against the expected derivation
- Admin-only functions (pause, withdraw, set_fee) callable by any wallet because the signer constraint is missing
- `invoke_signed` calls where seeds are constructed from unvalidated user input

### PDA Seed Safety
- PDA seeds without sufficient entropy — missing user pubkey, mint address, or unique identifier allows seed collision between logically distinct accounts
- Seeds using mutable identifiers (username, email) instead of immutable ones (pubkey) — renaming creates a new PDA, orphaning the old one
- Missing canonical bump storage — re-deriving with `find_program_address` on every call wastes ~3000 CU, and trusting a client-supplied bump without re-derivation enables bump grinding
- Two different account types derived from identical seeds — type cosplay via PDA collision

### Account Ownership & Type Validation
- `AccountInfo` used directly without owner check — Anchor's `Account<'info, T>` validates owner automatically, but native programs must check `account.owner == expected_program_id`
- Missing `has_one` or `constraint` checks on related accounts — user passes a token account belonging to someone else
- Token accounts not validated for correct mint and authority — user passes a token account with a different mint to manipulate balances
- System program, token program, rent sysvar passed without program ID validation in native programs
- Discriminator not checked in native programs — attacker passes an account of type A where type B is expected (type cosplay)
- Token-2022 program ID confusion — passing TOKEN_PROGRAM_ID where TOKEN_2022_PROGRAM_ID is expected or vice versa, causing silent failures or bypassing transfer hooks

### Arithmetic Safety
- Arithmetic on token amounts (`+ - * /`) without `checked_add`, `checked_sub`, `checked_mul`, `checked_div` — Rust release mode wraps on overflow silently
- Division before multiplication causing precision loss in fee or reward calculations (`amount / total * rate` loses the remainder)
- Integer truncation casting `u64` to `u32` or `i64` to `u64` — negative values become huge positive values, amounts get truncated
- Missing overflow protection on lamport arithmetic — adding to a balance that already approaches `u64::MAX`
- Using `as` casts instead of `try_into()` for numeric conversions between different-width types
- Fee calculations that truncate to zero for small amounts — `amount * fee_bps / 10000` where amount is small enough that the result rounds to 0

### CPI Security
- CPI to an unvalidated program — `invoke` or `invoke_signed` where the target program ID comes from an account field instead of a known constant
- `invoke_signed` with seeds that don't match the PDA derivation — attacker supplies wrong accounts and the signing PDA doesn't match
- PDA signing authority granted over more scope than necessary — a vault PDA that signs for all operations when separate PDAs per operation would limit blast radius
- CPI call followed by mutable state read without re-validation — the called program may have modified shared account state
- Missing program ID check on CPI target: Anchor `Program<'info, T>` validates, but native programs must compare `program_id` field before `invoke`

### Reinitialization & State Corruption
- Account can be initialized multiple times — missing `is_initialized` flag (native) or `init` already used but account can be closed and re-created
- Close/reopen attack: account is closed (lamports drained, data zeroed), then re-created in the same transaction to reset state while keeping a stale reference
- State machine transitions without validation — e.g., an escrow can go from `Finalized` back to `Pending` because the handler doesn't check current state
- Discriminator overwrite in native programs: writing raw bytes to offset 0 can change the account's logical type

### Rent & Lamport Drain
- Account close sends rent-exempt lamports to an unvalidated recipient — attacker substitutes their own address as the `close` target
- Operations that leave an account below the rent-exempt threshold — account gets garbage collected by the runtime, destroying user data
- Missing refund logic on account closure — lamports stay locked in a PDA that nobody can close
- Lamport accounting that doesn't balance: sum of lamport increases across all accounts in an instruction must equal sum of decreases (runtime enforces per-instruction, but logical bugs can still cause unintended transfers)

### DeFi-Specific Patterns
- Oracle price used without staleness check — Pyth `price.publish_time` or Switchboard `latestTimestamp` not compared against `Clock::get().unix_timestamp`
- Single oracle source with no fallback — oracle downtime halts the protocol
- Price manipulation via flash loan: balance or reserve used for pricing is read in the same transaction that modifies it
- Missing slippage protection on swaps: no `minimum_amount_out` parameter, user gets sandwiched
- AMM constant-product invariant `k = x * y` not verified after swap — rounding can slowly drain the pool
- Liquidation threshold checked with stale price, allowing bad debt accumulation before oracle updates
- Missing oracle confidence interval check — Pyth `conf` not validated, accepting wildly uncertain prices

### Token-2022 Extension Patterns
- Transfer hook not accounted for — CPI token transfer to a Token-2022 mint that has a TransferHook extension but the hook program is not included in remaining accounts
- Transfer fee not deducted — calculating output amounts without subtracting the TransferFee extension's fee, causing accounting mismatches in vault/pool logic
- Permanent delegate abuse — accepting Token-2022 tokens with PermanentDelegate extension without understanding that the delegate can transfer/burn any holder's tokens at any time
- Non-transferable token forced transfer — attempting to CPI transfer a token with NonTransferable extension, which will fail and revert the entire transaction
- Program expecting TOKEN_PROGRAM_ID but receiving TOKEN_2022_PROGRAM_ID — token accounts owned by the wrong program bypass validation
- Confidential transfer balance mismatch — reading the public balance when the actual balance includes pending confidential transfers
