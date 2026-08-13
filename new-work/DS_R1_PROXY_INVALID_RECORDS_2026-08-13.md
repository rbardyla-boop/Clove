# DS-R1 invalid proxy attempts

These records were not scored and remain in the audit trail. They were invalidated for protocol reasons, not for their behavioral results.

1. Initial P01: read `/home/thebackhand/.codex/skills/verification-grinder/SKILL.md` outside the packet.
2. First P01 replacement: stated that default login-shell startup-file access outside the packet could not be ruled out.

A final P01 replacement was run with an explicit `login:false` constraint and produced the sealed protocol-clean P01 record. No result was selected on outcome; the earlier attempts were invalidated solely under the packet-integrity rule.
