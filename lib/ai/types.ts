export type ReviewStoryFields = {
  title: string;
  userRole: string;
  goal: string;
  businessValue: string;
  description: string;
  acceptanceCriteria?: string | null;
  businessRules?: string | null;
  edgeCases?: string | null;
};

export type ReviewInput = {
  story: ReviewStoryFields;
  domain: { name: string; description?: string | null };
  documents: { title: string; contentText: string }[];
};
