import pptxgen from 'pptxgenjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, '../../MCP-TS-SDK-phase1.pptx');

const pres = new pptxgen();

// CRITICAL FIX: Explicitly define 16:9 Widescreen layout at 13.333 x 7.5 inches
// Default LAYOUT_16x9 in pptxgenjs is 10 x 5.625, which caused the overflow in PowerPoint!
pres.defineLayout({ name: 'WIDESCREEN_16_9', width: 13.333, height: 7.5 });
pres.layout = 'WIDESCREEN_16_9';

pres.author = 'Group 2631';
pres.company = 'MCP.2502';
pres.title = 'MCP.2502 — Model Context Protocol with the TypeScript SDK';

// Color Palette - Sleek Modern Dark Tech
const C_BG = '0B1120';        // Deep Midnight
const C_CARD = '1E293B';      // Slate Card
const C_CARD_BORDER = '334155';
const C_CYAN = '38BDF8';      // Main Accent Cyan
const C_INDIGO = '818CF8';    // Secondary Accent
const C_GREEN = '34D399';     // Success / Metric Green
const C_AMBER = 'FBBF24';     // Alert / Highlight Amber
const C_RED = 'F87171';       // Error / Warning Red
const C_WHITE = 'FFFFFF';
const C_TEXT = 'F1F5F9';
const C_MUTED = '94A3B8';
const FONT_TITLE = 'Calibri';
const FONT_BODY = 'Calibri';

function addHeader(slide, partLabel, titleText, slideNum) {
    slide.addText(partLabel.toUpperCase(), {
        x: 0.8, y: 0.45, w: 10.0, h: 0.3,
        fontSize: 11, fontFace: FONT_TITLE, bold: true, color: C_CYAN, charSpacing: 1.5
    });

    slide.addText(titleText, {
        x: 0.8, y: 0.75, w: 11.5, h: 0.6,
        fontSize: 22, fontFace: FONT_TITLE, bold: true, color: C_WHITE
    });

    slide.addText(`MCP.2502 · Slide ${slideNum} / 34`, {
        x: 9.5, y: 7.0, w: 3.0, h: 0.3,
        fontSize: 10, fontFace: FONT_BODY, color: C_MUTED, align: 'right'
    });
}

function createCard(slide, x, y, w, h, fill = C_CARD, border = C_CARD_BORDER) {
    slide.addShape(pres.ShapeType.rect, {
        x, y, w, h,
        fill: { color: fill },
        line: { color: border, width: 1 },
        rectRadius: 0.08
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1: Title
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    createCard(s, 1.0, 1.0, 11.333, 5.5);

    s.addText("MCP.2502 · EMERGING TECHNOLOGIES", {
        x: 1.5, y: 1.6, w: 10.0, h: 0.4,
        fontSize: 13, fontFace: FONT_TITLE, bold: true, color: C_CYAN, charSpacing: 2
    });

    s.addText("Model Context Protocol\nwith the TypeScript SDK", {
        x: 1.5, y: 2.1, w: 10.0, h: 1.5,
        fontSize: 34, fontFace: FONT_TITLE, bold: true, color: C_WHITE
    });

    s.addText("Case Study: Academic Records Assistant (2 MCP Servers · 13 Tools)", {
        x: 1.5, y: 3.7, w: 10.0, h: 0.5,
        fontSize: 16, fontFace: FONT_BODY, color: C_INDIGO
    });

    s.addText("Group Members: Nguyễn Hữu Thiện · Hà Hiệp Thanh · Hà Văn Trường Phú\nNguyễn Minh Tiến · Lê Tuấn Khoa · Trần Huy Hoàng", {
        x: 1.5, y: 4.5, w: 10.0, h: 0.8,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    s.addText("Class: 2631  |  Phase 1 Presentation  |  October 2026", {
        x: 1.5, y: 5.4, w: 10.0, h: 0.4,
        fontSize: 12, fontFace: FONT_BODY, color: C_MUTED
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 2: Agenda
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Overview", "Agenda & Structure (30 Minutes)", 2);

    const parts = [
        {
            title: "Part A — Problem, Architecture & Core Protocols",
            time: "~11 min (TV3)",
            desc: "The M×N integration problem, Host/Client/Server topology, 3 MCP Primitives, JSON-RPC 2.0 wire format, Session lifecycle (2025 vs 2026), Transports (stdio vs HTTP), GPA & CSV validation algorithms."
        },
        {
            title: "Part B — The TypeScript SDK v2 in Practice",
            time: "~9 min (TV4)",
            desc: "SDK architecture (@modelcontextprotocol/server & client), registerTool with parameter sets, Tool lifecycle, Resources, Prompts with autocomplete, Elicitation & Sampling APIs, Error taxonomy."
        },
        {
            title: "Part C — Live Demo, Dual-LLM Benchmark & Conclusions",
            time: "~8 min (Team Lead)",
            desc: "Live demo across 4 scenarios, comprehensive benchmark comparing Gemini 3.5 Flash-Lite (Cloud) vs Qwen3 4B (Local Ollama), latency breakdown, lessons learned, and Q&A."
        }
    ];

    parts.forEach((p, idx) => {
        const y = 1.5 + idx * 1.7;
        createCard(s, 0.8, y, 11.733, 1.45);
        s.addText(`${idx + 1}. ${p.title}`, {
            x: 1.1, y: y + 0.15, w: 8.5, h: 0.4,
            fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
        });
        s.addText(p.time, {
            x: 9.8, y: y + 0.15, w: 2.4, h: 0.4,
            fontSize: 12, fontFace: FONT_BODY, bold: true, color: C_AMBER, align: 'right'
        });
        s.addText(p.desc, {
            x: 1.1, y: y + 0.6, w: 11.0, h: 0.7,
            fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 3: The Problem: LLMs Cannot Reach Private Data
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Foundation", "The Problem: LLMs Cannot Reach Private Data", 3);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("The LLM Isolation Dilemma", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText([
        { text: "• Frozen Pre-trained Knowledge:\n", options: { bold: true, color: C_WHITE } },
        { text: "  An LLM only knows its training data; it has zero access to your university's live grade database.\n\n", options: { color: C_TEXT } },
        { text: "• High Risk of Hallucination:\n", options: { bold: true, color: C_WHITE } },
        { text: "  When asked for a student's GPA, an unassisted model generates plausible-sounding fictional numbers.\n\n", options: { color: C_TEXT } },
        { text: "• Strict Accuracy Constraints:\n", options: { bold: true, color: C_WHITE } },
        { text: "  Academic records and grade calculations demand 100% mathematical precision and auditing.", options: { color: C_TEXT } }
    ], { x: 1.1, y: 2.3, w: 5.1, h: 4.1, fontSize: 13, fontFace: FONT_BODY });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("The M × N Connector Explosion", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_AMBER
    });
    s.addText([
        { text: "Without a Common Protocol:\n", options: { bold: true, color: C_WHITE } },
        { text: "Every AI application (Chat CLI, VS Code, Web Agent) must write bespoke, proprietary connectors for every data source (Grades DB, Files, Reports).\n\n", options: { color: C_TEXT } },
        { text: "3 Applications × 3 Services = 9 Custom Connectors!\n\n", options: { bold: true, color: C_AMBER } },
        { text: "• Fragile, hard to maintain, and insecure.\n• Vendor lock-in prevents swapping LLMs or tools.\n• Tool definitions are not standardized.", options: { color: C_MUTED } }
    ], { x: 7.133, y: 2.3, w: 5.1, h: 4.1, fontSize: 13, fontFace: FONT_BODY });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 4: What is MCP? The "USB-C for AI"
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Architecture", "What is MCP? The \"USB-C for AI\"", 4);

    createCard(s, 0.8, 1.5, 11.733, 1.9);
    s.addText("Open Standard for AI Tool & Context Connectivity", {
        x: 1.1, y: 1.7, w: 10.0, h: 0.4,
        fontSize: 17, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("Model Context Protocol (MCP) standardizes how AI applications discover, read, and execute external tools and resources.\nInstead of M × N custom integrations, developers wrap each data source once as an MCP Server. Any MCP Host connects seamlessly.", {
        x: 1.1, y: 2.2, w: 11.0, h: 1.0,
        fontSize: 13.5, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 0.8, 3.6, 5.7, 3.1);
    s.addText("Transforming M × N into M + N", {
        x: 1.1, y: 3.8, w: 5.1, h: 0.35,
        fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_GREEN
    });
    s.addText("• 3 Apps + 3 Servers = 6 Integrations (saving 33%+ effort)\n• Adding a 4th app requires only 1 integration to access all 3 servers\n• Adding a 4th data source instantly serves all existing apps\n• True modularity across local and cloud environments", {
        x: 1.1, y: 4.3, w: 5.1, h: 2.1,
        fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 3.6, 5.7, 3.1);
    s.addText("Key Industry Benefits", {
        x: 7.133, y: 3.8, w: 5.1, h: 0.35,
        fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_INDIGO
    });
    s.addText("• Multi-Host Reusability: Same server works in CLI & VS Code\n• Multi-Model Portability: Swap Gemini with local Qwen seamlessly\n• Enterprise Security: Data and business logic stay in server\n• Standardized Governance: Type validation via Zod schemas", {
        x: 7.133, y: 4.3, w: 5.1, h: 2.1,
        fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 5: Architecture: Host · Client · Server
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Architecture", "Architecture: Host · Client · Server", 5);

    const cols = [
        {
            title: "HOST (Chat CLI / VS Code)",
            badge: "Owns the LLM & User UX",
            badgeCol: C_CYAN,
            items: [
                "• Manages conversation history & context",
                "• Owns the LLM API connection (Gemini / Ollama)",
                "• Initiates MCP client connections to servers",
                "• Dispatches tool calls requested by the model"
            ]
        },
        {
            title: "CLIENT (Protocol Adapter)",
            badge: "1-to-1 Server Connection",
            badgeCol: C_INDIGO,
            items: [
                "• Handles JSON-RPC 2.0 serialization",
                "• Negotiates protocol era (2025 vs 2026)",
                "• Supports stdio subprocess or HTTP transport",
                "• Enforces client timeouts and request retry logic"
            ]
        },
        {
            title: "SERVER (Academic & Utility)",
            badge: "Owns Data & Business Logic",
            badgeCol: C_GREEN,
            items: [
                "• Reads CSVs and validates data integrity",
                "• Exposes Tools, Resources and Prompts",
                "• Calculates GPA and letter grades (100% exact)",
                "• Enforces human-in-the-loop safeguards (Elicitation)"
            ]
        }
    ];

    cols.forEach((c, idx) => {
        const x = 0.8 + idx * 4.01;
        createCard(s, x, 1.5, 3.71, 4.3);
        s.addText(c.title, {
            x: x + 0.2, y: 1.8, w: 3.31, h: 0.4,
            fontSize: 13, fontFace: FONT_TITLE, bold: true, color: C_WHITE
        });
        s.addText(c.badge, {
            x: x + 0.2, y: 2.2, w: 3.31, h: 0.3,
            fontSize: 10, fontFace: FONT_BODY, bold: true, color: c.badgeCol
        });
        s.addText(c.items.join("\n\n"), {
            x: x + 0.2, y: 2.6, w: 3.31, h: 3.0,
            fontSize: 11, fontFace: FONT_BODY, color: C_TEXT
        });
    });

    createCard(s, 0.8, 6.0, 11.733, 0.7, C_CARD, C_AMBER);
    s.addText("Golden Rule of MCP: The LLM proposes actions ➔ The Host executes them safely.", {
        x: 1.0, y: 6.15, w: 11.333, h: 0.4,
        fontSize: 14, fontFace: FONT_TITLE, bold: true, color: C_AMBER, align: 'center'
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 6: MCP Primitives: Tools · Resources · Prompts
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Architecture", "The Three MCP Primitives", 6);

    const prims = [
        {
            name: "TOOL",
            ctrl: "Model / LLM Controlled",
            col: C_CYAN,
            example: "calculate_gpa(student_id)\nclass_statistics(class_id)",
            desc: "Functions that the LLM chooses to call based on reasoning over user intent. The handler executes code and returns structured JSON or error status."
        },
        {
            name: "RESOURCE",
            ctrl: "Application / User Controlled",
            col: C_INDIGO,
            example: "academic://students/2201010\nacademic://rules/grading",
            desc: "Read-only data that the Host (not the LLM) attaches as context. Like a GET endpoint identified by URI, readable directly or through URI templates."
        },
        {
            name: "PROMPT",
            ctrl: "User Controlled (Slash Command)",
            col: C_GREEN,
            example: "class_report(class_id, semester?)\nstudy_advice(student_id)",
            desc: "Interactive prompt templates pre-defined by the server. Includes parameter autocompletion (completable) and structured system messages."
        }
    ];

    prims.forEach((p, idx) => {
        const x = 0.8 + idx * 4.01;
        createCard(s, x, 1.5, 3.71, 5.2);
        s.addText(p.name, {
            x: x + 0.2, y: 1.8, w: 3.31, h: 0.5,
            fontSize: 20, fontFace: FONT_TITLE, bold: true, color: p.col
        });
        s.addText(p.ctrl, {
            x: x + 0.2, y: 2.3, w: 3.31, h: 0.3,
            fontSize: 11, fontFace: FONT_BODY, bold: true, color: C_WHITE
        });
        s.addText("Live Example:\n" + p.example, {
            x: x + 0.2, y: 2.8, w: 3.31, h: 0.8,
            fontSize: 11, fontFace: 'Consolas', color: C_AMBER
        });
        s.addText(p.desc, {
            x: x + 0.2, y: 3.8, w: 3.31, h: 2.6,
            fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 7: Case Study: Academic Records Assistant
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Case Study", "Academic Records Assistant Overview", 7);

    const stats = [
        { num: "40", label: "Students", sub: "2 Faculties, 4 Classes" },
        { num: "10", label: "Courses", sub: "GE & CS Curriculum" },
        { num: "261", label: "Grade Records", sub: "Process & Final Scores" },
        { num: "2", label: "MCP Servers", sub: "Academic & Utility" }
    ];

    stats.forEach((st, idx) => {
        const x = 0.8 + idx * 3.0;
        createCard(s, x, 1.5, 2.73, 1.4);
        s.addText(st.num, {
            x: x + 0.1, y: 1.6, w: 2.53, h: 0.5,
            fontSize: 24, fontFace: FONT_TITLE, bold: true, color: C_CYAN, align: 'center'
        });
        s.addText(st.label, {
            x: x + 0.1, y: 2.15, w: 2.53, h: 0.3,
            fontSize: 11, fontFace: FONT_BODY, bold: true, color: C_WHITE, align: 'center'
        });
        s.addText(st.sub, {
            x: x + 0.1, y: 2.45, w: 2.53, h: 0.3,
            fontSize: 9.5, fontFace: FONT_BODY, color: C_MUTED, align: 'center'
        });
    });

    createCard(s, 0.8, 3.15, 5.7, 3.55);
    s.addText("2 Specialized MCP Servers", {
        x: 1.1, y: 3.35, w: 5.1, h: 0.4,
        fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_GREEN
    });
    s.addText("• academic server:\n  10 Tools (GPA calculation, transcript, rank, stats, tables)\n  4 Resources (grading rules, data quality, students, tables)\n  2 Prompts (class_report, study_advice)\n\n• utility server:\n  3 Tools (get_current_time, convert_score, save_report)", {
        x: 1.1, y: 3.85, w: 5.1, h: 2.6,
        fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 3.15, 5.7, 3.55);
    s.addText("Dual-Host & Dual-LLM Environment", {
        x: 7.133, y: 3.35, w: 5.1, h: 0.4,
        fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_INDIGO
    });
    s.addText("• 2 Hosts:\n  1. Custom Chat CLI with full turn logging\n  2. VS Code IDE assistant (via .vscode/mcp.json)\n\n• 2 LLM Providers:\n  1. Cloud: Google Gemini 3.5 Flash-Lite / 3.8 Flash\n  2. Local: Qwen3 4B via Ollama (Zero cloud cost, 100% private)", {
        x: 7.133, y: 3.85, w: 5.1, h: 2.6,
        fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 8: JSON-RPC 2.0 — The Wire Format
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Protocol", "JSON-RPC 2.0 — The Wire Protocol", 8);

    createCard(s, 0.8, 1.5, 5.5, 5.2);
    s.addText("Protocol Characteristics", {
        x: 1.1, y: 1.8, w: 4.9, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("• Universal Message Structure:\n  Every interaction is a standard JSON-RPC 2.0 message.\n\n• Three Message Types:\n  1. Request: Requires a response matching `id`.\n  2. Response: Returns `result` or `error`.\n  3. Notification: One-way push without `id`.\n\n• Transport Independence:\n  Identical JSON-RPC payloads flow over stdio streams or SSE HTTP connections seamlessly.", {
        x: 1.1, y: 2.3, w: 4.9, h: 4.1,
        fontSize: 12.5, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.6, 1.5, 5.933, 5.2);
    s.addText("Live Wire Trace Samples (from c5-wire-trace.log)", {
        x: 6.9, y: 1.8, w: 5.3, h: 0.4,
        fontSize: 13, fontFace: FONT_TITLE, bold: true, color: C_AMBER
    });
    const jsonSample = `// Request (Host -> Server)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "calculate_gpa",
    "arguments": { "student_id": "2201010" }
  }
}

// Response (Server -> Host)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "GPA: 2.06" }]
  }
}

// Notification (One-way push)
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed"
}`;
    s.addText(jsonSample, {
        x: 6.9, y: 2.3, w: 5.3, h: 4.2,
        fontSize: 9.5, fontFace: 'Consolas', color: C_GREEN
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 9: Session Lifecycle: 2025 vs 2026-07-28
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Protocol", "Session Lifecycle: 2025 vs 2026-07-28 Spec", 9);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("2025 Era (Legacy Stateful)", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_AMBER
    });
    s.addText("• Two Round-Trip Handshake:\n  Client must send `initialize` request, wait for capabilities, then send `initialized` notification.\n\n• Session Overhead:\n  No tool calls allowed until the full handshake completes.\n\n• Stateful Server Memory:\n  Server must maintain connection state throughout lifecycle.", {
        x: 1.1, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("2026-07-28 Era (Modern Stateless)", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_GREEN
    });
    s.addText("• Zero-Round-Trip Connect:\n  Uses `server/discover` with cached prior capabilities.\n  First packet can immediately be `tools/call`!\n\n• Stateless Request Handling:\n  Every request carries its own `_meta` context, ideal for cloud scale.\n\n• Dual-Era Compatibility:\n  Our TypeScript SDK v2 code serves both 2025 and 2026 hosts concurrently without duplicate code.", {
        x: 7.133, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 10: Transports: stdio vs Streamable HTTP
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Protocol", "Transports: stdio vs Streamable HTTP", 10);

    const rows = [
        ["Metric / Feature", "stdio Transport", "Streamable HTTP Transport"],
        ["Primary Target", "Local desktop (VS Code, Chat CLI)", "Remote microservices & containers"],
        ["Connection Mechanism", "Spawns Node subprocess via stdin/out", "Server-Sent Events (SSE) + POST"],
        ["Connection Time", "~181 ms (process spawn)", "~6 ms (HTTP handshake)"],
        ["Call Latency", "0.2 – 2.0 ms", "1.0 – 5.0 ms (TCP stack overhead)"],
        ["Security Safeguards", "OS process level isolation", "Rejects foreign Origin/Host (403 Forbidden)"],
        ["Process Model", "1 server process per connection", "1 server process serves many clients"]
    ];

    s.addTable(rows, {
        x: 0.8, y: 1.6, w: 11.733, h: 4.8,
        colW: [3.333, 4.2, 4.2],
        fill: C_CARD,
        color: C_TEXT,
        fontSize: 11,
        fontFace: FONT_BODY,
        border: { pt: 1, color: C_CARD_BORDER },
        align: 'left',
        valign: 'middle'
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 11: Main Algorithm: The Tool-Calling Loop
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Algorithms", "Main Algorithm: The Tool-Calling Loop", 11);

    const steps = [
        { num: "Step 1", title: "Prompt Dispatch", desc: "Host sends user query + JSON schemas of all tools to the LLM." },
        { num: "Step 2", title: "Model Tool Selection", desc: "LLM inspects schemas and returns one or more structured tool calls." },
        { num: "Step 3", title: "Routing & Execution", desc: "Host dispatches call to target server; server runs code and returns output." },
        { num: "Step 4", title: "Error Feedback & Loop", desc: "Tool errors go back to model for self-correction until final answer is generated." }
    ];

    steps.forEach((st, idx) => {
        const x = 0.8 + idx * 3.0;
        createCard(s, x, 1.6, 2.73, 4.2);
        s.addText(st.num, {
            x: x + 0.1, y: 1.9, w: 2.53, h: 0.4,
            fontSize: 14, fontFace: FONT_TITLE, bold: true, color: C_AMBER, align: 'center'
        });
        s.addText(st.title, {
            x: x + 0.1, y: 2.4, w: 2.53, h: 0.5,
            fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_CYAN, align: 'center'
        });
        s.addText(st.desc, {
            x: x + 0.2, y: 3.1, w: 2.33, h: 2.4,
            fontSize: 12, fontFace: FONT_BODY, color: C_TEXT, align: 'center'
        });
    });

    createCard(s, 0.8, 6.05, 11.733, 0.65, C_CARD, C_CYAN);
    s.addText("Recursion Control: agent.maxToolRounds = 4 guards against runaway execution loops.", {
        x: 1.0, y: 6.2, w: 11.333, h: 0.35,
        fontSize: 13, fontFace: FONT_TITLE, bold: true, color: C_CYAN, align: 'center'
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 12: Worked Example: Multi-Server Chaining
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Case Study", "Worked Example: Multi-Server Chaining", 12);

    createCard(s, 0.8, 1.5, 11.733, 1.2);
    s.addText("User Query: \"Write a performance report for class IT01 and save it.\"", {
        x: 1.1, y: 1.7, w: 11.0, h: 0.35,
        fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("The LLM orchestrates tools across two completely independent servers that have zero knowledge of each other.", {
        x: 1.1, y: 2.1, w: 11.0, h: 0.4,
        fontSize: 12, fontFace: FONT_BODY, color: C_MUTED
    });

    const calls = [
        { round: "Round 1", server: "academic", tool: "class_statistics", args: "class_id: \"IT01\"", purpose: "Fetches student count, pass rate, avg GPA" },
        { round: "Round 1", server: "utility", tool: "get_current_time", args: "—", purpose: "Resolves current semester timestamp" },
        { round: "Round 2", server: "academic", tool: "rank_students", args: "class_id: \"IT01\", top: 3", purpose: "Identifies top 3 students for recognition" },
        { round: "Round 3", server: "utility", tool: "save_report", args: "format: \"md\", filename: ...", purpose: "Persists final report markdown to disk" }
    ];

    calls.forEach((c, idx) => {
        const y = 2.9 + idx * 0.92;
        createCard(s, 0.8, y, 11.733, 0.82);
        s.addText(c.round, { x: 1.0, y: y + 0.18, w: 1.3, h: 0.4, fontSize: 12, bold: true, color: C_AMBER });
        s.addText(c.server, { x: 2.4, y: y + 0.18, w: 1.5, h: 0.4, fontSize: 12, bold: true, color: C_INDIGO });
        s.addText(c.tool, { x: 4.0, y: y + 0.18, w: 2.2, h: 0.4, fontSize: 12, fontFace: 'Consolas', color: C_GREEN });
        s.addText(c.args, { x: 6.3, y: y + 0.18, w: 2.2, h: 0.4, fontSize: 11, fontFace: 'Consolas', color: C_MUTED });
        s.addText(c.purpose, { x: 8.6, y: y + 0.18, w: 3.7, h: 0.4, fontSize: 11, color: C_TEXT });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 13: Elicitation — Human in the Loop
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Safety", "Elicitation — Human-in-the-Loop Safeguard", 13);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("Mid-Execution Confirmation", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("• Safeguarding Destructive Tools:\n  Critical actions like `update_grade` cannot be executed autonomously by the AI without human sign-off.\n\n• Protocol Interaction:\n  Server pauses execution mid-call and returns an input request (Accept / Decline / Cancel).\n\n• User in Control:\n  The user inspects the exact diff (student ID, old grade, new proposed grade) before committing.", {
        x: 1.1, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("Real Bug Caught in Practice!", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_AMBER
    });
    s.addText([
        { text: "Actual failure scenario during benchmark:\n", options: { bold: true, color: C_WHITE } },
        { text: "• The user asked: \"Update final score of 2201010 in CS101 to 8.0\".\n", options: { color: C_TEXT } },
        { text: "• The LLM hallucinated: it sent `{ process_score: 0, final_score: 8 }`!\n\n", options: { color: C_RED, bold: true } },
        { text: "• Because of Elicitation, the prompt dialog popped up:\n  \"Proposed grade: Total 4.8 (D) [Process: 0, Final: 8]\".\n\n", options: { color: C_TEXT } },
        { text: "• The user immediately clicked DECLINE, saving the database from corrupting the student's process grade!", options: { color: C_GREEN, bold: true } }
    ], { x: 7.133, y: 2.3, w: 5.1, h: 4.1, fontSize: 12.5, fontFace: FONT_BODY });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 14: Sampling — Server Borrows the Host's LLM
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Capabilities", "Sampling: Server Borrows Host's LLM", 14);

    createCard(s, 0.8, 1.5, 11.733, 1.8);
    s.addText("Inverted Intelligence Flow", {
        x: 1.1, y: 1.7, w: 10.0, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("Traditionally, Hosts call Servers. With Sampling, an MCP Server can request LLM completions back from the Host.\nTool `generate_student_feedback` generates qualitative academic advice without needing its own Gemini API key.", {
        x: 1.1, y: 2.2, w: 11.0, h: 0.95,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 0.8, 3.55, 5.7, 3.15);
    s.addText("Key Advantages of Sampling", {
        x: 1.1, y: 3.75, w: 5.1, h: 0.35,
        fontSize: 14, fontFace: FONT_TITLE, bold: true, color: C_GREEN
    });
    s.addText("• Zero Credentials in Server: Server code has no API secrets\n• Host Policy Control: Host decides which LLM handles the request\n• Budget Protection: Host can auto-approve, prompt user, or decline\n• Standardized Messages: Uses `sampling/createMessage`", {
        x: 1.1, y: 4.25, w: 5.1, h: 2.2,
        fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 3.55, 5.7, 3.15);
    s.addText("Host Approval Options (config/host.json)", {
        x: 7.133, y: 3.75, w: 5.1, h: 0.35,
        fontSize: 14, fontFace: FONT_TITLE, bold: true, color: C_INDIGO
    });
    s.addText("• \"sampling\": { \"approval\": \"auto\", \"maxTokens\": 600 }\n• \"auto\": Headless execution for automated benchmarks\n• \"ask\": Prompts human before spending token quota\n• \"decline\": Strict enterprise policy blocking server sampling", {
        x: 7.133, y: 4.25, w: 5.1, h: 2.2,
        fontSize: 12, fontFace: 'Consolas', color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 15: Domain Algorithm: From Scores to GPA
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Algorithms", "Domain Algorithm: Grading & GPA Rules", 15);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("Grading Rules (config/grading.json)", {
        x: 1.1, y: 1.75, w: 5.1, h: 0.35,
        fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    const gRows = [
        ["Total Score (10-pt)", "Letter", "4-Point", "Classification"],
        ["8.5 – 10.0", "A", "4.0", "Excellent"],
        ["7.0 – < 8.5", "B", "3.0", "Good"],
        ["5.5 – < 7.0", "C", "2.0", "Fairly good"],
        ["4.0 – < 5.5", "D", "1.0", "Average"],
        ["0.0 – < 4.0", "F", "0.0", "Weak / Fail"]
    ];
    s.addTable(gRows, {
        x: 1.0, y: 2.2, w: 5.3, h: 2.6,
        fill: C_CARD, color: C_TEXT, fontSize: 10, fontFace: FONT_BODY,
        border: { pt: 1, color: C_CARD_BORDER }
    });
    s.addText("Total = 40% Process Score + 60% Final Score (Rounded to 1 decimal).", {
        x: 1.1, y: 5.2, w: 5.1, h: 0.4,
        fontSize: 11, fontFace: FONT_BODY, color: C_AMBER
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("Credit-Weighted GPA & Retakes", {
        x: 7.133, y: 1.75, w: 5.1, h: 0.35,
        fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_INDIGO
    });
    s.addText([
        { text: "• Cumulative GPA Formula:\n", options: { bold: true, color: C_WHITE } },
        { text: "  GPA = Σ(Point × Credits) / Σ Credits\n\n", options: { fontFace: 'Consolas', color: C_GREEN } },
        { text: "• Retake Policy (Crucial Rule):\n", options: { bold: true, color: C_WHITE } },
        { text: "  When a student retakes a course, cumulative GPA retains ONLY the highest grade achieved.\n\n", options: { color: C_TEXT } },
        { text: "• Live Worked Example — Student 2201010:\n", options: { bold: true, color: C_WHITE } },
        { text: "  Semester 2024-1 alone: GPA = 0.38 (Weak)\n", options: { color: C_RED } },
        { text: "  Cumulative (after CS101 retake): 37 pts / 18 cr = 2.06 (Average)\n", options: { color: C_GREEN } },
        { text: "  100% computed in TypeScript engine, never estimated by LLM.", options: { color: C_MUTED } }
    ], { x: 7.133, y: 2.2, w: 5.1, h: 4.2, fontSize: 11.5, fontFace: FONT_BODY });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 16: Data Loading & Validation: 7 Injected Errors
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part A · Data Integrity", "Data Loading & Quarantining 7 Injected Errors", 16);

    createCard(s, 0.8, 1.5, 11.733, 0.9);
    s.addText("Zero Tolerance for Bad Data: Automatic In-Memory Quarantine", {
        x: 1.1, y: 1.65, w: 10.0, h: 0.3,
        fontSize: 15, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("The server parses all CSVs on startup. Invalid rows are skipped and reported to `academic://reports/data-quality` — never computed in GPA.", {
        x: 1.1, y: 2.0, w: 11.0, h: 0.35,
        fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
    });

    const errs = [
        ["File", "Line", "Injected Problem", "Validation Outcome"],
        ["students.csv", "Line 42", "duplicate student_id 2201001", "Quarantined (Duplicate ID)"],
        ["grades.csv", "Line 263", "process_score 11.5 (> 10)", "Quarantined (Out of bounds)"],
        ["grades.csv", "Line 264", "missing final_score", "Quarantined (Missing score)"],
        ["grades.csv", "Line 265", "unknown student_id 2299999", "Quarantined (Foreign key failed)"],
        ["grades.csv", "Line 266", "unknown course_id CS999", "Quarantined (Foreign key failed)"],
        ["grades.csv", "Line 267", "process_score -1 (< 0)", "Quarantined (Out of bounds)"],
        ["grades.csv", "Line 268", "duplicate of line 2", "Quarantined (Duplicate grade entry)"]
    ];

    s.addTable(errs, {
        x: 0.8, y: 2.55, w: 11.733, h: 4.2,
        colW: [2.0, 1.5, 4.733, 3.5],
        fill: C_CARD, color: C_TEXT, fontSize: 11, fontFace: FONT_BODY,
        border: { pt: 1, color: C_CARD_BORDER }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 17: Part B: MCP TypeScript SDK v2 Architecture
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · SDK Architecture", "MCP TypeScript SDK v2 Architecture", 17);

    const pkgs = [
        { name: "@modelcontextprotocol/server", desc: "Core server classes (McpServer, ResourceTemplate), tool/resource/prompt registries, and JSON-RPC dispatching." },
        { name: "@modelcontextprotocol/client", desc: "Client connection manager, version negotiation (auto/pin), tool calling, and resource subscription listeners." },
        { name: "@modelcontextprotocol/node", desc: "Transport adapters for standard I/O (stdio) and Node.js HTTP/SSE server pipelines." }
    ];

    pkgs.forEach((p, idx) => {
        const x = 0.8 + idx * 4.01;
        createCard(s, x, 1.5, 3.71, 2.4);
        s.addText(p.name, { x: x + 0.2, y: 1.7, w: 3.31, h: 0.5, fontSize: 13, bold: true, fontFace: 'Consolas', color: C_CYAN });
        s.addText(p.desc, { x: x + 0.2, y: 2.3, w: 3.31, h: 1.4, fontSize: 12, color: C_TEXT });
    });

    createCard(s, 0.8, 4.15, 11.733, 2.55);
    s.addText("Major Enhancements in SDK v2 vs v1", {
        x: 1.1, y: 4.35, w: 10.0, h: 0.35,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_GREEN
    });
    s.addText([
        { text: "• Modular Multi-Package Architecture: ", options: { bold: true, color: C_WHITE } },
        { text: "Replaces monolithic v1 package with lightweight, tree-shakeable modules.\n", options: { color: C_TEXT } },
        { text: "• Implements Spec 2026-07-28: ", options: { bold: true, color: C_WHITE } },
        { text: "Full support for server/discover, while remaining 100% backward-compatible with 2025 clients.\n", options: { color: C_TEXT } },
        { text: "• Standard Schema Support (Zod v4): ", options: { bold: true, color: C_WHITE } },
        { text: "Type-safe schemas, runtime validation, and auto-generated tool definitions.", options: { color: C_TEXT } }
    ], { x: 1.1, y: 4.85, w: 11.0, h: 1.6, fontSize: 12.5, fontFace: FONT_BODY });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 18: Creating & Serving an MCP Server
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Implementation", "Creating & Serving an MCP Server", 18);

    createCard(s, 0.8, 1.5, 11.733, 5.2);
    const codeServer = `export function createAcademicServer(ctx: McpRequestContext): McpServer {
    const data = getAcademicData();
    const server = new McpServer(
        { name: 'academic', title: 'Academic Records', version: '1.0.0' },
        {
            capabilities: { logging: {}, resources: { subscribe: true } },
            instructions: ACADEMIC_INSTRUCTIONS,
            cacheHints: getAcademicConfig().cacheHints
        }
    );
    registerAcademicTools(server, data, ctx.era);
    registerAcademicResources(server, data);
    registerAcademicPrompts(server, data);
    return server;
}

// Subprocess mode (Local desktop / VS Code)
serveStdio(createAcademicServer);

// Streamable HTTP mode (Microservice / Container)
const handler = createMcpHandler(createAcademicServer);
app.all('/mcp', c => handler(c.req.raw));`;

    s.addText(codeServer, {
        x: 1.1, y: 1.7, w: 11.0, h: 4.8,
        fontSize: 11.5, fontFace: 'Consolas', color: C_GREEN
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 19: registerTool with Parameter Sets
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Implementation", "registerTool with Parameter Validation", 19);

    const tCases = [
        ["Case / Test Scenario", "Sample Input", "Expected Behavior", "SDK Mechanism"],
        ["Valid Request", "student_id: \"2201010\"", "Returns exact GPA 2.06", "Structured output via outputSchema"],
        ["Optional Parameter", "+ semester: \"2024-1\"", "Calculates semester GPA (0.38)", "Zod semester.optional() filter"],
        ["Unknown Student", "student_id: \"9999999\"", "Returns isError: true", "fail('Unknown student') allows LLM retry"],
        ["Invalid Type / Format", "student_id: 12345 (number)", "Rejected before handler", "Zod schema catches bad type immediately"]
    ];

    s.addTable(tCases, {
        x: 0.8, y: 1.6, w: 11.733, h: 4.8,
        colW: [2.4, 3.1, 3.1, 3.133],
        fill: C_CARD, color: C_TEXT, fontSize: 11, fontFace: FONT_BODY,
        border: { pt: 1, color: C_CARD_BORDER }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 20: Dynamic Tool Lifecycle Management
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Advanced Features", "Dynamic Tool Lifecycle Management", 20);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("Live Modification Without Restarts", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("• Zero-Downtime Reconfiguration:\n  Tools can be enabled, disabled, updated, or deleted on a running server without terminating the process.\n\n• Automated Event Notification:\n  Every change dispatches `notifications/tools/list_changed`.\n\n• Verified in Harness S3:\n  5 live lifecycle events emitted and confirmed by the client listener.", {
        x: 1.1, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("SDK Tool Lifecycle Methods", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_INDIGO
    });
    const codeLife = `// Register tool and get reference
const tool = server.registerTool(
    'temp_tool',
    config,
    handler
);

// Temporarily disable tool
tool.disable();

// Re-enable when ready
tool.enable();

// Update description or schema
tool.update({ description: 'New info' });

// Remove permanently
tool.remove();`;
    s.addText(codeLife, {
        x: 7.133, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 11, fontFace: 'Consolas', color: C_GREEN
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 21: Resources & Resource Templates
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Implementation", "Resources & Dynamic Resource Templates", 21);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("Static Resources", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("• academic://rules/grading\n  Returns active markdown grading rules directly generated from `config/grading.json`.\n\n• academic://reports/data-quality\n  Returns real-time JSON report of all rejected rows in sample data.\n\n• Attached by Host:\n  Can be injected as background knowledge into system prompts.", {
        x: 1.1, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("Resource Templates (ResourceTemplate)", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_GREEN
    });
    s.addText("• academic://students/{student_id}\n  Dynamic URI resolving any student's profile & GPA.\n\n• Autocompletion Supported:\n  `client.complete()` suggests valid student IDs matching prefix (e.g., \"22010\" -> 2201001..2201010).\n\n• Protocol Error on 404:\n  Requesting unknown student returns `ProtocolError -32602`.", {
        x: 7.133, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 22: Prompts & Argument Autocompletion
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Implementation", "Prompts & Parameter Autocompletion", 22);

    createCard(s, 0.8, 1.5, 11.733, 5.2);
    const codePrompt = `server.registerPrompt(
    'class_report',
    {
        title: 'Class performance report',
        description: 'Ask the assistant for a structured performance report of one class',
        argsSchema: z.object({
            class_id: completable(z.string().describe('Class ID, e.g. "IT01"'), value =>
                data.classes().filter(c => c.toLowerCase().startsWith(value.toLowerCase()))
            ),
            semester: completable(z.string().optional().describe('Semester, e.g. "2024-1"'), value =>
                data.semesters().filter(s => s.startsWith(value ?? ''))
            )
        })
    },
    ({ class_id, semester }) => ({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text: \`Write a performance report for class \${class_id} (\${semester ?? 'all semesters'}).\`
            }
        }]
    })
);`;

    s.addText(codePrompt, {
        x: 1.1, y: 1.7, w: 11.0, h: 4.8,
        fontSize: 10.5, fontFace: 'Consolas', color: C_GREEN
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 23: Progress Notifications & Cancellation
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Advanced Features", "Progress Notifications & Cooperative Cancellation", 23);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("Progress Reporting (notify)", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("• Non-blocking Streamed Progress:\n  Long operations notify client via `ctx.mcpReq.notify({ progress, total })`.\n\n• Conditional Notification:\n  Progress updates only sent if client explicitly subscribed via `onprogress`.\n\n• Live Verification (S6):\n  Emits 10/40, 20/40, 30/40, 40/40 cleanly.", {
        x: 1.1, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("Cooperative Cancellation (AbortSignal)", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_AMBER
    });
    s.addText("• Graceful Execution Teardown:\n  Client abort triggers `ctx.mcpReq.signal` on server.\n\n• Resource Leak Prevention:\n  Server loop checks `signal.aborted` and exits early, releasing CPU and database locks.\n\n• Live Verification (S6):\n  Process successfully stops immediately after 4/20 steps on user cancel.", {
        x: 7.133, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 24: Error Handling Taxonomy in SDK v2
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Reliability", "Error Handling Taxonomy in SDK v2", 24);

    const errRows = [
        ["Error Type", "Example Condition", "Behavior / Return", "Recovery Strategy"],
        ["Tool Execution Error", "Student 9999999 not found", "result.isError: true\nfail('Unknown student')", "Model reads message and retries with another student ID"],
        ["Protocol Error", "Missing prompt parameter\nUnknown method name", "JSON-RPC error code\nProtocolError (-32602)", "Handled by Host / Client protocol layer; rejected immediately"],
        ["SDK / Transport Error", "Server crash, port in use\nClient timeout exceeded", "Throws SdkError or\nTimeoutError", "Host marks server unhealthy or restarts process"]
    ];

    s.addTable(errRows, {
        x: 0.8, y: 1.6, w: 11.733, h: 4.8,
        colW: [2.5, 3.1, 3.1, 3.033],
        fill: C_CARD, color: C_TEXT, fontSize: 11, fontFace: FONT_BODY,
        border: { pt: 1, color: C_CARD_BORDER }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 25: Client Connection & Prior Capability Caching
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Client Implementation", "Client Connection & Prior Capability Caching", 25);

    createCard(s, 0.8, 1.5, 11.733, 5.2);
    const codeClient = `// Client initialization with automatic protocol version negotiation
const client = new Client(
    { name: 'demo-client', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } } // Supports both 2025 and 2026 hosts
);

// Zero-Round-Trip connection using cached prior server capabilities
await client.connect(transport, { prior: cachedServerCapabilities });

// Immediately invoke tools without waiting for multi-round handshakes!
const result = await client.callTool({
    name: 'calculate_gpa',
    arguments: { student_id: '2201010' }
});

console.log(result.structuredContent); // { gpa: 2.06, classification: 'Average' }`;

    s.addText(codeClient, {
        x: 1.1, y: 1.7, w: 11.0, h: 4.8,
        fontSize: 11.5, fontFace: 'Consolas', color: C_GREEN
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 26: Request Options, Timeouts & Safeguards
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Reliability", "Request Options, Timeouts & Safeguards", 26);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("Granular Request Timeouts", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("• `timeout: 10000` (ms):\n  Base timeout per request preventing stuck socket connections.\n\n• `resetTimeoutOnProgress: true`:\n  Long data crunching keeps connection alive as long as progress updates arrive.\n\n• `maxTotalTimeout: 60000`:\n  Absolute ceiling ensuring operations never run indefinitely.", {
        x: 1.1, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("Host-Side Safeguards", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_AMBER
    });
    s.addText("• Recursive Round Limiter:\n  `agent.maxToolRounds = 4` prevents infinite tool loops when models get confused.\n\n• Argument Validation Schema:\n  Zod schemas catch malformed types before invoking handlers.\n\n• Input Elicitation:\n  Forces human approval on all mutations (`update_grade`).", {
        x: 7.133, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 27: Resource Subscriptions & cacheHints
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Optimization", "Resource Subscriptions & cacheHints", 27);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("Resource Subscriptions (listen)", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    s.addText("• Real-Time Reactive UI:\n  Client subscribes via `client.listen({ resourceSubscriptions })`.\n\n• Push Notifications:\n  When `update_grade` succeeds, server pushes notification to `academic://students/2201010`.\n\n• Client Auto-Refresh:\n  Host automatically invalidates local view and pulls fresh transcript data.", {
        x: 1.1, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("cacheHints Optimization", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 16, fontFace: FONT_TITLE, bold: true, color: C_GREEN
    });
    s.addText("• Eliminates Redundant Network Roundtrips:\n  Servers advertise `cacheHints` for tools and resources.\n\n• 3-to-1 Traffic Reduction:\n  3 consecutive `listTools()` calls from client trigger only ONE actual server query; the rest are served from local client cache.\n\n• Tested in C4: Verified zero traffic on repeat calls.", {
        x: 7.133, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 13, fontFace: FONT_BODY, color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 28: Multi-Host Flexibility: One Server, Many Hosts
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part B · Portability", "One Server, Many Hosts: Zero Code Changes", 28);

    createCard(s, 0.8, 1.5, 5.7, 5.2);
    s.addText("Host 1: Custom Chat CLI (config/host.json)", {
        x: 1.1, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 14, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });
    const jsonHost = `{
  "academic": {
    "command": "node",
    "args": [
      "--import", "tsx",
      "src/server/academic/main.ts"
    ],
    "protocol": "auto"
  }
}`;
    s.addText(jsonHost, {
        x: 1.1, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 11, fontFace: 'Consolas', color: C_GREEN
    });

    createCard(s, 6.833, 1.5, 5.7, 5.2);
    s.addText("Host 2: VS Code Copilot (.vscode/mcp.json)", {
        x: 7.133, y: 1.8, w: 5.1, h: 0.4,
        fontSize: 14, fontFace: FONT_TITLE, bold: true, color: C_INDIGO
    });
    const jsonVS = `{
  "academic": {
    "type": "stdio",
    "command": "node",
    "args": [
      "--import", "tsx",
      "src/server/academic/main.ts"
    ],
    "cwd": "\${workspaceFolder}"
  }
}`;
    s.addText(jsonVS, {
        x: 7.133, y: 2.3, w: 5.1, h: 4.1,
        fontSize: 11, fontFace: 'Consolas', color: C_AMBER
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 29: Part C: Live Demonstration Plan
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part C · Live Demo", "Live Demonstration Plan (8 Minutes)", 29);

    const scens = [
        { num: "Scenario 1", title: "Natural Language GPA Inquiry", desc: "User asks: \"What is the GPA of student 2201010?\". LLM calls calculate_gpa and explains 2.06 (Average) with retake rationale." },
        { num: "Scenario 2", title: "Multi-Server Chaining", desc: "User asks to compile & save IT01 report. LLM chains class_statistics + get_current_time + rank_students + save_report across servers." },
        { num: "Scenario 3", title: "Human Safeguard via Elicitation", desc: "User requests grade update. Prompt halts and requests explicit confirmation (Accept/Decline) before modifying CSV database." },
        { num: "Scenario 4", title: "VS Code Copilot Integration", desc: "Same servers demonstrated inside VS Code agent mode, proving multi-host compatibility with zero code changes." }
    ];

    scens.forEach((sc, idx) => {
        const y = 1.5 + idx * 1.3;
        createCard(s, 0.8, y, 11.733, 1.15);
        s.addText(sc.num, { x: 1.1, y: y + 0.15, w: 2.0, h: 0.4, fontSize: 13, bold: true, color: C_AMBER });
        s.addText(sc.title, { x: 3.1, y: y + 0.15, w: 8.5, h: 0.4, fontSize: 14, bold: true, color: C_CYAN });
        s.addText(sc.desc, { x: 1.1, y: y + 0.55, w: 11.0, h: 0.5, fontSize: 12, color: C_TEXT });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 30: Benchmark Results: Cloud vs Local LLM
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part C · Evaluation", "Benchmark Results: Two LLMs, Same Servers", 30);

    const bRows = [
        ["Model Variant", "Deployment", "Accuracy (11 Cases × 2 Runs)", "Median Latency", "Resource Usage"],
        ["Gemini 3.5 Flash-Lite", "Google Cloud API", "100% (22/22 Pass)", "2.7 s", "Cloud API Quota"],
        ["Qwen3 4B Instruct", "Local Ollama", "100% (22/22 Pass)", "2.1 s", "3.3 GB RAM (Zero Cloud Cost)"],
        ["Qwen3 4B Thinking", "Local Ollama", "100% (22/22 Pass)", "24.4 s", "3.3 GB RAM (10x Latency)"]
    ];

    s.addTable(bRows, {
        x: 0.8, y: 1.5, w: 11.733, h: 3.2,
        colW: [2.7, 2.3, 2.7, 1.8, 2.233],
        fill: C_CARD, color: C_TEXT, fontSize: 11, fontFace: FONT_BODY,
        border: { pt: 1, color: C_CARD_BORDER }
    });

    createCard(s, 0.8, 4.95, 11.733, 1.75);
    s.addText("Latency Breakdown Discovery: LLM Inference Dominates", {
        x: 1.1, y: 5.15, w: 10.0, h: 0.35,
        fontSize: 14, fontFace: FONT_TITLE, bold: true, color: C_AMBER
    });
    s.addText("• MCP Tool Execution Time: 2 ms – 40 ms (< 1% of end-to-end turn latency)\n• LLM Token Generation Time: 2.0 s – 24.0 s (99%+ of latency)\n• Takeaway: Optimize model choice and prompting rather than server performance.", {
        x: 1.1, y: 5.6, w: 11.0, h: 0.9,
        fontSize: 12, fontFace: FONT_BODY, color: C_TEXT
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 31: Key Lessons Learned
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part C · Insights", "Key Lessons Learned from Implementation", 31);

    const lessons = [
        {
            num: "01",
            title: "Tool Design > Model Size",
            desc: "Clear tool names, explicit parameter descriptions, and strict Zod schemas allowed a lightweight 4B local model to match Google's cloud model at 100% accuracy on our benchmark."
        },
        {
            num: "02",
            title: "Human Safeguards are Essential",
            desc: "Elicitation caught a genuine LLM mistake: the model fabricated process_score: 0 when updating a final grade. Human confirmation prevented silent database corruption."
        },
        {
            num: "03",
            title: "\"Thinking\" is Not Free",
            desc: "Qwen3 Thinking generated ~1,400 reasoning tokens per turn, causing 10x slower latency (24.4s vs 2.1s) with zero accuracy improvement on tool-calling tasks."
        }
    ];

    lessons.forEach((l, idx) => {
        const x = 0.8 + idx * 4.01;
        createCard(s, x, 1.5, 3.71, 5.2);
        s.addText(l.num, { x: x + 0.2, y: 1.8, w: 3.31, h: 0.6, fontSize: 32, bold: true, color: C_CYAN });
        s.addText(l.title, { x: x + 0.2, y: 2.5, w: 3.31, h: 0.5, fontSize: 16, bold: true, color: C_WHITE });
        s.addText(l.desc, { x: x + 0.2, y: 3.2, w: 3.31, h: 3.2, fontSize: 12.5, color: C_TEXT });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 32: Summary & Architectural Impact
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part C · Summary", "Summary: The Value of MCP", 32);

    createCard(s, 0.8, 1.5, 11.733, 5.2);
    s.addText("Clean Separation of Concerns", {
        x: 1.2, y: 1.8, w: 10.0, h: 0.4,
        fontSize: 18, fontFace: FONT_TITLE, bold: true, color: C_CYAN
    });

    s.addText([
        { text: "• What Exists (MCP Servers):\n", options: { bold: true, color: C_GREEN, fontSize: 14 } },
        { text: "  Data sources, business logic, GPA formulas, validation rules, and persistence.\n\n", options: { color: C_TEXT, fontSize: 13 } },
        { text: "• Who Reasons (Hosts & LLMs):\n", options: { bold: true, color: C_INDIGO, fontSize: 14 } },
        { text: "  Intent understanding, query planning, parameter extraction, and human interaction.\n\n", options: { color: C_TEXT, fontSize: 13 } },
        { text: "• TypeScript SDK v2 Highlights:\n", options: { bold: true, color: C_AMBER, fontSize: 14 } },
        { text: "  1. Dual-era protocol support (2025 stateful + 2026 stateless)\n  2. Dual-transport versatility (stdio for local desktop, HTTP for cloud microservices)\n  3. Full type safety from database row to LLM argument via Zod schemas.", options: { color: C_TEXT, fontSize: 13 } }
    ], { x: 1.2, y: 2.4, w: 10.5, h: 4.0 });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 33: References & Project Artifacts
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    addHeader(s, "Part C · Resources", "References & Project Artifacts", 33);

    const refs = [
        { label: "Model Context Protocol Specification", url: "https://modelcontextprotocol.io/specification/2026-07-28", desc: "Official specification defining JSON-RPC methods, discovery, and transport specs." },
        { label: "MCP TypeScript SDK Repository", url: "https://github.com/modelcontextprotocol/typescript-sdk", desc: "Upstream official TypeScript SDK v2 packages and protocol implementation." },
        { label: "Group Project Repository", url: "https://github.com/HaHiepThanh/mcp-ts", desc: "Full academic assistant codebase, test harnesses, benchmark logs, and documentation." }
    ];

    refs.forEach((r, idx) => {
        const y = 1.6 + idx * 1.6;
        createCard(s, 0.8, y, 11.733, 1.4);
        s.addText(r.label, { x: 1.1, y: y + 0.15, w: 11.0, h: 0.35, fontSize: 14, bold: true, color: C_CYAN });
        s.addText(r.url, { x: 1.1, y: y + 0.5, w: 11.0, h: 0.3, fontSize: 12, fontFace: 'Consolas', color: C_GREEN });
        s.addText(r.desc, { x: 1.1, y: y + 0.85, w: 11.0, h: 0.4, fontSize: 11, color: C_MUTED });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 34: Q&A
// ─────────────────────────────────────────────────────────────────────────────
{
    const s = pres.addSlide();
    s.background = { color: C_BG };
    createCard(s, 1.0, 1.0, 11.333, 5.5);

    s.addText("THANK YOU FOR LISTENING!", {
        x: 1.5, y: 2.0, w: 10.0, h: 0.6,
        fontSize: 28, fontFace: FONT_TITLE, bold: true, color: C_CYAN, align: 'center'
    });

    s.addText("MCP.2502 · Model Context Protocol with the TypeScript SDK\nAcademic Records Assistant", {
        x: 1.5, y: 2.8, w: 10.0, h: 0.8,
        fontSize: 16, fontFace: FONT_BODY, color: C_TEXT, align: 'center'
    });

    s.addText("Questions & Answers (Q&A)", {
        x: 1.5, y: 4.0, w: 10.0, h: 0.6,
        fontSize: 22, fontFace: FONT_TITLE, bold: true, color: C_AMBER, align: 'center'
    });

    s.addText("Project Repository: https://github.com/HaHiepThanh/mcp-ts", {
        x: 1.5, y: 5.0, w: 10.0, h: 0.4,
        fontSize: 12, fontFace: 'Consolas', color: C_MUTED, align: 'center'
    });
}

// Re-write the presentation
await pres.writeFile({ fileName: outputPath });
console.log(`Successfully generated calibrated Widescreen presentation at: ${outputPath}`);
