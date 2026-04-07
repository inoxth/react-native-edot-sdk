#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface HookInput {
	session_id: string;
	transcript_path: string;
	cwd: string;
	permission_mode: string;
	prompt: string;
}

interface PromptTriggers {
	keywords?: string[];
	intentPatterns?: string[];
}

interface SkillRule {
	type: "guardrail" | "domain";
	enforcement: "block" | "suggest" | "warn";
	priority: "critical" | "high" | "medium" | "low";
	promptTriggers?: PromptTriggers;
}

interface SkillRules {
	version: string;
	skills: Record<string, SkillRule>;
}

interface MatchedSkill {
	name: string;
	matchType: "keyword" | "intent";
	config: SkillRule;
}

async function main() {
	try {
		// Read input from stdin
		const input = readFileSync(0, "utf-8");
		const data = JSON.parse(input) as HookInput;
		const prompt = data.prompt.toLowerCase();

		// Load skill rules
		const projectDir = process.env.CLAUDE_PROJECT_DIR || "$HOME/project";
		const rulesPath = join(projectDir, ".claude", "skills", "skill-rules.json");

		if (!existsSync(rulesPath)) {
			process.exit(0);
		}

		const rules = JSON.parse(readFileSync(rulesPath, "utf-8")) as SkillRules;

		const matchedSkills: MatchedSkill[] = [];

		// Check each skill for matches
		for (const [skillName, config] of Object.entries(rules.skills)) {
			const triggers = config.promptTriggers;
			if (!triggers) {
				continue;
			}

			// Keyword matching
			if (triggers.keywords) {
				const keywordMatch = triggers.keywords.some((kw) => prompt.includes(kw.toLowerCase()));
				if (keywordMatch) {
					matchedSkills.push({ name: skillName, matchType: "keyword", config });
					continue;
				}
			}

			// Intent pattern matching
			if (triggers.intentPatterns) {
				const intentMatch = triggers.intentPatterns.some((pattern) => {
					const regex = new RegExp(pattern, "i");
					return regex.test(prompt);
				});
				if (intentMatch) {
					matchedSkills.push({ name: skillName, matchType: "intent", config });
				}
			}
		}

		if (matchedSkills.length > 0) {
			const skillNames = matchedSkills.map((s) => s.name);
			const skillList = skillNames.map((n) => `- ${n}`).join("\n");

			const output = `<important if="you are about to respond to the user's prompt">
The following skills matched the user's prompt and MUST be loaded using the Skill tool BEFORE generating any other response:
${skillList}

You MUST invoke each matched skill using the Skill tool now. Do NOT skip this step. Do NOT respond to the user's request until all matched skills have been loaded.
</important>`;

			process.stdout.write(output);
		}

		process.exit(0);
	} catch (err) {
		console.error("Error in skill-activation-prompt hook:", err);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("Uncaught error:", err);
	process.exit(1);
});
