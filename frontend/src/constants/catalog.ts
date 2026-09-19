export type ServiceType = "mobile" | "dth" | "electricity" | "broadband";

export type Operator = {
  id: string;
  name: string;
  short: string; // 2-3 letter avatar text
  color: string; // brand color for avatar
};

export type Plan = {
  amount: number;
  validity: string;
  desc: string;
};

export const SERVICES: {
  type: ServiceType;
  label: string;
  icon: "mobile" | "dth" | "electricity" | "broadband";
  accountLabel: string;
  accountPlaceholder: string;
  keyboard: "phone-pad" | "number-pad";
  needsBillFetch: boolean;
  hasPlans: boolean;
}[] = [
  {
    type: "mobile",
    label: "Mobile Recharge",
    icon: "mobile",
    accountLabel: "Mobile Number",
    accountPlaceholder: "Enter 10-digit mobile number",
    keyboard: "phone-pad",
    needsBillFetch: false,
    hasPlans: true,
  },
  {
    type: "dth",
    label: "DTH Recharge",
    icon: "dth",
    accountLabel: "Subscriber / VC Number",
    accountPlaceholder: "Enter subscriber number",
    keyboard: "number-pad",
    needsBillFetch: false,
    hasPlans: true,
  },
  {
    type: "electricity",
    label: "Electricity Bill",
    icon: "electricity",
    accountLabel: "Consumer Number",
    accountPlaceholder: "Enter consumer number",
    keyboard: "number-pad",
    needsBillFetch: true,
    hasPlans: false,
  },
  {
    type: "broadband",
    label: "Broadband Bill",
    icon: "broadband",
    accountLabel: "Account / User ID",
    accountPlaceholder: "Enter account ID",
    keyboard: "number-pad",
    needsBillFetch: true,
    hasPlans: false,
  },
];

export const OPERATORS: Record<ServiceType, Operator[]> = {
  mobile: [
    { id: "jio", name: "Jio", short: "Jio", color: "#0F3CC9" },
    { id: "airtel", name: "Airtel", short: "Air", color: "#E40000" },
    { id: "vi", name: "Vi", short: "Vi", color: "#EB1600" },
    { id: "bsnl", name: "BSNL", short: "BS", color: "#0A6B3B" },
  ],
  dth: [
    { id: "tataplay", name: "Tata Play", short: "TP", color: "#E4002B" },
    { id: "dishtv", name: "Dish TV", short: "DT", color: "#F26722" },
    { id: "sundirect", name: "Sun Direct", short: "SD", color: "#C4161C" },
    { id: "airteldth", name: "Airtel Digital TV", short: "AD", color: "#E40000" },
    { id: "d2h", name: "d2h", short: "d2h", color: "#7C3AED" },
  ],
  electricity: [
    { id: "tsspdcl", name: "TSSPDCL (Telangana)", short: "TS", color: "#047857" },
    { id: "tsnpdcl", name: "TSNPDCL (Telangana N)", short: "TN", color: "#0A6B3B" },
    { id: "apspdcl", name: "APSPDCL (AP South)", short: "AP", color: "#B45309" },
    { id: "apepdcl", name: "APEPDCL (AP East)", short: "AE", color: "#D97706" },
    { id: "bescom", name: "BESCOM (Bengaluru)", short: "BE", color: "#1D4ED8" },
    { id: "msedcl", name: "MSEDCL (Maharashtra)", short: "MS", color: "#0891B2" },
    { id: "uppcl", name: "UPPCL (Uttar Pradesh)", short: "UP", color: "#BE185D" },
    { id: "tatapower", name: "Tata Power", short: "TP", color: "#111827" },
  ],
  broadband: [
    { id: "jiofiber", name: "JioFiber", short: "JF", color: "#0F3CC9" },
    { id: "airtelx", name: "Airtel Xstream", short: "AX", color: "#E40000" },
    { id: "bsnlbb", name: "BSNL Broadband", short: "BB", color: "#0A6B3B" },
    { id: "act", name: "ACT Fibernet", short: "ACT", color: "#F26722" },
  ],
};

export const MOBILE_PLANS: Plan[] = [
  { amount: 149, validity: "20 days", desc: "1GB/day • Unlimited calls" },
  { amount: 239, validity: "28 days", desc: "1.5GB/day • 100 SMS/day" },
  { amount: 299, validity: "28 days", desc: "2GB/day • Unlimited calls" },
  { amount: 479, validity: "56 days", desc: "1.5GB/day • Unlimited calls" },
  { amount: 666, validity: "84 days", desc: "1.5GB/day • Unlimited calls" },
  { amount: 999, validity: "84 days", desc: "3GB/day • Unlimited calls" },
];

export const DTH_PLANS: Plan[] = [
  { amount: 199, validity: "1 month", desc: "Hindi Value Pack" },
  { amount: 299, validity: "1 month", desc: "South Special Pack" },
  { amount: 449, validity: "1 month", desc: "Sports + Entertainment" },
  { amount: 599, validity: "1 month", desc: "All Access HD Pack" },
  { amount: 1199, validity: "3 months", desc: "Ultimate HD Pack" },
];

export function plansFor(type: ServiceType): Plan[] {
  if (type === "mobile") return MOBILE_PLANS;
  if (type === "dth") return DTH_PLANS;
  return [];
}
