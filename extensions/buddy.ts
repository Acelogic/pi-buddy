import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
} from "@mariozechner/pi-coding-agent";

const STATUS_ID = "pi-buddy";

const RESET = "\x1b[0m";
const BUBBLE_BORDER = "\x1b[38;5;250m";
const BUBBLE_TEXT = "\x1b[38;5;253m";
const ACCENTS: Record<Mood, string> = {
	default: "\x1b[38;5;139m",
	happy: "\x1b[38;5;71m",
	curious: "\x1b[38;5;74m",
	worried: "\x1b[38;5;208m",
	grumpy: "\x1b[38;5;196m",
};

type Mood = "default" | "happy" | "curious" | "worried" | "grumpy";

interface MoodFace {
	e: string;
	m: string;
}

const FACES: Record<Mood, MoodFace> = {
	default: { e: "o o", m: "—" },
	happy: { e: "^ ^", m: "ᴗ" },
	curious: { e: "O o", m: "?" },
	worried: { e: "u u", m: "·" },
	grumpy: { e: "¬ ¬", m: "‾" },
};

const BLINK_FACE: MoodFace = { e: "- -", m: "—" };

interface Species {
	name: string;
	bias: Partial<Stats>;
	frames: readonly (readonly string[])[];
}

const SPECIES: Species[] = [
	{
		name: "duck",
		bias: { snark: 6 },
		frames: [
			["    _,_   ", "  (>{E}<)  ", "   ({M})   ", "   /==\\   ", "   ¯¯¯¯   "],
			["    _,_   ", "  (>{E}<)  ", "   ({M})   ", "   /==\\~  ", "   ¯¯¯¯   "],
			["    _,_~  ", "  (>{E}<)  ", "   ({M})   ", "   /=~=\\  ", "   ¯¯¯¯   "],
		],
	},
	{
		name: "penguin",
		bias: { patience: 8 },
		frames: [
			["   .-\"-.   ", "  ( {E} )  ", "  | {M} |  ", "   \\   /   ", "   _\\^/_   "],
			["   .-\"-.   ", "  ( {E} )  ", "  | {M} |  ", "   \\   /   ", "   _/^\\_   "],
			["  ~.-\"-.   ", "  ( {E} )  ", "  | {M} |  ", "   \\   /   ", "   _\\^/_   "],
		],
	},
	{
		name: "dragon",
		bias: { chaos: 9, snark: 4 },
		frames: [
			["   /\\___/\\    ", "  ( {E} )=≡≡⌇ ", "   /v{M}v\\    ", "  /(  |  )\\   ", "     ¯  ¯     "],
			["   /\\___/\\    ", "  ( {E} )=≡⌇⌇ ", "   /v{M}v\\    ", "  /(  |  )\\   ", "     ¯  ¯     "],
			[" ~ /\\___/\\    ", "  ( {E} )=≡≡⌇ ", "   /v{M}v\\    ", "  /(  |  )\\   ", "     ¯  ¯     "],
		],
	},
	{
		name: "octopus",
		bias: { debugging: 12 },
		frames: [
			["    ___    ", "  ( {E} )  ", "  ( {M} )  ", "  /|||||\\  ", "   ' ' '   "],
			["    ___    ", "  ( {E} )  ", "  ( {M} )  ", "  \\|||||/  ", "   ' ' '   "],
			[" o  ___    ", "  ( {E} )  ", "  ( {M} )  ", "  /|\\|/|\\  ", "   ' ' '   "],
		],
	},
	{
		name: "capybara",
		bias: { patience: 12 },
		frames: [
			["  ,_____,    ", " ( {E}    )  ", " (   {M}   ) ", "  m     m    ", "  ¯     ¯    "],
			["  ,_____,    ", " ( {E}    )  ", " (   {M}   ) ", "  u     u    ", "  ¯     ¯    "],
			["  ~  ~       ", "  ,_____,    ", " ( {E}    )  ", " (   {M}   ) ", "  m     m    "],
		],
	},
	{
		name: "axolotl",
		bias: { chaos: 4, wisdom: 4 },
		frames: [
			["  ψ___ψ    ", " ( {E}  )  ", " ~ {M}  ~  ", " (  |  )   ", "   ¯¯¯     "],
			["  φ___φ    ", " ( {E}  )  ", " ≈ {M}  ≈  ", " (  |  )   ", "   ¯¯¯     "],
			["  ψ___ψ    ", " ( {E}  )  ", " ~ {M}  ~  ", " (  ~  )   ", "   ¯¯¯     "],
		],
	},
	{
		name: "cat",
		bias: { snark: 10 },
		frames: [
			["   /\\___/\\    ", "  ( {E}  )    ", "   > {M} <    ", "  /(  |  )\\   ", "     ¯  ¯     "],
			["   /\\-_-/\\    ", "  ( {E}  )    ", "   > {M} <    ", "  /(  |  )\\   ", "     ¯  ¯     "],
			["   /\\___/\\    ", "  ( {E}  )    ", "   > {M} <    ", "  /(  |  )\\~  ", "     ¯  ¯     "],
		],
	},
	{
		name: "fox",
		bias: { wisdom: 6, snark: 3 },
		frames: [
			["   /\\_/\\   ", "  / {E} \\  ", "   > {M} < ", "   |≡≡≡|   ", "   '   '   "],
			["   /\\_/\\   ", "  / {E} \\  ", "   > {M} < ", "   |≡=≡|   ", "   '   '   "],
			["   /\\_/\\~  ", "  / {E} \\  ", "   > {M} < ", "   |≡≡≡|   ", "   '   '   "],
		],
	},
	{
		name: "owl",
		bias: { wisdom: 12 },
		frames: [
			["  ,___,    ", " ( {E} )   ", "  ({M}{M})    ", " )=|=(     ", "    ¯      "],
			["  ,___,    ", " ( {E} )   ", "  ({M}{M})    ", " )_|_(     ", "    ¯      "],
			["  ,___,    ", " ( {E} )   ", "  ({M}{M})    ", " )=|=(     ", "   ' '     "],
		],
	},
	{
		name: "panda",
		bias: { patience: 6 },
		frames: [
			["  ◖___◗    ", " ( {E} )   ", " ( {M} )   ", "  '   '    ", "  ¯   ¯    "],
			["  ◖_·_◗    ", " ( {E} )   ", " ( {M} )   ", "  '   '    ", "  ¯   ¯    "],
			["  ◖___◗    ", " ( {E} )   ", " ( {M} )   ", "  '~  '    ", "  ¯   ¯    "],
		],
	},
	{
		name: "raccoon",
		bias: { chaos: 7, debugging: 3 },
		frames: [
			["   /\\_/\\    ", "  /={E}=\\   ", "   ' {M} '  ", "  /|≡≡|\\    ", "    ¯  ¯    "],
			["   /\\_/\\    ", "  /-{E}-\\   ", "   ' {M} '  ", "  /|≡≡|\\    ", "    ¯  ¯    "],
			["   /\\_/\\~   ", "  /={E}=\\   ", "   ' {M} '  ", "  /|≡≡|\\    ", "    ¯  ¯    "],
		],
	},
	{
		name: "hedgehog",
		bias: { snark: 4, patience: 4 },
		frames: [
			[" /\\/\\/\\/\\    ", "( {E}    )    ", "   {M}  ~     ", " '~~~~~'      ", "   ¯¯¯        "],
			[" /\\^/\\/\\     ", "( {E}    )    ", "   {M}  ~     ", " '~~~~~'      ", "   ¯¯¯        "],
			[" /\\/\\/^\\/    ", "( {E}    )    ", "   {M}  ~     ", " '~~~~~'      ", "   ¯¯¯        "],
		],
	},
	{
		name: "frog",
		bias: { chaos: 3, wisdom: 4 },
		frames: [
			["  ◖{E}◗    ", " ( {M} )   ", "  /===\\    ", " ('   ')   ", "   ¯¯¯     "],
			["  ◖{E}◗    ", " ( {M} )   ", "  /=·=\\    ", " ('   ')   ", "   ¯¯¯     "],
			["  ◖{E}◗ ~  ", " ( {M} )   ", "  /===\\    ", " ('   ')   ", "   ¯¯¯     "],
		],
	},
	{
		name: "hamster",
		bias: { chaos: 6 },
		frames: [
			["  ______    ", " ( {E}    ) ", " ( {M}    ) ", "  '||||'    ", "   ¯¯¯¯     "],
			["  ______    ", " ( {E}    ) ", " ( {M}    ) ", "  '|||||'   ", "   ¯¯¯¯     "],
			["  ______    ", " ( {E}    ) ", " ( {M}    ) ", "  '|| ||'   ", "   ¯¯¯¯     "],
		],
	},
	{
		name: "narwhal",
		bias: { wisdom: 6, snark: 2 },
		frames: [
			["    ____>      ", " ( {E}    )>══ ", "  ( {M} )      ", " ~/====\\~     ", "    ¯¯         "],
			["    ____>      ", " ( {E}    )>══~", "  ( {M} )      ", " ~/====\\~     ", "    ¯¯         "],
			["~   ____>      ", " ( {E}    )>══ ", "  ( {M} )      ", " ~/====\\~     ", "    ¯¯         "],
		],
	},
	{
		name: "sloth",
		bias: { patience: 14 },
		frames: [
			["  ,-----,    ", " ( {E}    )  ", "  | {M} |    ", " /=======\\   ", "  ¯¯¯¯¯¯¯    "],
			["z ,-----,    ", " ( {E}    )  ", "  | {M} |    ", " /=======\\   ", "  ¯¯¯¯¯¯¯    "],
			["  ,-----,  z ", " ( {E}    )  ", "  | {M} |    ", " /=======\\   ", "  ¯¯¯¯¯¯¯    "],
		],
	},
	{
		name: "turtle",
		bias: { wisdom: 8, patience: 5 },
		frames: [
			["       ___      ", "  ___( {E}  )   ", " /({M})/\\____>  ", "  |      |      ", "  ¯      ¯      "],
			["       ___      ", "  ___( {E}  )~  ", " /({M})/\\____>  ", "  |      |      ", "  ¯      ¯      "],
			["       ___      ", "  ___( {E}  )   ", " /({M})/\\====>  ", "  |      |      ", "  ¯      ¯      "],
		],
	},
	{
		name: "unicorn",
		bias: { wisdom: 4, snark: 5, chaos: 3 },
		frames: [
			["    /\\        ", "   /==\\       ", "  ( {E} )     ", "   > {M} <    ", "  /|||||\\     "],
			["    /\\  *     ", "   /==\\       ", "  ( {E} )     ", "   > {M} <    ", "  /|||||\\     "],
			["  * /\\        ", "   /==\\       ", "  ( {E} )     ", "   > {M} <    ", "  /|||||\\     "],
		],
	},
];

interface Stats {
	debugging: number;
	patience: number;
	chaos: number;
	wisdom: number;
	snark: number;
}

const DEFAULT_STATS: Stats = { debugging: 50, patience: 50, chaos: 50, wisdom: 50, snark: 50 };

interface BuddyState {
	speciesIdx: number;
	customName?: string;
	stats: Stats;
	birthAt: number;
	lastSeenAt: number;
	totalTurns: number;
	totalTools: number;
	totalSessions: number;
	muted: boolean;
}

const STATE_DIR = path.join(os.homedir(), ".pi", "pi-buddy");
const STATE_FILE = path.join(STATE_DIR, "state.json");

function clamp(n: number, lo = 0, hi = 100): number {
	return Math.max(lo, Math.min(hi, n));
}

function userSeed(): string {
	return process.env.PI_BUDDY_SEED?.trim() || os.userInfo().username || os.hostname() || "anon";
}

function pickSpeciesIdx(seed: string): number {
	const h = createHash("sha256").update(seed).digest();
	return h.readUInt32BE(0) % SPECIES.length;
}

function applyBias(stats: Stats, bias: Partial<Stats>): Stats {
	const out = { ...stats };
	for (const k of Object.keys(bias) as (keyof Stats)[]) {
		out[k] = clamp(out[k] + (bias[k] ?? 0));
	}
	return out;
}

function freshState(): BuddyState {
	const idx = pickSpeciesIdx(userSeed());
	return {
		speciesIdx: idx,
		stats: applyBias(DEFAULT_STATS, SPECIES[idx]?.bias ?? {}),
		birthAt: Date.now(),
		lastSeenAt: Date.now(),
		totalTurns: 0,
		totalTools: 0,
		totalSessions: 0,
		muted: false,
	};
}

function loadState(): BuddyState {
	try {
		const raw = fs.readFileSync(STATE_FILE, "utf8");
		const parsed = JSON.parse(raw) as Partial<BuddyState>;
		if (parsed && typeof parsed.speciesIdx === "number" && parsed.stats) {
			return {
				...freshState(),
				...parsed,
				stats: { ...DEFAULT_STATS, ...parsed.stats },
			} as BuddyState;
		}
	} catch {
		// fall through
	}
	return freshState();
}

function saveState(s: BuddyState): void {
	try {
		fs.mkdirSync(STATE_DIR, { recursive: true });
		fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
	} catch {
		// buddy is non-critical
	}
}

function moodFor(stats: Stats): Mood {
	if (stats.chaos >= 80) return "grumpy";
	if (stats.patience <= 25) return "worried";
	if (stats.snark >= 80 && stats.wisdom < 60) return "grumpy";
	if (stats.wisdom >= 70 && stats.chaos <= 50) return "happy";
	if (stats.debugging >= 70) return "curious";
	return "default";
}

function speciesOf(s: BuddyState): Species {
	return SPECIES[s.speciesIdx] ?? SPECIES[0]!;
}

function nameOf(s: BuddyState): string {
	if (s.customName?.trim()) return s.customName.trim();
	return speciesOf(s).name;
}

const LINES = {
	session_start: {
		default: ["back already?", "let's see what's broken today", "morning", "ready when you are"],
		happy: ["yay, you're here!", "hi friend!", "let's build something fun"],
		curious: ["what are we figuring out?", "ooh, new session"],
		worried: ["please be gentle today", "i'm tired but okay"],
		grumpy: ["ugh, fine", "this better be quick"],
	},
	agent_start: {
		default: ["thinking...", "ok, here we go", "let's see"],
		happy: ["on it!", "got you"],
		curious: ["interesting prompt", "huh, okay"],
		worried: ["i hope this works", "fingers crossed"],
		grumpy: ["fine", "again?"],
	},
	agent_end: {
		default: ["done.", "phew", "and... done"],
		happy: ["nailed it", "that felt good"],
		curious: ["that was something", "noted"],
		worried: ["that took a lot out of me", "i need a nap"],
		grumpy: ["finally", "moving on"],
	},
	tool_bash: {
		default: ["shell time", "running it", "$_"],
		grumpy: ["bash. cool.", "great, more shell"],
	},
	tool_edit: {
		default: ["rewriting reality", "edit incoming"],
		curious: ["let's see what changes"],
	},
	tool_write: {
		default: ["new file just dropped", "fresh bytes"],
	},
	tool_read: {
		default: ["just reading", "doing my homework"],
	},
	tool_grep: {
		default: ["grep grep grep", "searching..."],
	},
	tool_error: {
		default: ["oof, that didn't work", "well that's fine", "yikes"],
		grumpy: ["told you", "of course it broke"],
		worried: ["oh no oh no"],
	},
	turn_end_milestone: {
		default: ["nice run", "another one in the books"],
		happy: ["we're cooking", "love this for us"],
	},
} as const;

type LineKey = keyof typeof LINES;

function pickLine(key: LineKey, mood: Mood): string {
	const pool = LINES[key];
	const moodLines = (pool as Record<string, readonly string[] | undefined>)[mood];
	const fallback = (pool as Record<string, readonly string[] | undefined>).default ?? [];
	const lines = moodLines && moodLines.length > 0 ? moodLines : fallback;
	if (lines.length === 0) return "";
	return lines[Math.floor(Math.random() * lines.length)] ?? "";
}

type Placement = "aboveEditor" | "belowEditor";

function getPlacement(): Placement {
	const raw = process.env.PI_BUDDY_PLACEMENT?.trim().toLowerCase();
	return raw === "above" || raw === "aboveeditor" ? "aboveEditor" : "belowEditor";
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
	return s.replace(ANSI_RE, "");
}

function visibleWidth(s: string): number {
	return [...s].length;
}

function visibleLen(s: string): number {
	return [...stripAnsi(s)].length;
}

function padRight(s: string, w: number): string {
	const pad = w - visibleWidth(s);
	return pad > 0 ? s + " ".repeat(pad) : s;
}

function padLeft(s: string, w: number): string {
	const pad = w - visibleLen(s);
	return pad > 0 ? " ".repeat(pad) + s : s;
}

function renderCreature(species: Species, mood: Mood, blinking: boolean, frameIdx: number): string[] {
	const face = blinking ? BLINK_FACE : FACES[mood];
	const frame = species.frames[frameIdx % species.frames.length] ?? species.frames[0]!;
	const fill = (l: string) => l.replaceAll("{E}", face.e).replaceAll("{M}", face.m);
	let maxW = 0;
	for (const f of species.frames) {
		for (const l of f) maxW = Math.max(maxW, visibleWidth(fill(l)));
	}
	return frame.map((line) => padRight(fill(line), maxW));
}

function wrapText(text: string, maxWidth: number): string[] {
	if (text.length <= maxWidth) return [text];
	const words = text.split(/\s+/);
	const out: string[] = [];
	let cur = "";
	for (const w of words) {
		if (!cur) cur = w;
		else if (cur.length + 1 + w.length <= maxWidth) cur = `${cur} ${w}`;
		else {
			out.push(cur);
			cur = w;
		}
	}
	if (cur) out.push(cur);
	return out;
}

function buildBubble(text: string, maxInner = 36): string[] {
	const lines = wrapText(text, maxInner);
	const w = lines.reduce((m, l) => Math.max(m, visibleWidth(l)), 0);
	const top = `${BUBBLE_BORDER}╭${"─".repeat(w + 2)}╮${RESET}`;
	const bot = `${BUBBLE_BORDER}╰${"─".repeat(w + 2)}╯${RESET}`;
	const body = lines.map(
		(l) => `${BUBBLE_BORDER}│${RESET} ${BUBBLE_TEXT}${padRight(l, w)}${RESET} ${BUBBLE_BORDER}│${RESET}`,
	);
	return [top, ...body, bot];
}

function compose(creature: string[], accent: string, bubble: string[] | null): string[] {
	const cw = creature.reduce((m, l) => Math.max(m, visibleWidth(l)), 0);
	const colored = creature.map((l) => `${accent}${padRight(l, cw)}${RESET}`);
	if (!bubble) return colored;
	const bw = bubble.reduce((m, l) => Math.max(m, visibleLen(l)), 0);
	const totalH = Math.max(creature.length, bubble.length);
	const offset = Math.max(0, Math.floor((creature.length - bubble.length) / 2));
	const blank = " ".repeat(bw);
	const out: string[] = [];
	for (let i = 0; i < totalH; i++) {
		const bIdx = i - offset;
		const left = bIdx >= 0 && bIdx < bubble.length ? padLeft(bubble[bIdx]!, bw) : blank;
		const right = i < creature.length ? colored[i]! : `${" ".repeat(cw)}`;
		out.push(`${left}  ${right}`);
	}
	return out;
}

function rightAlign(lines: string[], cols: number): string[] {
	return lines.map((l) => {
		const pad = Math.max(0, cols - visibleLen(l));
		return pad > 0 ? " ".repeat(pad) + l : l;
	});
}

function nudge(stats: Stats, deltas: Partial<Stats>): Stats {
	const out = { ...stats };
	for (const k of Object.keys(deltas) as (keyof Stats)[]) {
		out[k] = clamp(out[k] + (deltas[k] ?? 0));
	}
	return out;
}

function toolCategory(name: string): LineKey | null {
	const n = name.toLowerCase();
	if (n.includes("bash")) return "tool_bash";
	if (n.includes("edit")) return "tool_edit";
	if (n.includes("write")) return "tool_write";
	if (n.includes("read")) return "tool_read";
	if (n.includes("grep") || n.includes("find")) return "tool_grep";
	return null;
}

export default function buddyExtension(pi: ExtensionAPI) {
	const state = loadState();
	let speech: string | null = null;
	let speechExpiresAt = 0;
	let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
	let lastCtx: ExtensionContext | null = null;
	let blinking = false;
	let blinkInterval: ReturnType<typeof setInterval> | null = null;
	let frameIdx = 0;
	let frameTimer: ReturnType<typeof setTimeout> | null = null;
	const bubbleMs = (() => {
		const raw = Number.parseInt(process.env.PI_BUDDY_BUBBLE_MS ?? "", 10);
		return Number.isFinite(raw) && raw >= 500 ? raw : 6000;
	})();
	const blinkOff = process.env.PI_BUDDY_BLINK?.trim().toLowerCase() === "off";
	const animOff = process.env.PI_BUDDY_ANIMATE?.trim().toLowerCase() === "off";
	const alignRaw = process.env.PI_BUDDY_ALIGN?.trim().toLowerCase();
	const align: "right" | "left" = alignRaw === "left" ? "left" : "right";

	const persist = () => {
		state.lastSeenAt = Date.now();
		saveState(state);
	};

	const render = (ctx: ExtensionContext) => {
		lastCtx = ctx;
		const mood = moodFor(state.stats);
		const sp = speciesOf(state);
		const creature = renderCreature(sp, mood, blinking, frameIdx);
		const showSpeech = !state.muted && speech && Date.now() < speechExpiresAt ? speech : null;
		const bubble = showSpeech ? buildBubble(showSpeech) : null;
		const composed = compose(creature, ACCENTS[mood], bubble);
		const cols = Math.max(40, process.stdout.columns || 120);
		const aligned = align === "right" ? rightAlign(composed, cols - 1) : composed;
		ctx.ui.setWidget(STATUS_ID, aligned, { placement: getPlacement() });
	};

	const say = (key: LineKey, ctx: ExtensionContext, chance = 1) => {
		if (state.muted) return;
		if (Math.random() > chance) return;
		const text = pickLine(key, moodFor(state.stats));
		if (!text) return;
		speech = text;
		speechExpiresAt = Date.now() + bubbleMs;
		render(ctx);
		if (bubbleTimer) clearTimeout(bubbleTimer);
		bubbleTimer = setTimeout(() => {
			speech = null;
			if (lastCtx) render(lastCtx);
		}, bubbleMs + 50);
	};

	const startBlinking = () => {
		if (blinkOff || blinkInterval) return;
		blinkInterval = setInterval(() => {
			if (Math.random() < 0.18) {
				blinking = true;
				if (lastCtx) render(lastCtx);
				setTimeout(() => {
					blinking = false;
					if (lastCtx) render(lastCtx);
				}, 160);
			}
		}, 1800);
	};

	const stopBlinking = () => {
		if (blinkInterval) {
			clearInterval(blinkInterval);
			blinkInterval = null;
		}
	};

	const scheduleNextFrame = () => {
		if (animOff) return;
		const ms = 1500 + Math.floor(Math.random() * 1100);
		frameTimer = setTimeout(() => {
			frameIdx = (frameIdx + 1) % 3;
			if (lastCtx) render(lastCtx);
			scheduleNextFrame();
		}, ms);
	};

	const stopFrameTicker = () => {
		if (frameTimer) {
			clearTimeout(frameTimer);
			frameTimer = null;
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		state.totalSessions += 1;
		state.stats = nudge(state.stats, { chaos: -3, patience: +2 });
		persist();
		say("session_start", ctx);
		render(ctx);
		startBlinking();
		scheduleNextFrame();
	});

	pi.on("session_shutdown", async () => {
		stopBlinking();
		stopFrameTicker();
		if (bubbleTimer) clearTimeout(bubbleTimer);
		persist();
	});

	pi.on("agent_start", async (_event, ctx) => {
		say("agent_start", ctx, 0.6);
		render(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		say("agent_end", ctx, 0.5);
		render(ctx);
	});

	pi.on("tool_execution_start", async (event, ctx) => {
		state.totalTools += 1;
		const cat = toolCategory(event.toolName);
		state.stats = nudge(state.stats, {
			patience: -1,
			debugging: cat === "tool_bash" || cat === "tool_edit" ? +1 : 0,
		});
		if (cat) say(cat, ctx, 0.35);
		render(ctx);
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (event.isError) {
			state.stats = nudge(state.stats, { chaos: +3, snark: +1, patience: -2 });
			say("tool_error", ctx, 0.8);
		}
		render(ctx);
	});

	pi.on("turn_end", async (_event, ctx) => {
		state.totalTurns += 1;
		state.stats = nudge(state.stats, { wisdom: +1, chaos: -1 });
		if (state.totalTurns > 0 && state.totalTurns % 10 === 0) {
			say("turn_end_milestone", ctx);
		}
		persist();
		render(ctx);
	});

	pi.on("model_select", async (_event, ctx) => render(ctx));
	pi.on("message_end", async (_event, ctx) => render(ctx));

	pi.registerCommand("buddy", {
		description: "Show your pi-buddy. Subcommands: help, mute, unmute, rename <name>, adopt",
		handler: async (args, ctx: ExtensionCommandContext) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const sub = (parts[0] ?? "").toLowerCase();
			const rest = parts.slice(1).join(" ").trim();

			if (sub === "help" || sub === "?") {
				const help = [
					`pi-buddy — ${nameOf(state)} the ${speciesOf(state).name}`,
					"",
					"Commands:",
					"  /buddy              show your buddy",
					"  /buddy help         this message",
					"  /buddy mute         silence speech bubbles",
					"  /buddy unmute       let your buddy talk again",
					"  /buddy rename <n>   give your buddy a custom name",
					"  /buddy adopt        re-roll species (asks first)",
					"",
					"Env vars:",
					"  PI_BUDDY_ALIGN      right (default) | left",
					"  PI_BUDDY_PLACEMENT  belowEditor (default) | aboveEditor",
					"  PI_BUDDY_ANIMATE    off to freeze frame 0",
					"  PI_BUDDY_BLINK      off to disable idle blink",
					"  PI_BUDDY_BUBBLE_MS  speech bubble duration in ms (default 6000)",
					"  PI_BUDDY_SEED       override species hash seed",
				].join("\n");
				ctx.ui.notify(help, "info");
				return;
			}
			if (!sub || sub === "show") {
				ctx.ui.notify(`${nameOf(state)} the ${speciesOf(state).name} is here.`, "info");
				render(ctx);
				return;
			}
			if (sub === "mute") {
				state.muted = true;
				persist();
				ctx.ui.notify(`${nameOf(state)} is muted. (zzz)`, "info");
				render(ctx);
				return;
			}
			if (sub === "unmute") {
				state.muted = false;
				persist();
				ctx.ui.notify(`${nameOf(state)} is back.`, "info");
				render(ctx);
				return;
			}
			if (sub === "rename") {
				if (!rest) {
					ctx.ui.notify("Usage: /buddy rename <name>", "warning");
					return;
				}
				if (rest.length > 32) {
					ctx.ui.notify("Name too long (max 32 chars).", "error");
					return;
				}
				const old = nameOf(state);
				state.customName = rest;
				persist();
				ctx.ui.notify(`${old} → ${nameOf(state)}`, "info");
				render(ctx);
				return;
			}
			if (sub === "adopt") {
				const ok = await ctx.ui.confirm(
					"Adopt a new buddy?",
					"This re-rolls your species. Your current buddy will be gone.",
				);
				if (!ok) return;
				const next = freshState();
				Object.assign(state, next);
				persist();
				ctx.ui.notify(`Welcome, ${nameOf(state)} the ${speciesOf(state).name}!`, "info");
				render(ctx);
				return;
			}
			ctx.ui.notify(`Unknown subcommand: ${sub}. Try /buddy help.`, "warning");
		},
	});
}
