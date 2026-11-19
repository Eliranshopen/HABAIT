
## 2026-11-08 · main session · GitHub remote: private Eliranshopen/HABAIT, media-free snapshot
- **Did:** Eliran 2026-11-08 ruled a GitHub upload of the whole project without media to his gmail account (= GitHub login Eliranshopen, his word). Pushed a no-history snapshot of main@8864cbf as commit 444c5b2 to private repo Eliranshopen/HABAIT: 2702 files, 833 media files left out, secret scan 0 hits over 15 patterns. Local remote name: github. Local main untouched.
- **Evidence:** `.git/config`
- **Learned:** Replaces the 2026-11-04 'no remote, no push, never the gmail' ruling for this one repo. Filter media with core.quotepath=false: a Hebrew-named PDF slipped through a quoted ls-tree path on the first try (repo habait-rnd, superseded). Push uses -c credential.helper='!gh auth git-credential', no global config change.
- **Owed / open:** Eliran: delete the superseded private repo Eliranshopen/habait-rnd (has one 183KB PDF), or say keep. Future syncs = a new snapshot commit on top of 444c5b2, only on Eliran's word.
- **Second reader:** `habait-deploy-qa`

- **Correction (2026-11-08, same day):** HABAIT was created private; Eliran set it **PUBLIC** himself ("בסדר שהוא PUBLIC אני הגדרתי אותו ככה"). Every future sync is a public publish — secret-scan before each push.
