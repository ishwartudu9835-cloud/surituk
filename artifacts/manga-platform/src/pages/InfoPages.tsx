import { useParams } from "wouter";
import { Link } from "wouter";
import { motion } from "framer-motion";

type InfoSection = { title: string; content: React.ReactNode };

const pages: Record<string, { heading: string; intro: string; sections: InfoSection[] }> = {
  about: {
    heading: "About Surituk",
    intro: "Surituk is a global manga reading platform built for readers, creators, and community — a complete ecosystem for discovering stories, growing audiences, and earning revenue.",
    sections: [
      { title: "Our Mission", content: "To empower manga creators worldwide with fair revenue sharing, transparent analytics, and a passionate global readership. We believe every great story deserves a great audience." },
      { title: "For Readers", content: "Access thousands of manga across every genre. Track your progress, earn reading points, participate in contests, and connect with fellow fans in our community." },
      { title: "For Creators", content: "Upload your work, build your audience, and earn through AdSense revenue sharing, fan support, and creator bonuses. Our dashboard gives you full visibility into your performance." },
      { title: "Our Values", content: "Creator first, reader focused, community driven. We build features that serve both sides of the ecosystem equally. No exclusive deals that lock creators in — you own your work." },
    ],
  },
  contact: {
    heading: "Contact Us",
    intro: "We're here to help. Reach out through any of the channels below and our team will respond within 48 hours.",
    sections: [
      { title: "General Inquiries", content: "Email: hello@surituk.com — For general questions about the platform, features, and partnerships." },
      { title: "Creator Support", content: "Email: creators@surituk.com — For questions about creator accounts, revenue, uploads, and the Creator Studio." },
      { title: "Legal & Copyright", content: "Email: legal@surituk.com — For DMCA notices, copyright claims, and legal correspondence." },
      { title: "Press & Media", content: "Email: press@surituk.com — For media inquiries, press kits, and interview requests." },
    ],
  },
  privacy: {
    heading: "Privacy Policy",
    intro: "Your privacy is important to us. This policy explains what data we collect, how we use it, and your rights.",
    sections: [
      { title: "Data We Collect", content: "We collect account information (email, username), reading activity, and usage data to personalize your experience. Payment data is handled by third-party processors and never stored on our servers." },
      { title: "How We Use Your Data", content: "To provide and improve the service, personalize recommendations, process payments, send notifications you've opted into, and detect fraud. We never sell your personal data." },
      { title: "Cookies", content: "We use cookies for authentication, preferences, and analytics. You can control cookies through your browser settings. Essential cookies cannot be disabled as they are required for the service to function." },
      { title: "Your Rights", content: "You have the right to access, export, or delete your data at any time from your account settings. For requests or questions about your data, contact privacy@surituk.com." },
    ],
  },
  terms: {
    heading: "Terms & Conditions",
    intro: "By using Surituk, you agree to these terms. Please read them carefully.",
    sections: [
      { title: "Eligibility", content: "You must be at least 13 years old to use Surituk. If you are under 18, you must have parental consent. By creating an account, you confirm you meet these requirements." },
      { title: "User Conduct", content: "You agree not to upload content you don't own, harass other users, attempt to hack or disrupt the platform, or use automated tools to access the service without permission." },
      { title: "Creator Agreement", content: "Creators retain full ownership of their work. By uploading to Surituk, you grant us a non-exclusive license to display and distribute your content on the platform. You may remove your content at any time." },
      { title: "Revenue & Payments", content: "Creator revenue is calculated monthly and paid within 30 days of the end of each period. Surituk takes a 30% platform fee. Detailed revenue policies are in the Creator Revenue Policy." },
    ],
  },
  dmca: {
    heading: "DMCA Policy",
    intro: "Surituk respects intellectual property rights and expects our users to do the same.",
    sections: [
      { title: "Filing a Notice", content: "If you believe your copyrighted work has been uploaded without permission, send a DMCA notice to legal@surituk.com with: your contact information, identification of the copyrighted work, identification of the infringing material, and a statement of good faith belief." },
      { title: "Counter-Notification", content: "If you believe your content was removed in error, you may file a counter-notification. We will restore the content within 10-14 business days unless the original complainant files for a court order." },
      { title: "Repeat Infringers", content: "Accounts with multiple confirmed copyright violations will be terminated under our repeat infringer policy. We maintain detailed logs of all DMCA notices and actions taken." },
    ],
  },
};

export default function InfoPage() {
  const params = useParams<{ page?: string }>();
  const pageName = window.location.pathname.split("/").pop() || "about";
  const page = pages[pageName];

  if (!page) {
    return (
      <div className="container px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <Link href="/" className="text-primary hover:underline">Return Home</Link>
      </div>
    );
  }

  return (
    <div className="container px-4 py-12 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-bold mb-4">{page.heading}</h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-10 pb-8 border-b border-white/10">{page.intro}</p>
        <div className="space-y-8">
          {page.sections.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t border-white/10 text-sm text-muted-foreground">
          Last updated: November 2026 &nbsp;·&nbsp;
          <Link href="/contact" className="text-primary hover:underline">Contact Us</Link>
        </div>
      </motion.div>
    </div>
  );
}
