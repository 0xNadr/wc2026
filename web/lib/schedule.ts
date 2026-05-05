export type ScheduleMatch = {
  match: number;
  stage: string;
  group: string | null;
  venue: string;
  city: string;
  venueTz: string;
  kickoffUtc: string;
  home: string;
  away: string;
  homeGroup: string | null;
  awayGroup: string | null;
};

export type Schedule = {
  generatedAt: string;
  matches: ScheduleMatch[];
};

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
  { value: "Africa/Cairo", label: "Cairo (EET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Vancouver", label: "Vancouver (PT)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "UTC", label: "UTC" },
];
