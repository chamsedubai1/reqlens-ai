// Built-in starter templates for the New Story form. Selecting one prefills the
// text fields (project/domain are chosen by the user). Purely client-side.
export type StoryTemplateFields = {
  title: string;
  userRole: string;
  goal: string;
  businessValue: string;
  description: string;
  acceptanceCriteria: string;
  businessRules: string;
  edgeCases: string;
};

export type StoryTemplate = {
  id: string;
  name: string;
  description: string;
  fields: StoryTemplateFields;
};

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: "fund-transfer",
    name: "Fund transfer",
    description: "Move money to a saved beneficiary with limits & OTP.",
    fields: {
      title: "Transfer money to a saved beneficiary",
      userRole: "Retail banking customer",
      goal: "transfer money to one of my saved beneficiaries",
      businessValue: "payments are fast, secure, and require no manual steps",
      description:
        "As a retail banking customer, I want to transfer money to a saved beneficiary so that the funds are credited securely and instantly.",
      acceptanceCriteria:
        "- User can select a beneficiary from the saved list\n- User can enter an amount and see applicable fees\n- Transfer is confirmed with OTP or biometric authentication\n- A success message with a transaction reference is shown",
      businessRules:
        "- Transfers above 50,000 require additional OTP verification\n- Daily transfer limit per user is 200,000",
      edgeCases:
        "- Beneficiary account is inactive or closed\n- User exceeds the daily transfer limit\n- Network failure mid-transaction",
    },
  },
  {
    id: "biometric-login",
    name: "Biometric login",
    description: "Let users sign in with fingerprint / face ID.",
    fields: {
      title: "Log in with biometric authentication",
      userRole: "Mobile app user",
      goal: "sign in using my fingerprint or face ID",
      businessValue: "I can access my account quickly without typing a password",
      description:
        "As a mobile app user, I want to log in with biometric authentication so that access is fast and secure.",
      acceptanceCriteria:
        "- User can enable biometric login from settings\n- On launch, the app offers biometric sign-in\n- Falling back to password is always available",
      businessRules:
        "- Biometric data never leaves the device\n- After 3 failed attempts, require password",
      edgeCases:
        "- Device has no biometric hardware\n- Biometrics changed/reset on the device",
    },
  },
  {
    id: "blank-invest",
    name: "Blank INVEST story",
    description: "An empty, well-structured starting point.",
    fields: {
      title: "",
      userRole: "",
      goal: "",
      businessValue: "",
      description: "As a <role>, I want <capability> so that <benefit>.",
      acceptanceCriteria:
        "- Given <context>, when <action>, then <outcome>\n- The system validates required fields and shows clear errors",
      businessRules: "",
      edgeCases: "- What happens on invalid or missing input?\n- What happens when a limit is exceeded?",
    },
  },
];
