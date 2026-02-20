# How to create GitHub Release v4.5.0

## 1. Commit and push

```bash
git add package.json CHANGELOG.md RELEASE_v4.5.0.md docs/
git commit -m "chore: release v4.5.0 — First AI-Agentic Code Auditor"
git push origin main
```

## 2. Create tag and push

```bash
git tag -a v4.5.0 -m "LegacyLens v4.5.0 — First AI-Agentic Code Auditor. We don't just chat, we analyze, clean, and verify."
git push origin v4.5.0
```

## 3. Create release on GitHub

1. Go to: **https://github.com/Eugen1189/lens/releases/new**
2. **Choose tag:** `v4.5.0`
3. **Release title:**  
   `LegacyLens v4.5.0 — First AI-Agentic Code Auditor`
4. **Description:** paste the contents of **RELEASE_v4.5.0.md** (from the repo root).
5. Click **Publish release**.

## 4. (Optional) Publish to npm

```bash
npm publish
```

---

**Short description** (for release summary / social):

> LegacyLens v4.5.0 — First AI-Agentic Code Auditor. We don't just chat, we analyze, clean, and verify.
