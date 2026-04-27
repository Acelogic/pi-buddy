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
const GRAY = "\x1b[38;5;245m";
const DIM = "\x1b[38;5;239m";
const BUBBLE_BORDER = "\x1b[38;5;250m";
const BUBBLE_TEXT = "\x1b[38;5;253m";
const ACCENTS: Record<Mood, string> = {
	default: "\x1b[38;5;139m", // lavender
	happy: "\x1b[38;5;71m", // green
	curious: "\x1b[38;5;74m", // blue
	worried: "\x1b[38;5;208m", // orange
	grumpy: "\x1b[38;5;196m", // red
};

type Mood = "default" | "happy" | "curious" | "worried" | "grumpy";

interface MoodFace {
	e: string; // 3-char eye row, e.g. "o o"
	m: string; // 1-char mouth, e.g. "—"
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
	frame: readonly string[]; // multi-line, contains {E} and {M} placeholders
}

const SPECIES: Species[] = [
	{
		name: "duck",
		bias: { snark: 6 },
		frame: [
			"    _,_",
			"  (>{E}<)",
			"   ({M})",
			"   /==\\",
			"   ¯¯¯¯",
		],
	},
	{
		name: "penguin",
		bias: { patience: 8 },
		frame: [
			"   .-\"-.",
			"  ( {E} )",
			"  | {M} |",
			"   \\   /",
			"   _\\^/_",
		],
	},
	{
		name: "dragon",
		bias: { chaos: 9, snark: 4 },
		frame: [
			"   /\\___/\\",
			"  ( {E} )=≡≡⌇",
			"   /v{M}v\\",
			"  /(  |  )\\",
			"     ¯  ¯",
		],
	},
	{
		name: "octopus",
		bias: { debugging: 12 },
		frame: [
			"     ___",
			"   ( {E} )",
			"   ( {M} )",
			"   /|||||\\",
			"    ' ' '",
		],
	},
	{
		name: "capybara",
		bias: { patience: 12 },
		frame: [
			"   ,_____,",
			"  ( {E}   )",
			"  (   {M}   )",
			"   m     m",
			"   ¯     ¯",
		],
	},
	{
		name: "axolotl",
		bias: { chaos: 4, wisdom: 4 },
		frame: [
			"   ψ___ψ",
			"  ( {E} )",
			"  ~ {M} ~",
			"  (  |  )",
			"    ¯¯¯",
		],
	},
	{
		name: "cat",
		bias: { snark: 10 },
		frame: [
			"   /\\___/\\",
			"  ( {E} )",
			"   > {M} <",
			"  /(  |  )\\",
			"     ¯  ¯",
		],
	},
	{
		name: "fox",
		bias: { wisdom: 6, snark: 3 },
		frame: [
			"   /\\_/\\",
			"  / {E} \\",
			"   > {M} <",
			"   |≡≡≡|",
			"   '   '",
		],
	},
	{
		name: "owl",
		bias: { wisdom: 12 },
		frame: [
			"   ,___,",
			"  ( {E} )",
			"   ({M}{M})",
			"  )=|=(",
			"    ¯",
		],
	},
	{
		name: "panda",
		bias: { patience: 6 },
		frame: [
			"   ◖___◗",
			"  ( {E} )",
			"  ( {M} )",
			"   '   '",
			"   ¯   ¯",
		],
	},
	{
		name: "raccoon",
		bias: { chaos: 7, debugging: 3 },
		frame: [
			"   /\\_/\\",
			"  /={E}=\\",
			"   ' {M} '",
			"  /|≡≡|\\",
			"    ¯  ¯",
		],
	},
	{
		name: "hedgehog",
		bias: { snark: 4, patience: 4 },
		frame: [
			"  /\\/\\/\\/\\",
			" ( {E}    )",
			"    {M}  ~",
			"  '~~~~~'",
			"    ¯¯¯",
		],
	},
	{
		name: "frog",
		bias: { chaos: 3, wisdom: 4 },
		frame: [
			"   ◖{E}◗",
			"  ( {M} )",
			"   /===\\",
			"  ('   ')",
			"    ¯¯¯",
		],
	},
	{
		name: "hamster",
		bias: { chaos: 6 },
		frame: [
			"   ______",
			"  ( {E}   )",
			"  ( {M}   )",
			"   '||||'",
			"    ¯¯¯¯",
		],
	},
	{
		name: "narwhal",
		bias: { wisdom: 6, snark: 2 },
		frame: [
			"     ____>",
			"  ( {E}   )>══",
			"   ( {M} )",
			"  ~/====\\~",
			"     ¯¯",
		],
	},
	{
		name: "sloth",
		bias: { patience: 14 },
		frame: [
			"   ,-----,",
			"  ( {E}   )",
			"   | {M} |",
			"  /=======\\",
			"   ¯¯¯¯¯¯¯",
		],
	},
	{
		name: "turtle",
		bias: { wisdom: 8, patience: 5 },
		frame: [
			"        ___",
			"   ___( {E} )",
			"  /({M})/\\___>",
			"   |     |",
			"   ¯     ¯",
		],
	},
	{
		name: "unicorn",
		bias: { wisdom: 4, snark: 5, chaos: 3 },
		frame: [
			"     /\\",
			"    /==\\",
			"   ( {E} )",
			"    > {M} <",
			"   /|||||\\",
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

function visibleWidth(s: string): number {
	return [...s].length;
}

function padRight(s: string, w: number): string {
	const pad = w - visibleWidth(s);
	return pad > 0 ? s + " ".repeat(pad) : s;
}

function renderCreature(species: Species, mood: Mood, blinking: boolean): string[] {
	const face = blinking ? BLINK_FACE : FACES[mood];
	return species.frame.map((line) => line.replaceAll("{E}", face.e).replaceAll("{M}", face.m));
}

function wrapText(text: string, maxWidth: number): string[] {
	if (text.length <= maxWidth) return [text];
	const words = text.split(/\s+/);
	const out: string[] = [];
	let cur = "";
	for (const w of words) {
		if (!cur) {
			cur = w;
		} else if (cur.length + 1 + w.length <= maxWidth) {
			cur = `${cur} ${w}`;
		} else {
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
	const totalH = Math.max(creature.length, bubble.length);
	const offset = Math.max(0, Math.floor((creature.length - bubble.length) / 2));
	const out: string[] = [];
	for (let i = 0; i < totalH; i++) {
		const left = i < creature.length ? colored[i]! : `${accent}${" ".repeat(cw)}${RESET}`;
		const bIdx = i - offset;
		const right = bIdx >= 0 && bIdx < bubble.length ? bubble[bIdx]! : "";
		out.push(`${left}   ${right}`);
	}
	return out;
}

function buildHeader(state: BuddyState, mood: Mood): string {
	const sp = speciesOf(state);
	const accent = ACCENTS[mood];
	const moodTag = mood === "default" ? "" : ` ${GRAY}(${mood})${RESET}`;
	const muted = state.muted ? ` ${DIM}[muted]${RESET}` : "";
	return `${accent}${sp.name === nameOf(state) ? sp.name : `${nameOf(state)} the ${sp.name}`}${RESET}${moodTag}${muted}`;
}

function statBar(label: string, val: number): string {
	const width = 14;
	const filled = Math.max(0, Math.min(width, Math.round((val / 100) * width)));
	const bar = `${"█".repeat(filled)}${DIM}${"░".repeat(width - filled)}${RESET}`;
	return `${GRAY}${label.padEnd(10)}${RESET} ${bar} ${val}`;
}

function panel(state: BuddyState, blinking: boolean): string[] {
	const mood = moodFor(state.stats);
	const sp = speciesOf(state);
	const ageDays = Math.max(1, Math.round((Date.now() - state.birthAt) / 86_400_000));
	const creature = renderCreature(sp, mood, blinking);
	const stats = [
		statBar("Debugging", state.stats.debugging),
		statBar("Patience", state.stats.patience),
		statBar("Chaos", state.stats.chaos),
		statBar("Wisdom", state.stats.wisdom),
		statBar("Snark", state.stats.snark),
	];
	const composed = compose(creature, ACCENTS[mood], stats);
	return [
		buildHeader(state, mood),
		`${GRAY}${ageDays}d old · sessions ${state.totalSessions} · turns ${state.totalTurns} · tools ${state.totalTools}${RESET}`,
		...composed,
	];
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
	const bubbleMs = (() => {
		const raw = Number.parseInt(process.env.PI_BUDDY_BUBBLE_MS ?? "", 10);
		return Number.isFinite(raw) && raw >= 500 ? raw : 6000;
	})();
	const blinkOff = process.env.PI_BUDDY_BLINK?.trim().toLowerCase() === "off";

	const persist = () => {
		state.lastSeenAt = Date.now();
		saveState(state);
	};

	const render = (ctx: ExtensionContext) => {
		lastCtx = ctx;
		const mood = moodFor(state.stats);
		const sp = speciesOf(state);
		const creature = renderCreature(sp, mood, blinking);
		const showSpeech = !state.muted && speech && Date.now() < speechExpiresAt ? speech : null;
		const bubble = showSpeech ? buildBubble(showSpeech) : null;
		const composed = compose(creature, ACCENTS[mood], bubble);
		const header = buildHeader(state, mood);
		ctx.ui.setWidget(STATUS_ID, [header, ...composed], { placement: getPlacement() });
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

	pi.on("session_start", async (_event, ctx) => {
		state.totalSessions += 1;
		state.stats = nudge(state.stats, { chaos: -3, patience: +2 });
		persist();
		say("session_start", ctx);
		render(ctx);
		startBlinking();
	});

	pi.on("session_shutdown", async () => {
		stopBlinking();
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
		description: "Show your pi-buddy. Subcommands: stats, mute, unmute, rename <name>, adopt, reset",
		handler: async (args, ctx: ExtensionCommandContext) => {
			const parts = args.trim().split(/\s+/).filter(Boolean);
			const sub = (parts[0] ?? "").toLowerCase();
			const rest = parts.slice(1).join(" ").trim();

			if (!sub || sub === "stats" || sub === "show") {
				ctx.ui.notify(panel(state, blinking).join("\n"), "info");
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
					"This re-rolls your species and resets stats. Your current buddy will be gone.",
				);
				if (!ok) return;
				const next = freshState();
				Object.assign(state, next);
				persist();
				ctx.ui.notify(`Welcome, ${nameOf(state)} the ${speciesOf(state).name}!`, "info");
				render(ctx);
				return;
			}
			if (sub === "reset") {
				const ok = await ctx.ui.confirm(
					"Reset stats?",
					"Stats go back to baseline (with species bias). Species and name are kept.",
				);
				if (!ok) return;
				state.stats = applyBias(DEFAULT_STATS, speciesOf(state).bias);
				persist();
				ctx.ui.notify("Stats reset.", "info");
				render(ctx);
				return;
			}
			ctx.ui.notify(`Unknown subcommand: ${sub}. Try: stats | mute | unmute | rename | adopt | reset`, "warning");
		},
	});
}
