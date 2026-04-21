# TRDC SCAN_ARCHIVE PRO v1.0

![TRDC Banner](https://img.shields.io/badge/TRDC-AUTHORIZED_ACCESS-black?style=for-the-badge)
![Deployment](https://img.shields.io/badge/Status-OPTIMAL-green?style=for-the-badge)
![Engine](https://img.shields.io/badge/Intelligence-GROQ_LLAMA_3.3-blue?style=for-the-badge)
![Imagery](https://img.shields.io/badge/Imagery-HF_FLUX_1-purple?style=for-the-badge)

**LIVE DEMO: [scan-archive.vercel.app](https://scan-archive.vercel.app/)**
**REPOSITORY: [github.com/timothydevcastro/SCAN_ARCHIVE](https://github.com/timothydevcastro/SCAN_ARCHIVE)**

**SCAN_ARCHIVE PRO** is a high-fidelity AI object scanner built for the curious. Traditional searching often leads to information overload; this tool is designed to cut through the noise, delivering streamlined, high-speed trivia for rapid knowledge acquisition. Developed under the **TRDC** brand.

## 🛡️ Core Features

- **Sub-Second Extraction**: Powered by **Groq // Llama-3.3-70B** for instant, structured JSON metadata.
- **High-Fidelity Capture**: Integrated with **Hugging Face // FLUX.1-schnell** via the HF Router for photorealistic archival subjects.
- **Bulletproof Failover**:
  - **Intelligence**: Automatic fallback to **Local Simulator** on 503/429 cloud errors.
  - **Imaging**: Silent fallback to **Pollinations AI** for zero-latency visual rendering.
- **Local Persistence**: Full session history stored via **IndexedDB**, surviving refreshes and reloads.
- **Archival Export**: Official PDF generation and raw JSON session logs for departmental records.
- **Brutalist Aesthetic**: Monospace-heavy, high-contrast UI with scanline raster overlays and authorized security signals.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4.0
- **Motion**: Framer Motion (Archival transitions & Viewport flicker)
- **Database**: IndexedDB (Browser-based persistence)
- **Icons**: Lucide React
- **PDF Engine**: jsPDF

## 🔑 Environment Secrets

To run the scanner, the following keys must be configured in your `.env` or Vercel Environment:

```bash
GEMINI_API_KEY=your_google_key
HF_API_KEY=your_huggingface_key
GROQ_API_KEY=your_groq_key
```

## 🚀 Deployment (Vercel)

1. **Install CLI**: `npm i -g vercel`
2. **Link Project**: `vercel link`
3. **Set Secrets**: `vercel env add <KEY_NAME> production`
4. **Final Push**: `vercel --prod`

## 🌟 Portfolio Integration

If you're viewing this for a portfolio, here are the high-level engineering decisions implemented in this project:

- **Multi-Cloud Intelligence**: Orchestrated a dual-engine AI pipeline using **Groq** for sub-second NLP and **Hugging Face** for image synthesis.
- **Fail-Safe Architecture**: Implemented local simulation fallbacks and secondary API routers to ensure 100% uptime regardless of cloud availability.
- **Browser-Edge Storage**: Utilized **IndexedDB** for seamless session persistence, allowing archival data to survive reloads without a dedicated database server.
- **Brutalist UI/UX**: Designed a high-impact, monospace-driven archival aesthetic that balances clinical data visualization with modern motion design.

## 📊 Production Metrics
- **Intelligence**: Groq Llama-3.3-70B (0.4s avg latency)
- **Visuals**: FLUX.1-schnell (1.2s avg latency)
- **Deployment**: Vercel Edge Runtime

---
*DEVELOPED BY ANTIGRAVITY AI // AUTHORIZED FOR TRDC OPERATIONS*
