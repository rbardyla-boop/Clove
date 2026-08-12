# DS-I4 CI notification control

The red-first development workflow initially ran on every push to the DS-I4 branch. Because connector writes create several small commits, that produced excessive GitHub Actions completion notifications.

Repair before the PR gate:
- retain the already-recorded intentional red baseline;
- remove the DS-I4 branch `push` trigger;
- run the permanent verifier on `pull_request` and `workflow_dispatch` only;
- keep `concurrency.cancel-in-progress: true`;
- upgrade `actions/checkout` and `actions/setup-node` from v4 to v6, whose action runtime uses Node 24;
- keep the tested project runtime at Node 22;
- disable automatic package-manager caching for this verification workflow.

This is CI/process hardening only. It does not change DS-I4 product behavior or public-release scope.
