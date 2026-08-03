# Open Grammarly

**The free, open-source alternative to Grammarly.**

A powerful AI-powered grammar and spelling checker that runs entirely in your browser. No subscriptions, no per-user data collection, no limits. Powered by DeepSeek and ready to use out of the box — no API key needed.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-green.svg)

## Features

- **Real-time Grammar Checking** - Automatically detects grammar and spelling errors as you type
- **Fix Grammar** - Dedicated proofreader tab with one-click Accept / Accept All corrections
- **Improve** - Rewrites your text to be genuinely better: fixes awkward phrasing, weak word choices, passives, and repetition
- **Inline Spelling Highlights** - Misspelled words get red wavy underlines in rich editors (Gmail, Docs, contenteditable), with a misspelling-count badge for plain inputs and textareas
- **Select to Trigger** - Selecting text in any field automatically opens the panel
- **Rewriting Tools** - Rephrase, Shorten, Formal, Clarity & Concision, and Humanize modes with sentence-level diffs
- **13 Writing Tones** - Formal, Professional, Casual, Friendly, Confident, Persuasive, Concise, Expand, Simplify, Empathetic, Assertive, Descriptive, and Natural — each with Replace and Copy
- **Translation** - Translate any field into 8 languages with automatic source detection
- **Works Everywhere** - Functions on any website with text inputs, textareas, and contenteditable elements
- **Multiple Writing Modes** - Choose between Casual, Professional, and Academic styles
- **Adjustable Aggressiveness** - Control how strict the grammar checking should be
- **Privacy-First** - All your settings stay in your browser.
- **Ready to Use** - Powered by DeepSeek via a preconfigured proxy. No API key setup required.

## Screenshots

### Docked Panel
A floating tabbed panel appears next to the field you're working on, with quick actions for:

- **Improve** - full-text improvement rewrite
- **Fix Grammar** - grammar and spelling corrections with Accept / Accept All
- **Translate** - target-language picker with Replace and Copy
- **Rephrase / Shorten / Formal** - one-click rewrite styles
- **More** - Clarity & Concision, Humanize, and a "Rewrite with tone" list of 13 tones

Each suggestion shows a before/after diff (deleted vs. inserted text) with an Accept button.

### Inline Highlighting
Misspelled words are underlined in red directly inside contenteditable editors. Plain inputs and textareas get a red badge showing the misspelling count.

### Extension Popup
Quick access to enable/disable the extension.

### Settings Page
Customize your writing preferences (mode and aggressiveness).

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/samirxpikachuio/grammarlyx.git
   cd grammarlyx
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Configuration

1. Click the extension icon in Chrome toolbar
2. Click the settings gear icon
3. Configure your preferences:
   - **Writing Mode**: Casual, Professional, or Academic
   - **Aggressiveness**: How strict the grammar checking should be

No API key is required — the extension talks to a preconfigured DeepSeek proxy out of the box.

## Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Tech Stack

- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS 4
- **Build Tool**: Vite 7 with CRXJS plugin
- **AI Integration**: DeepSeek API (via proxy)
- **Text Diffing**: diff-match-patch for fuzzy matching

## Project Structure

```
src/
├── background/       # Service worker for API calls
│   └── index.ts
├── content/          # Content script injected into pages
│   ├── index.ts      # Main content script (analysis, replacement, highlights)
│   ├── dom-observer.ts   # Observes DOM for text fields
│   └── ui-injector.ts    # Docked panel UI, badges, and toasts
├── lib/
│   ├── deepseek.ts   # API integration and text analysis prompts
│   └── storage.ts    # Chrome storage utilities
├── options/          # Extension options page
│   ├── Options.tsx
│   └── main.tsx
├── popup/            # Extension popup
│   ├── Popup.tsx
│   └── main.tsx
└── style.css         # Global styles
```

## How It Works

1. **DOM Observation**: The content script observes all text inputs, textareas, and contenteditable elements on the page
2. **Debounced Analysis**: When you stop typing, the text is sent to the background script for grammar/spelling checking
3. **Select to Open**: Selecting text in a field opens the tabbed panel with an Improve rewrite
4. **AI Processing**: The background script calls the DeepSeek API (via proxy) for analysis, rewriting, translation, and tone rewrites
5. **Validation**: Corrections are validated and positioned accurately using fuzzy matching
6. **UI Rendering**: Suggestions render as before/after diffs in a docked panel, misspelled words get inline red underlines (CSS Custom Highlight API), and inputs/textareas get a misspelling-count badge

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [ISC License](LICENSE).

---

**Star this repo if you find it useful!** Help spread the word about the open-source alternative to Grammarly.

## Acknowledgments

- [DeepSeek](https://www.deepseek.com/) for providing AI model access
- [CRXJS](https://crxjs.dev/) for the excellent Chrome extension Vite plugin
- [Lucide](https://lucide.dev/) for beautiful icons
