import { connection } from "next/server";
import { PageHeader } from "@/components/account/ui";
import { MobileCard } from "@/components/account/profile/MobileCard";
import { PersonalCard } from "@/components/account/profile/PersonalCard";
import { PreferencesCard } from "@/components/account/profile/PreferencesCard";
import { PrivacyCard } from "@/components/account/profile/PrivacyCard";
import { SessionsCard } from "@/components/account/profile/SessionsCard";
import { VerifyEmailBanner } from "@/components/account/profile/VerifyEmailBanner";
import { relativeTime } from "@/components/account/profile/time";
import { getAccountShell } from "@/lib/server/account";
import {
  getProfile,
  listSessions,
  touchCurrentSession,
} from "@/lib/server/account-profile";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = {
  title: "Profile & security",
  robots: { index: false },
};
// Per-session data: render per request (the layout opt-out does not cover sibling pages).
export const instant = false;

const istToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/** IST "YYYY-MM-DD HH:MM:SS" + 7 days, formatted. */
function plus7Days(raw: string) {
  const d = new Date(`${raw.replace(" ", "T")}+05:30`);
  return formatDateTime(new Date(d.getTime() + 7 * 86400000), { time: false });
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const shell = await getAccountShell();
  if (!shell) return null; // layout redirects
  const id = shell.customer.id;
  await touchCurrentSession(id);
  const [profile, sessions, params] = await Promise.all([
    getProfile(id),
    listSessions(id),
    searchParams,
  ]);
  if (!profile) return null;
  const verify = typeof params.verify === "string" ? params.verify : "";

  return (
    <>
      <PageHeader
        eyebrow="प्रोफ़ाइल"
        title="Profile & security"
        subtitle="Your details, login, messages and privacy."
      />
      <div className="space-y-4 md:space-y-5">
        {verify && !profile.emailVerified && (
          <VerifyEmailBanner token={verify} email={profile.email} />
        )}
        <PersonalCard
          initial={{
            name: profile.name,
            email: profile.email,
            dob: profile.dob ?? "",
            gender: profile.gender ?? "",
          }}
          emailVerified={profile.emailVerified}
          today={istToday()}
        />
        <MobileCard
          phone={profile.phone}
          lastLogin={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : null}
        />
        <PreferencesCard
          initial={profile.prefs}
          language={profile.language}
          hasEmail={Boolean(profile.email)}
        />
        <SessionsCard
          sessions={sessions.map((s) => ({
            id: s.id,
            device: s.device,
            browser: s.browser,
            os: s.os,
            city: s.city,
            active: relativeTime(s.lastActive),
            signedIn: formatDateTime(s.createdAt, { time: false }),
            current: s.current,
          }))}
        />
        <PrivacyCard
          phone={profile.phone}
          deleteOn={profile.deleteRequestedAt ? plus7Days(profile.deleteRequestedAt) : null}
        />
      </div>
    </>
  );
}
