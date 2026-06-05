# WenYin / ChiCrypt

<p align="center">
  English | <a href="./README.md">简体中文</a>
</p>

**WenYin / ChiCrypt** is an open-source, local-first Chinese text steganography and authenticated encryption project.

It encrypts plaintext locally in the browser, then encodes the encrypted payload into reversible Chinese cover text. The project is designed for cryptography education, Chinese text steganography research, local-first privacy UX experiments, and open-source exploration of human-readable ciphertext representation.

> WenYin means “hidden in writing” in Chinese.

## Online Demo

Demo: https://chinesewenyin.pages.dev

## What It Does

WenYin turns a plaintext message and passphrase into a piece of Chinese-looking text. The generated cover text can later be decoded and decrypted with the same passphrase and compatible dictionary rules.

Basic workflow:

```text
Plaintext + Passphrase
        ↓
Unicode NFKC normalization
        ↓
Argon2id key derivation
        ↓
XChaCha20-Poly1305 authenticated encryption
        ↓
Encrypted binary payload
        ↓
Chinese cover-text encoder
        ↓
Reversible Chinese cover text
```

The Chinese cover text is not random decoration. It is a reversible encoding layer for the encrypted payload. However, it is **not** an additional cryptographic security boundary; the actual confidentiality and integrity protection comes from the underlying authenticated encryption.

## Key Features

- **Chinese-to-Chinese representation**: encrypted data is represented as Chinese-looking text instead of Base64, binary data, or unreadable random characters.
- **Local-first**: encryption and decryption run in the browser.
- **No backend required**: no server, database, login system, or Docker service is required.
- **No server-side plaintext processing**: plaintext, passphrases, encrypted payloads, and decrypted results stay on the local device.
- **Authenticated encryption**: uses Argon2id for key derivation and XChaCha20-Poly1305 for authenticated encryption.
- **Multiple cover styles**: currently supports daily text, chat-like text, fiction-like text, and classical-style Chinese.
- **Reversible cover-text encoding**: generated Chinese cover text can be decoded back into the encrypted payload.
- **Static deployment friendly**: the project can be deployed as static files after build.
- **Open-source and educational**: intended for learning, research, review, and transparent implementation.

## Project Goals

This project explores the intersection of:

- Chinese text steganography
- Local-first privacy tools
- Authenticated encryption
- Unicode normalization
- Browser-based cryptographic UX
- Chinese NLP and cover-text generation
- Reversible natural-language-like encoding
- Human-readable ciphertext representation

The goal is not to replace audited secure messengers or mature encryption tools. Instead, WenYin provides a transparent, inspectable, and educational implementation for Chinese-speaking developers, students, and researchers.

## Intended Use

WenYin is intended for:

- Cryptography education
- Chinese text steganography research
- Local-first privacy UX experiments
- Browser-based cryptographic engineering practice
- Demonstrating reversible cover-text encoding
- Learning how authenticated encryption can be integrated into frontend applications
- Exploring how encrypted data can be represented as Chinese-looking text
- Building open-source examples around Unicode normalization, dictionary versioning, and payload compatibility

## Not Intended For

This project is **not** intended for:

- Illegal activity
- Evading law enforcement
- Bypassing platform moderation or safety systems
- Replacing audited secure messengers
- High-risk political, military, or criminal communication
- Hiding malware, phishing content, fraud, or harmful instructions
- Coordinating abuse, harassment, scams, cyberattacks, or other harmful activities

Please use this project responsibly and comply with applicable laws, regulations, and platform rules.

## Security Model

WenYin currently follows a local-first model:

- Plaintext is processed locally in the browser.
- The passphrase is trimmed and normalized before key derivation.
- The passphrase is used to derive an encryption key through Argon2id.
- The plaintext is encrypted with XChaCha20-Poly1305 authenticated encryption.
- The encrypted binary payload is encoded into Chinese cover text.
- Decryption requires the correct passphrase and compatible cover dictionary or encoding rules.

Important limitations:

- Cover text is an encoding layer, not a cryptographic security boundary.
- A weak passphrase can still be guessed through offline attacks.
- Time-lock behavior is based on local device time and should not be treated as a strong security primitive.
- Local cooldown behavior only affects the current device and does not prevent offline guessing.
- Honey text is not formal Honey Encryption and does not replace strong passphrases.
- Device compromise, malicious browser extensions, clipboard leakage, screenshots, keyloggers, and compromised operating systems are out of scope.
- Metadata such as message length, timing, sharing context, and usage patterns may still leak information.
- This project has not received a professional third-party security audit.

For high-risk use cases, please use mature and audited tools such as Signal, age, GPG, or other well-reviewed security software.

## Cover Text and Compatibility

The generated Chinese cover text is a payload representation layer. It must remain decodable.

After generating cover text, users should not manually rewrite it, delete characters, change punctuation, modify spaces inside encoded phrases, or polish the text with another tool. Any change may corrupt the encoded payload and cause decryption failure.

Dictionary and template compatibility is important. Once a `coverVersion` is publicly released, the corresponding dictionary and template rules should not be modified, removed, or reordered. Future changes should be introduced through new versions while preserving the ability to decode old payloads.

The current project uses:

```text
coverVersion = 2
```

## Technology Stack

- React
- TypeScript
- Vite
- Argon2id
- XChaCha20-Poly1305
- Vitest
- Cloudflare Pages

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Recommended validation before release:

```bash
npm run validate:dictionaries
npm test
npm run typecheck
npm run lint
npm run build
```

## Static Deployment

The project is designed to work as a static frontend application.

Cloudflare Pages configuration:

```text
Framework preset: React (Vite)
Build command: npm run build
Build output directory: dist
Production branch: main
Root directory: /
```

If the build environment requires a Node.js version setting, use:

```text
NODE_VERSION = 20
```

## Project Structure

```text
.
├── src/                 # Frontend source code
├── tools/               # Build and dictionary validation tools
├── dist/                # Generated build output
├── README.md            # Chinese README
├── README.en.md         # English README
├── package.json         # Scripts and dependencies
└── vite.config.ts       # Vite configuration
```

## Roadmap

Planned improvements:

- Add `SECURITY.md`
- Add a formal threat model document
- Add more test vectors
- Improve malformed payload handling
- Improve cover-text naturalness evaluation
- Add more Chinese cover-text styles
- Improve dictionary versioning and compatibility checks
- Add CI checks for tests and build
- Improve mobile interaction details
- Publish `v0.1.0-alpha` and future stable releases

## Why OpenAI Support Would Help

OpenAI API credits and Codex would help this open-source project in the following areas:

1. **Code review and refactoring**
   Use Codex to review TypeScript code, improve maintainability, reduce implementation mistakes, and simplify security-sensitive code paths.

2. **Security-sensitive testing**
   Generate and maintain test cases for malformed payloads, wrong passphrases, weak passphrases, Unicode normalization, dictionary compatibility, corrupted ciphertext, and browser compatibility.

3. **Chinese cover-text quality evaluation**
   Use language models to evaluate whether generated Chinese cover text is natural, diverse, readable, and style-consistent across daily, chat-like, fiction-like, and classical-style outputs.

4. **Documentation and education**
   Improve bilingual documentation, tutorials, threat model, security limitations, user-facing explanations, and educational examples for Chinese-speaking developers.

5. **Open-source maintenance automation**
   Use Codex for release notes, issue triage, documentation checks, PR review assistance, and maintainer workflow improvements.

## Responsible Disclosure

If you discover a security issue, please do not use it for harm. Please report it through GitHub Security Advisories if available, or contact the maintainer through GitHub.

Please do not open a public issue that includes an exploitable security report before the issue has been reviewed.

## License

This project is licensed under the Apache License 2.0.

See [LICENSE](./LICENSE) for details.

## Disclaimer

This project is provided for educational, research, and lawful use only.

The maintainers do not encourage, support, or take responsibility for any illegal, abusive, or harmful use of this software. Users are solely responsible for how they use, copy, modify, distribute, deploy, or build upon this project, and must comply with applicable laws, regulations, and platform policies.

This software is provided “as is”, without warranties of any kind, express or implied, including but not limited to warranties of security, fitness for a particular purpose, availability, correctness, or non-infringement.

To the maximum extent permitted by applicable law, the authors and contributors shall not be liable for any direct or indirect loss, legal liability, administrative penalty, criminal liability, data leak, business interruption, or third-party claim arising from the use, misuse, modification, distribution, deployment, or reliance on this project.

If you do not agree with these terms, do not use, deploy, distribute, or build derivative works based on this project.