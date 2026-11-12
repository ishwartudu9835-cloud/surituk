import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Policy pages. Written for Indian law as of November 2026:
 * IT Act 2000 + IT (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021 (as amended),
 * Digital Personal Data Protection Act 2023 + DPDP Rules 2025, Copyright Act 1957.
 * Not legal advice — have a lawyer review before relying on it.
 */
const UPDATED = "9 November 2026";

type Section = { title: string; body: React.ReactNode };
type Page = { title: string; intro?: React.ReactNode; sections: Section[] };

function useGrievance() {
  const { data } = useQuery({ queryKey: ["site-info"], queryFn: () => api<{ banner: string; grievance?: { name: string; email: string } }>("/site-info"), staleTime: 5 * 60_000 });
  return data?.grievance ?? { name: "", email: "" };
}

function GrievanceContact() {
  const g = useGrievance();
  return g.email
    ? <span><b>{g.name || "Grievance Officer"}</b>, <a href={`mailto:${g.email}`} className="text-primary underline">{g.email}</a></span>
    : <span>our Grievance Officer (details on the <Link href="/grievance" className="text-primary underline">Grievance page</Link>)</span>;
}

const ul = (items: React.ReactNode[]) => <ul className="list-disc pl-5 space-y-1.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;

const PAGES: Record<string, Page> = {
  about: {
    title: "About Surituk",
    intro: "Surituk is a home for graphic novels and manga made in India — in Hindi, English and every Indian language.",
    sections: [
      { title: "For readers", body: "Read stories by Indian creators, follow the artists you love, rate stories, and join the conversation in Community." },
      { title: "For creators", body: "Publish your series chapter by chapter, build subscribers, talk to your readers with posts and polls, and see how your stories are doing. You keep full ownership of your work." },
      { title: "Our promise", body: "Original work only. We act quickly on copyright complaints and protect creators from people who copy their work." },
    ],
  },

  contact: {
    title: "Contact",
    sections: [
      { title: "Report something on the site", body: <>Use the <b>Report</b> button on any story, chapter, post, comment or profile. It reaches our team directly and you'll get a notification when we act.</> },
      { title: "Complaints, legal and copyright", body: <>Write to <GrievanceContact />. We acknowledge within 24 hours and resolve within 15 days.</> },
      { title: "Creator help", body: <>Creators can reach us from Creator Studio or through the Grievance Officer above.</> },
    ],
  },

  terms: {
    title: "Terms of Use",
    intro: <>These terms are an agreement between you and Surituk. By using Surituk you accept them, along with our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link> and <Link href="/guidelines" className="text-primary underline">Community Guidelines</Link>. Surituk is an intermediary under the Information Technology Act, 2000.</>,
    sections: [
      { title: "Who can use Surituk", body: ul([
        "You must be 18 or older, or use Surituk with the consent of a parent or lawful guardian who accepts these terms for you.",
        "Stories marked 18+ are only for adults who confirm they are 18 or older.",
        "One person, one account. Don't create accounts for someone else or to get around a ban.",
      ]) },
      { title: "Your account", body: ul([
        "Sign in with email or Google. Keep access to your email secure — you're responsible for activity on your account.",
        "You can delete your account from Settings → Account once it is at least 10 days old. Deletion happens after a 10-day cooling-off period so you can change your mind.",
      ]) },
      { title: "Creator accounts", body: ul([
        "Creator and studio accounts are reviewed before they can publish.",
        "You confirm that everything you upload is your own original work, or that you have written permission from the owner.",
        "You keep the copyright in your work. You give Surituk a non-exclusive, worldwide, royalty-free licence to host, display, resize and promote it on Surituk for as long as it is published here. Unpublish or delete it and the licence ends (except for copies we must keep by law).",
        "A creator account can be deleted 15 days or more after it was approved. Deleting it removes all its stories, chapters and posts.",
        "Creator earnings from ads, when the earnings programme is live, follow the Creator Revenue Policy published in Creator Studio.",
      ]) },
      { title: "What's not allowed", body: <>Everything listed in our <Link href="/guidelines" className="text-primary underline">Community Guidelines</Link>, including the content barred by Rule 3(1)(b) of the IT Rules, 2021. We may remove content, restrict features, remove creator access, suspend or ban accounts that break these rules — usually with a notice explaining why. For serious or repeated violations we may permanently delete an account or a creator/studio account, together with its stories and posts, without the usual waiting period; an email removed this way can't be used to sign up again.</> },
      { title: "Copyright complaints", body: <>See our <Link href="/copyright" className="text-primary underline">Copyright Policy</Link>. Repeat infringers lose their creator account (3 strikes).</> },
      { title: "Disclaimers", body: "Surituk is provided as it is. Views in stories and posts belong to their creators, not Surituk. To the extent the law allows, we aren't liable for indirect losses from using the service." },
      { title: "Complaints and disputes", body: <>Contact <GrievanceContact /> first. Indian law applies; courts in India have jurisdiction.</> },
      { title: "Changes", body: "If we change these terms in a way that matters, we'll tell you on the site before the change applies." },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    intro: "This explains what personal data we collect, why, and the rights you have under the Digital Personal Data Protection Act, 2023.",
    sections: [
      { title: "What we collect", body: ul([
        "Account: email, name, username, profile photo, and Google ID if you sign in with Google.",
        "Profile choices: favourite genres, language, and whether you confirmed you are 18 or older.",
        "Activity: stories you read, bookmarks, reading progress, ratings, likes, votes, comments and posts.",
        "Creators: details in your application (legal name, pen or studio name, city, state, social links, mobile number).",
        "Technical: IP address and basic logs, used for security and to stop fake accounts.",
      ]) },
      { title: "Why we use it", body: ul([
        "To run your account and show you stories, progress and recommendations.",
        "To review creator applications and pay creators when earnings are live.",
        "To keep Surituk safe: stop spam and fake accounts, handle reports, and meet legal requests.",
        "We don't sell your personal data.",
      ]) },
      { title: "Who we share it with", body: "Service providers that help us run Surituk (hosting, database, file storage, email delivery, Google sign-in and, when enabled, Google AdSense). They may only use it to provide their service. We share data with authorities only when Indian law requires it." },
      { title: "Your rights", body: ul([
        "See and correct your profile in Settings.",
        "Withdraw consent and delete your account in Settings → Account.",
        "Raise a grievance with our Grievance Officer, and if you're not satisfied, complain to the Data Protection Board of India.",
        "Nominate someone to exercise these rights for you in case of death or incapacity — write to the Grievance Officer.",
      ]) },
      { title: "Deleting your account", body: ul([
        "Ask in Settings → Account and tell us why. Your account must be at least 10 days old. Deletion runs after a 10-day cooling-off period; we remind you 48 hours before. You can cancel until then.",
        "Your profile, library, history, likes, votes and ratings are erased. Comments stay as “Deleted user”.",
        "We keep basic sign-up details for 180 days after deletion, as Rule 3(1)(h) of the IT Rules, 2021 requires, then erase them. Security logs are kept for up to one year where the DPDP Rules require it.",
        "A deletion may be put on hold if there's an open legal or copyright complaint about the account.",
      ]) },
      { title: "Children", body: "Users under 18 need a parent or guardian's consent. We don't show 18+ stories to anyone who hasn't confirmed they're an adult, and we don't target ads at children." },
      { title: "Cookies and storage", body: "We store a sign-in token in your browser so you stay logged in. If ads are enabled, Google may use cookies to show ads; you can manage this in your Google ad settings." },
      { title: "Security", body: "Data is sent over HTTPS, access is limited to the team, and admin actions are recorded in an audit log. If a breach affects you, we'll tell you and the Data Protection Board as the law requires." },
      { title: "Contact", body: <>Questions or requests: <GrievanceContact />.</> },
    ],
  },

  guidelines: {
    title: "Community Guidelines",
    intro: "Surituk is for original Indian stories and the people who love them. These rules apply to stories, chapters, posts, comments and profiles.",
    sections: [
      { title: "Not allowed on Surituk", body: ul([
        "Work that belongs to someone else — copied manga, comics, art or translations without permission.",
        "Sexual content involving anyone under 18, in any form. We report this to authorities.",
        "Sexual content that isn't marked 18+, or that shows real people without consent.",
        "Hate, harassment, bullying or threats against people or groups, including on the basis of religion, caste, gender, region or language.",
        "Content that encourages violence, self-harm, or crime; content that threatens India's unity, security or public order.",
        "Impersonation, fake news, scams, misleading links, or malware.",
        "Spam: repeated junk comments, fake accounts, or buying likes, votes or ratings.",
        "Anything else that's illegal in India.",
      ]) },
      { title: "18+ stories", body: "Creators must mark mature stories as 18+. They're only shown to adults who confirm their age. Admins may mark a story 18+ if the creator didn't." },
      { title: "Posts and comments", body: ul([
        "Only approved creators start posts. Discussion and Review posts allow comments; Announcements allow likes only; Polls allow one vote per person.",
        "To comment, like, vote or rate you need a verified email and a finished profile.",
      ]) },
      { title: "What happens if rules are broken", body: ul([
        "Content can be unlisted or deleted.",
        "Readers can be restricted (no comments, likes, votes or ratings) or banned.",
        "Creators get strikes. 3 strikes suspends the creator account. Serious cases lose creator access, or are hidden or banned straight away.",
        "You get a notice with the reason. To appeal, write to the Grievance Officer.",
      ]) },
      { title: "Report it", body: "Use the Report button. We review reports and act on illegal content quickly — within 24 hours for intimate images shared without consent." },
    ],
  },

  copyright: {
    title: "Copyright Policy",
    intro: "Surituk respects creators' rights under the Copyright Act, 1957. If your work was uploaded without permission, we'll take it down.",
    sections: [
      { title: "How to file a complaint", body: <>Use <b>Report → Copyright</b> on the story, chapter or post, or email <GrievanceContact />. Include:{ul([
        "Your name and contact email (and your authority, if you act for the owner).",
        "The original work, with a link if it's online.",
        "The page on Surituk that copies it.",
        "A statement that you believe in good faith the use isn't authorised, and that your information is accurate.",
      ])}</> },
      { title: "What we do", body: ul([
        "We acknowledge within 24 hours and decide within 15 days, usually much faster.",
        "If the claim looks valid, we unlist or remove the content and give the creator a strike.",
        "We keep a record of removed content for 180 days, as the IT Rules require.",
      ]) },
      { title: "If your work was removed", body: "If you believe it was a mistake — you own it or have a licence — reply to the notice or write to the Grievance Officer with proof. We'll review it, and may restore the content unless the claimant shows a court order." },
      { title: "Repeat infringers", body: "3 confirmed copyright strikes suspends a creator account. Deliberate or large-scale copying is banned straight away." },
    ],
  },

  grievance: {
    title: "Grievance Officer",
    intro: "As required by the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the Digital Personal Data Protection Act, 2023.",
    sections: [
      { title: "Contact", body: <GrievanceContact /> },
      { title: "What you can raise", body: "Complaints about content on Surituk, copyright, privacy and your personal data, account actions (restrictions, strikes, bans, removed access), or anything that breaks our Terms." },
      { title: "Timelines", body: ul([
        "We acknowledge your complaint within 24 hours and resolve it within 15 days.",
        "Requests to remove content showing someone's private areas, nudity, sexual acts or impersonation in morphed images are acted on within 24 hours.",
      ]) },
      { title: "Not satisfied?", body: <>You can appeal to the Grievance Appellate Committee within 30 days of our decision, at <a href="https://gac.gov.in" target="_blank" rel="noopener noreferrer" className="text-primary underline">gac.gov.in</a>. For personal-data complaints you can also approach the Data Protection Board of India.</> },
    ],
  },
};
PAGES.dmca = PAGES.copyright;

export default function InfoPage() {
  const pageName = window.location.pathname.split("/").pop() || "about";
  const page = PAGES[pageName];
  if (!page) {
    return (
      <div className="container px-4 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Page not found</h1>
        <Link href="/" className="text-primary hover:underline">Go home</Link>
      </div>
    );
  }
  const legal = ["terms", "privacy", "guidelines", "copyright", "dmca", "grievance"].includes(pageName);
  return (
    <div className="container px-4 py-10 md:py-16 max-w-3xl">
      <h1 className="text-4xl md:text-5xl font-bold mb-3">{page.title}</h1>
      {legal && <p className="text-sm text-muted-foreground mb-6">Last updated {UPDATED}</p>}
      {page.intro && <p className="text-lg text-foreground/80 mb-10 leading-relaxed">{page.intro}</p>}
      <div className="space-y-8">
        {page.sections.map(s => (
          <section key={s.title}>
            <h2 className="text-xl md:text-2xl font-bold mb-2.5">{s.title}</h2>
            <div className="text-foreground/75 leading-relaxed">{s.body}</div>
          </section>
        ))}
      </div>
      {legal && (
        <nav className="mt-14 pt-6 border-t border-border flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Policies">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/guidelines" className="hover:text-foreground">Community Guidelines</Link>
          <Link href="/copyright" className="hover:text-foreground">Copyright</Link>
          <Link href="/grievance" className="hover:text-foreground">Grievance Officer</Link>
        </nav>
      )}
    </div>
  );
}
