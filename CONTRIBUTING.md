# 🤝 Contributing to CABSSA Clubdesk

Thank you for your interest in contributing to **CABSSA Clubdesk**! This document provides guidelines and workflows for developing, testing, and submitting contributions to the project.

---

## 🏛️ Code of Conduct

We are dedicated to providing a collaborative, professional, and welcoming environment for all members of the **Computer Science & Business Systems Association (CABSSA)** and the open-source community.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Git**: Installed and configured on your machine
- **Modern Web Browser**: Chrome, Edge, Safari, or Firefox

### 2. Fork and Clone
```bash
# Clone the repository
git clone https://github.com/mrdineshausaramal-maker/CABSSA-ClubDesk.git

# Navigate into the project folder
cd CABSSA-ClubDesk
```

### 3. Running Locally
CABSSA Clubdesk is built with **zero external npm dependencies** for maximum performance and security:
```bash
# Start the full-stack engine
node server.js
```
Open **`http://localhost:3000`** in your browser to access the local instance.

---

## 🌿 Branching Strategy

1. Create a descriptive feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or for bug fixes:
   git checkout -b fix/issue-description
   ```
2. Commit your changes with clear, semantic commit messages:
   ```bash
   git commit -m "feat(attendance): add audio chime on successful QR scan"
   git commit -m "fix(mom): prevent duplicate attendee selections"
   ```
3. Push your branch to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a **Pull Request (PR)** against `main` with a clear explanation of changes and verification steps.

---

## 📐 Architecture & Coding Standards

- **Zero NPM Dependencies**: The server runs exclusively on Node.js core modules (`http`, `fs`, `path`, `crypto`). Do not add external runtime npm packages unless explicitly approved.
- **Frontend Modularity**: Keep modules scoped inside `js/modules/` with the IIFE pattern to avoid polluting the global namespace.
- **Strict Linting & Clean Code**: Use ES6+ modern JavaScript, maintain clean indentations, and document complex logic with comments.
- **Asset Generation**: Whenever updating `index.html` or files in `js/`, run `node scripts/generate-assets.js` to synchronize the serverless embedded bundle and the `public/` directory.

---

## 🛡️ Security & Privacy

If you discover a security vulnerability or sensitive data leak:
- **Do NOT** open a public issue.
- Report it directly to the Lead Administrator at `mr.dineshausaramal@gmail.com`.
