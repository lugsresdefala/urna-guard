# Store listing (English): Urna Guard 2.1.1

## Name (max 45 characters)
Urna Guard – voting-machine alerts on X

## Short description (max 132 characters)
Flags (never hides) posts on X with signs of disinformation about Brazil's electronic voting machine and suspicious accounts. 100% local.

## Suggested category
Chrome: "Social & Communication". Edge: "Social". Firefox: "Social & Communication".

## Contact email
tiagoog@lugaresdefala.com

## Language
English (secondary listing; primary listing is Portuguese – Brazil)

## Full description
Urna Guard helps you recognize, while browsing X (formerly Twitter), posts that repeat already-debunked narratives about Brazil's electronic voting machine (urna eletrônica). It pays particular attention to posts from accounts that show signs of being inauthentic or acting in coordination.

HOW IT WORKS
• A discreet badge appears next to the author's name: ⚠️ Attention (yellow) or ⛔ High risk (red).
• Clicking the badge opens a panel that shows exactly which signals were detected and how much each one weighs. It also links to the official fact-checks from Brazil's Superior Electoral Court (TSE "Fato ou Boato" and voting-machine security pages).
• 49 narratives in 11 categories: fraud, source code, printed ballots, military intervention, attacks on the TSE/STF, pre-loaded machines, vote counting, hackers, Venezuela/Smartmatic, phantom voters and campaign hashtags.
• Resistant to writing tricks: leetspeak (fr4ud3), separators (f.r.a.u.d.e), repeated letters, invisible characters and typos.
• Understands context: fact-checks, debunks, irony ("they say that…") and negations lower the alert. It also analyzes quoted posts, link cards and image alt text.
• Account signals: usernames full of digits, default avatar, generic name, "backup account" bio, near-identical text across several accounts, the same link repeated and bursts of posts.
• "Not disinformation" button: adjusts the weights and adds the author to your trust list.
• Popup with statistics by category and JSON/CSV export.
• Content detection is tuned for Brazilian Portuguese posts. The on-screen labels are in Portuguese.

WHAT IT NEVER DOES
• It never hides posts.
• It never reports, likes, replies, blocks or follows. It does not automate anything on X.
• It never sends data to servers. No telemetry and no trackers.

PRIVACY (LGPD)
Everything stays in your browser's local storage (chrome.storage.local), and you can delete it at any time.

DISCLAIMER
These are heuristics, not proof, and false positives can happen. Do not use the badges to harass anyone. When in doubt, check https://www.justicaeleitoral.jus.br/fato-ou-boato/

An independent project, not affiliated with the TSE, Brazil's Electoral Justice or X.

## Single purpose (Chrome)
Show local, informational alerts on X/Twitter for posts that have signs of disinformation about Brazil's electronic voting machine.

## Permission justifications
• storage: keep the user's settings, feedback and flagged items locally.
• Host access to x.com / twitter.com (content script): read the text of posts already displayed on screen, to compute the alert and show the badge.
• Remote code: NOT used.

## Data usage (Chrome Web Store "Privacy practices" form)
• Does not collect or transmit user data. All processing is local.
• Certify: "I do not sell or transfer user data to third parties", "I do not use or transfer user data for purposes unrelated to the item's single purpose", "I do not use or transfer user data to determine creditworthiness or for lending purposes".
• Privacy policy URL: https://lugsresdefala.github.io/urna-guard/en/privacidade.html (Portuguese: https://lugsresdefala.github.io/urna-guard/privacidade.html)
• Firefox (AMO): data collection permissions = "none" (declared in the manifest).

## Assets
• Icon 128×128: icons/icon128.png
• Screenshots 1280×800: store/screenshot-1..4-*.png (UI in Portuguese)
• Small promo tile 440×280: store/promo-tile-440x280.png
• Chrome/Edge package: dist/urna-guard-chrome-2.0.0.zip
• Firefox package: dist/urna-guard-firefox-2.0.0.zip
