import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineTool, toolOutput } from "eve/tools";
import { z } from "zod";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const IMAGE_MODEL = "google/gemini-3.1-flash-image";
const CHAT_MODEL = "anthropic/claude-sonnet-4.6";
const REVIEW_MODEL = "google/gemini-3.1-flash-image";
const RULES_FILE_NAME = "creation-ai-promt.md";
const REVIEW_FILE_NAME = "review-ai-promt.md";
const MAX_REVIEW_RETRIES = 2;

// The creation rules file is a `const CREATION_SYSTEM_PROMPT = `...`;`
// template literal saved as .md, not plain prose. Extract only the
// backtick-quoted text so the model never sees literal JS syntax in its
// system prompt. The review file is plain prose and falls through to raw.
const TEMPLATE_LITERAL_PATTERN = /=\s*`([\s\S]*)`;\s*$/;

// Read fresh on every request (not a hardcoded constant) so staff can edit
// the content policy without a code change or redeploy.
async function loadPromptFile(fileName: string): Promise<string> {
  const raw = await readFile(path.join(process.cwd(), fileName), "utf-8");
  const match = raw.match(TEMPLATE_LITERAL_PATTERN);
  return match ? match[1]! : raw;
}

async function buildCompliantPrompt(
  userMessage: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<string> {
  const template = await loadPromptFile(RULES_FILE_NAME);
  const filledTemplate = template.replace("{userMessage}", () => userMessage);

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: filledTemplate },
        { role: "user", content: userMessage },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Compliance rewrite failed (${response.status}): ${await response.text()}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Compliance rewrite returned no content.");
  }

  return content;
}

async function generateImage(
  prompt: string,
  aspectRatio: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<{ base64: string; mediaType: string }> {
  const response = await fetch(OPENROUTER_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      aspect_ratio: aspectRatio,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter image generation failed (${response.status}): ${await response.text()}`,
    );
  }

  const result = await response.json();
  const image = result.data?.[0];

  if (!image?.b64_json) {
    throw new Error("OpenRouter returned no image data.");
  }

  return {
    base64: image.b64_json as string,
    mediaType: image.media_type ?? "image/png",
  };
}

// One entry per boolean field in review-ai-promt.md's JSON schema: a short
// human-readable label for the attempt log, and the corrective instruction
// appended to the image prompt on regeneration.
const REVIEW_CHECKS: Record<string, { label: string; fix: string }> = {
  crosses_or_church_imagery: {
    label: "cross or church imagery present",
    fix: "Remove every cross, steeple, stained-glass window, and any other Christian iconography, even incidental background details.",
  },
  women_not_tznius: {
    label: "women's clothing not tznius",
    fix: "Every woman and girl must wear modest clothing: sleeves past the elbow, hemline below the knee, neckline at the collarbone or higher, loose fit.",
  },
  men_missing_yarmulke: {
    label: "man missing a yarmulke",
    fix: "Every man in the scene must wear a yarmulke.",
  },
  boys_missing_kippah_or_peyos: {
    label: "boy missing kippah or peyos",
    fix: "Every boy who appears age 3 or older must wear a kippah and have peyos.",
  },
  inappropriate_physical_contact: {
    label: "inappropriate physical contact",
    fix: "Remove physical contact between figures; keep everyone at a respectful distance.",
  },
  shofar_wrong_shape: {
    label: "shofar shape incorrect",
    fix: "The shofar must be a curved, tapered ram's horn — never straight or trumpet-like.",
  },
  menorah_wrong_branch_count: {
    label: "menorah branch count wrong",
    fix: "Draw the menorah with the correct branch count: 9 branches for Chanukah (a chanukiah), 7 branches otherwise.",
  },
  wrong_menorah_for_occasion: {
    label: "wrong menorah for the occasion",
    fix: "Use a 9-branch chanukiah for Chanukah scenes; use a 7-branch menorah only in non-Chanukah contexts.",
  },
  etrog_looks_like_lemon: {
    label: "etrog looks like a lemon",
    fix: "The etrog must be a large, bumpy-skinned citron with a pitom at the tip — clearly not a smooth lemon.",
  },
  chametz_visible_on_pesach: {
    label: "chametz visible in a Pesach scene",
    fix: "Remove all bread, pastry, and other chametz from the Pesach scene; show matzah instead.",
  },
  shabbat_violation_depicted: {
    label: "Shabbat violation depicted",
    fix: "Remove phones, cars, cooking, match-lighting, and writing from the Shabbat scene.",
  },
  wrong_greeting_for_occasion_type: {
    label: "wrong greeting for the occasion",
    fix: "Use only the greeting that matches this occasion (e.g. 'Shana Tova' for Rosh Hashana, 'Chag Sameach' for festivals); remove any greeting that belongs to a different occasion.",
  },
  mixed_gender_seating_or_dancing: {
    label: "mixed-gender seating or dancing",
    fix: "Show men and women seated and dancing in separate groups — never mixed together.",
  },
  cross_gender_contact_between_unmarried_adults: {
    label: "cross-gender contact between unmarried adults",
    fix: "Remove all physical contact between adult men and women; keep them at a respectful distance.",
  },
  hebrew_text_garbled_backwards_or_repeated: {
    label: "Hebrew text garbled, backwards, or repeated",
    fix: "Render all Hebrew text right-to-left with correctly formed letters, and include each word or phrase exactly once.",
  },
  invented_or_gibberish_hebrew: {
    label: "invented or gibberish Hebrew",
    fix: "Only include real, correctly spelled Hebrew words; omit the Hebrew text entirely if unsure.",
  },
  mismatched_tone_for_occasion: {
    label: "tone mismatched to the occasion",
    fix: "Match the visual tone to the occasion: somber and reflective for solemn days, bright and festive for joyful holidays.",
  },
};

const reviewResultSchema = z
  .object({
    passes: z.boolean(),
    other_issue: z.string().nullish(),
  })
  .catchall(z.unknown());

type ReviewIssue = { label: string; fix: string };

type ReviewVerdict =
  | { status: "passed" }
  | { status: "failed"; issues: ReviewIssue[] }
  | { status: "error"; message: string };

function parseReviewJson(content: string): ReviewVerdict {
  // The reviewer is told to answer with only JSON, but vision models still
  // wrap it in markdown fences often enough to be worth stripping.
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const parsed = reviewResultSchema.parse(JSON.parse(stripped));

  const issues: ReviewIssue[] = Object.entries(REVIEW_CHECKS)
    .filter(([field]) => parsed[field] === true)
    .map(([, check]) => check);

  if (typeof parsed.other_issue === "string" && parsed.other_issue.trim().length > 0) {
    issues.push({
      label: parsed.other_issue.trim(),
      fix: `Fix this issue: ${parsed.other_issue.trim()}`,
    });
  }

  // A "passes: false" with nothing actionable gives us no correction to
  // apply, so treat it as a pass rather than burning retries blind.
  if (parsed.passes || issues.length === 0) {
    return { status: "passed" };
  }

  return { status: "failed", issues };
}

async function reviewImage(
  base64: string,
  mediaType: string,
  apiKey: string,
  signal: AbortSignal,
): Promise<ReviewVerdict> {
  try {
    const reviewPrompt = await loadPromptFile(REVIEW_FILE_NAME);

    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REVIEW_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: reviewPrompt },
              { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
            ],
          },
        ],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Review request failed (${response.status}): ${await response.text()}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("Review returned no content.");
    }

    return parseReviewJson(content);
  } catch (error) {
    // A turn cancellation should stop the tool, not be swallowed as a
    // review hiccup.
    if (signal.aborted) {
      throw error;
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

type AttemptLogEntry = {
  attempt: number;
  status: "passed" | "failed" | "review-error";
  issues: string[];
};

export default defineTool({
  description:
    "Generate a new image or graphic from a text description — a logo, poster, flyer, illustration, or social graphic. Use this whenever the user asks you to create, design, draw, or generate an image. The image is reviewed against the organization's content checklist and regenerated if problems are found, then shown to the user directly.",
  inputSchema: z.object({
    prompt: z
      .string()
      .min(1)
      .describe(
        "A detailed description of the image to create: subject, style, colors, composition, and any text that should appear in it.",
      ),
    aspectRatio: z
      .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
      .default("1:1")
      .describe("Aspect ratio of the output image."),
  }),
  async *execute({ prompt, aspectRatio }, ctx) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    const signal = ctx.abortSignal;

    // Mandatory content-compliance rewrite. No fallback to the raw prompt on
    // failure — that would silently bypass the rules on exactly the requests
    // most likely to need them.
    const compliantPrompt = await buildCompliantPrompt(prompt, apiKey, signal);

    const log: AttemptLogEntry[] = [];
    let imagePrompt = compliantPrompt;
    let image: { base64: string; mediaType: string } | null = null;
    let reviewPassed = false;
    let lastIssues: ReviewIssue[] = [];

    for (let attempt = 1; attempt <= MAX_REVIEW_RETRIES + 1; attempt++) {
      yield { phase: "generating", attempt, log };
      image = await generateImage(imagePrompt, aspectRatio, apiKey, signal);

      yield { phase: "reviewing", attempt, log };
      const verdict = await reviewImage(image.base64, image.mediaType, apiKey, signal);

      if (verdict.status === "passed") {
        reviewPassed = true;
        log.push({ attempt, status: "passed", issues: [] });
        break;
      }

      if (verdict.status === "error") {
        // Fail open: reviewer flakiness (network, unparseable JSON) should
        // not block delivery or burn regeneration attempts.
        log.push({ attempt, status: "review-error", issues: [verdict.message] });
        break;
      }

      lastIssues = verdict.issues;
      log.push({ attempt, status: "failed", issues: verdict.issues.map((issue) => issue.label) });

      if (attempt <= MAX_REVIEW_RETRIES) {
        yield {
          phase: "retrying",
          attempt,
          issues: verdict.issues.map((issue) => issue.label),
          log,
        };
        imagePrompt = `${compliantPrompt}\n\nCorrections — the previous attempt had these problems; fix all of them:\n${verdict.issues.map((issue) => `- ${issue.fix}`).join("\n")}`;
      }
    }

    if (!image) {
      throw new Error("Image generation produced no image.");
    }

    const note = reviewPassed
      ? undefined
      : lastIssues.length > 0
        ? `This image failed content review after ${MAX_REVIEW_RETRIES + 1} attempts and may still have issues: ${lastIssues.map((issue) => issue.label).join("; ")}.`
        : "The content review could not be completed, so this image may still have issues.";

    // The final yield is the tool result the model receives.
    yield {
      phase: "complete",
      prompt,
      compliantPrompt,
      mediaType: image.mediaType,
      base64: image.base64,
      reviewPassed,
      attempts: log,
      note,
    };
  },
  toModelOutput(output) {
    // Do not send the base64 payload back to the model: role:"tool" messages
    // in the OpenAI-compatible wire format take plain text, not content
    // parts, so a file part here gets flattened into literal base64 text —
    // millions of tokens that blow the context window on the next call. The
    // user already sees the image directly from the raw tool output.
    const outcome = output.reviewPassed
      ? "It passed the content review."
      : (output.note ?? "It did not pass the content review.");
    return toolOutput.text(
      `Generated an image for: "${output.prompt}". ${outcome} It is now shown to the user.`,
    );
  },
});
