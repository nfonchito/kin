import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Kin",
  description: "The terms that govern your use of the Kin family assistant.",
};

const CONTACT_EMAIL = "hello@kinfamily.app"; // TODO: replace with a real monitored address

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 15, 2026" current="terms">
      <p>
        Welcome to Kin. These Terms of Service (&quot;Terms&quot;) govern your access to and use of the
        Kin family assistant (the &quot;Service&quot;). By creating an account or using the Service, you
        agree to these Terms. Please read them carefully.
      </p>

      <h2>The service</h2>
      <p>
        Kin is a personal assistant that helps you organize household tasks, reminders, and a family
        calendar. Kin captures and tracks the requests you make. It is a tool to help you stay organized
        and does not independently carry out real-world bookings or transactions on your behalf unless a
        feature explicitly says so.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You are responsible for keeping your login credentials secure.</li>
        <li>You are responsible for the activity that happens under your account.</li>
        <li>You must provide accurate information and be at least 18 years old to create an account.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or in violation of these Terms.</li>
        <li>Attempt to disrupt, reverse-engineer, or gain unauthorized access to the Service or its systems.</li>
        <li>Upload content that is harmful, infringing, or violates the rights of others.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You retain ownership of the information and content you add to Kin (such as your family details,
        tasks, and messages). You grant us a limited license to store and process that content solely to
        provide the Service to you, as described in our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Service availability</h2>
      <p>
        Kin is offered on an &quot;as is&quot; and &quot;as available&quot; basis. It is an early-stage
        product, and features may change, be added, or be removed. We do not guarantee that the Service
        will be uninterrupted, error-free, or that reminders and notifications will always be delivered
        on time. Please don&apos;t rely on Kin as the sole system for time-critical or safety-critical matters.
      </p>

      <h2>Disclaimers</h2>
      <p>
        To the fullest extent permitted by law, Kin disclaims all warranties, express or implied,
        including merchantability and fitness for a particular purpose. Kin does not provide legal,
        medical, or financial advice.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Kin and its operators will not be liable for any
        indirect, incidental, or consequential damages, or for any missed task, reminder, or
        appointment, arising from your use of the Service.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using Kin and delete your account at any time. We may suspend or terminate access
        if these Terms are violated or if needed to protect the Service or its users.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these Terms as the Service evolves. When we do, we&apos;ll revise the &quot;Last
        updated&quot; date above. Continued use of Kin after changes take effect means you accept the
        revised Terms.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Texas, United States, without regard to its
        conflict-of-laws rules.
      </p>

      <h2>Contact us</h2>
      <p>
        Questions about these Terms? Reach out at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
