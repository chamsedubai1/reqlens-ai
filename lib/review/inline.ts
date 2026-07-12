import type { StoryReview } from "@/lib/db/queries";

// Result of the inline create-and-review server action (rendered in place on the
// New Story page via useActionState — no navigation, so it also sidesteps proxy
// quirks with server-action redirects).
export type InlineReviewState = {
  ok: boolean;
  error?: string;
  mode?: "saved" | "reviewed";
  storyId?: string;
  storyRef?: string;
  review?: StoryReview;
};
