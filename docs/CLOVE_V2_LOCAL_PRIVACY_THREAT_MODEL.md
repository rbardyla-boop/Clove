# CloveLearn v2 — Mission Local Privacy Threat Model

Status: **F1.1 / PILOT HARDENING**  
Applies to: Mission 001 private mission state and debrief records

## Decision

Mission 001 private text will be encrypted at rest in the browser before an adults-only pilot.

The implementation uses:

- Web Crypto AES-GCM, 256-bit key;
- a non-extractable `CryptoKey` stored in IndexedDB;
- a fresh 96-bit IV for every write;
- ciphertext stored in localStorage under the existing Mission 001 key;
- one-time migration of the current plaintext JSON value if present;
- fail-closed persistence if the vault cannot initialize.

No mission/debrief content is sent to Clove Insights.

## Threats this is intended to reduce

### T1 — casual localStorage inspection

Someone inspecting only the localStorage database should not see the user's mission/debrief text in plaintext.

### T2 — copied/localStorage-only browser artifacts

A copied localStorage value without the corresponding IndexedDB key should not reveal mission/debrief text.

### T3 — accidental logging or developer inspection of the storage value

The stored value should be ciphertext rather than readable JSON.

## Threats this does NOT solve

### N1 — malicious JavaScript running under the Clove origin

Code executing with the same origin can call the application's decrypt function or observe plaintext while the app is using it. Content Security Policy and supply-chain discipline remain separate obligations.

### N2 — a compromised or unlocked user device/browser profile

A person with sufficient control of the active browser profile may be able to execute code, inspect memory, or use the live application to decrypt records.

### N3 — screenshots, clipboard, shoulder-surfing, or user disclosure

Encryption at rest cannot protect text while it is displayed or copied by the user.

### N4 — device backup containing both storage systems

If an attacker obtains both the ciphertext and the IndexedDB key in a usable browser context, this mechanism may not provide meaningful protection.

### N5 — server collection

This mechanism is not a substitute for the aggregate Insights privacy contract. The stronger rule remains: private mission/debrief text is not transmitted to Insights at all.

## Failure behavior

The private store must not silently downgrade to plaintext.

If IndexedDB/Web Crypto initialization or encryption fails:

- Mission 001 may remain usable only until the user attempts to persist a mission;
- the save operation must fail visibly;
- no plaintext mission/debrief JSON may be written as fallback.

If the IndexedDB key is cleared while ciphertext remains, old encrypted records are intentionally unrecoverable. The application may offer a clear/restart path later; it must not silently delete the ciphertext during a failed decrypt.

## Migration boundary

The current F1 candidate may contain plaintext JSON at `clove_v2_mission_001` from local testing.

On first successful vault read:

1. detect legacy JSON rather than the encrypted envelope;
2. parse it with prototype-pollution-sensitive keys removed;
3. encrypt the parsed value;
4. write the encrypted envelope;
5. return the parsed value to the user.

If encryption fails, retain the original legacy value and surface an error; do not destroy data and do not claim migration succeeded.

## Claim allowed after verification

> Mission and debrief text is encrypted locally in this browser and is not included in Clove's aggregate Insights events.

## Claims not allowed

- “zero-access encryption”;
- “military-grade security”;
- “unhackable”;
- “private even if your device is compromised”;
- “end-to-end encrypted” (there is no communication endpoint in this local-state path);
- “anonymous” as a blanket statement.

## Verification gate

Before this decision is accepted:

- round-trip encrypted set/get;
- ciphertext-at-rest assertion (private marker absent from localStorage);
- fresh IV produces different ciphertext for repeated identical writes;
- plaintext legacy migration;
- missing-key/decrypt failure does not delete ciphertext;
- Mission 001 DONE / PARTLY / FAILED / DID NOT START browser paths replay against the encrypted store;
- Insights private-marker non-leak replay remains green.
