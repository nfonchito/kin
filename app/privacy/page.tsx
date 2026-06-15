import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Kin",
  description: "How Kin collects, uses, and protects your family's information.",
};

const CONTACT_EMAIL = "hello@kinfamily.app"; // TODO: replace with a real monitored address

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 15, 2026" current="privacy">
      <p>
        Kin (&quot;Kin,&quot; &quot;we,&quot; &quot;us&quot;) is a personal assistant that helps families
        organize household tasks, reminders, and calendars. This Privacy Policy explains what information
        we collect, how we use it, and the choices you have. We&apos;ve tried to keep it plain and honest.
      </p>

      <h2>Information we collect</h2>
      <p>We only collect what we need to run the service for you:</p>
      <ul>
        <li><strong>Account information</strong> — your email address and password when you create an account.</li>
        <li><strong>Family profile</strong> — the details you choose to add, such as your family name, neighborhood, household members (names, roles, ages), home preferences, and dietary notes.</li>
        <li><strong>Activity you create</strong> — chat messages you send to the assistant, tasks you request, and calendar events you add.</li>
        <li><strong>Basic technical data</strong> — standard server and hosting logs (such as IP address and browser type) used to keep the service secure and working.</li>
      </ul>
      <p>
        We do <strong>not</strong> ask for or store payment card numbers, government IDs, or financial account
        credentials, and we do not sell your personal information.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the assistant and personalize its responses to your household.</li>
        <li>To save your tasks, calendar events, and preferences so you don&apos;t have to re-enter them.</li>
        <li>To send you notifications about tasks you&apos;ve requested (for example, an email summary).</li>
        <li>To maintain, secure, and improve the service.</li>
      </ul>

      <h2>Where your data is stored</h2>
      <p>
        Depending on how you use Kin, your data is stored in one of two places:
      </p>
      <ul>
        <li><strong>In your browser</strong> — in preview/demo mode, your profile, events, and chat history are kept locally in your own browser&apos;s storage and are not sent to our servers.</li>
        <li><strong>With our service providers</strong> — when you create an account, your data is stored with the trusted providers listed below.</li>
      </ul>

      <h2>Service providers we use</h2>
      <p>We rely on a small number of reputable third parties to operate Kin. They process data only on our behalf:</p>
      <ul>
        <li><strong>Supabase</strong> — database and account authentication.</li>
        <li><strong>Resend</strong> — sending notification emails.</li>
        <li><strong>Vercel</strong> — website hosting and delivery.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Kin uses only the cookies and local storage needed to keep you signed in and to remember your
        settings. We do not use advertising or third-party tracking cookies.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep your information for as long as your account is active. You can ask us to delete your
        account and associated data at any time, and data held only in your browser can be cleared by
        clearing your browser storage.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>You can view and update your family details from your profile at any time.</li>
        <li>You can request a copy of your data or ask us to delete it.</li>
        <li>You can opt out of notification emails.</li>
      </ul>

      <h2>Children&apos;s privacy</h2>
      <p>
        Kin is intended for use by adults managing a household. While you may add family members
        (including children) to your profile, the account itself is meant to be operated by an adult.
        We do not knowingly collect information directly from children.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy as Kin evolves. When we do, we&apos;ll revise the &quot;Last updated&quot;
        date above. Significant changes will be communicated where appropriate.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about your privacy? Reach out at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
