# DS-I2 Repair Note

The first clean local/browser replay identified one test-harness wording defect, not a product defect: the recovery-uncertain completion copy says “nothing critical was moved,” while the assertion accepted only the equivalent phrase “no critical account was moved.”

The assertion was widened to accept both equivalent no-migration phrasings. No privacy, migration, account, recovery, state-machine, or product-safety rule was weakened.

The branch must still pass the full DS-I2 verifier plus DS-I0/DS-I1 regressions before merge.
