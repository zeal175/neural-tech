import CheckIn from "@/components/checkin/CheckIn";
import { EVENT } from "@/lib/event";

// Organizer-only door scanner. Not linked from the site and kept out of search engines; the
// data behind it needs the organizer PIN (CHECKIN_PIN).
export const metadata = {
  title: `Check-in · ${EVENT.name}`,
  robots: { index: false, follow: false },
};

export default function CheckInPage() {
  return <CheckIn eventName={EVENT.name} />;
}
