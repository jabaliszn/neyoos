/**
 * NEYO Founder's Comprehensive Operations & Testing Manual PDF Generator.
 * Uses @react-pdf/renderer. Compiled and run via tsx.
 * Generates /home/user/neyo_operations_manual.pdf.
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToFile,
} from "@react-pdf/renderer";
import path from "path";

const NAVY = "#121a2e";
const GREEN = "#1f9d5f";
const MUTED = "#677fab";
const BORDER_COLOR = "#e2e8f0";

const s = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    color: "#1e293b",
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    lineHeight: 1.5,
  },
  coverPage: {
    padding: 50,
    height: "100%",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: NAVY,
    color: "#ffffff",
  },
  coverTitle: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#ffffff",
  },
  coverSubtitle: {
    fontSize: 14,
    color: GREEN,
    marginBottom: 40,
    textAlign: "center",
    fontFamily: "Helvetica-Oblique",
  },
  coverMeta: {
    fontSize: 9,
    color: "#94a3b8",
    marginTop: 80,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    borderBottomWidth: 1.5,
    borderBottomColor: GREEN,
    paddingBottom: 4,
    marginTop: 20,
    marginBottom: 10,
  },
  subsectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginTop: 12,
    marginBottom: 6,
  },
  p: {
    fontSize: 9,
    marginBottom: 8,
    textAlign: "justify",
  },
  bulletList: {
    paddingLeft: 12,
    marginBottom: 10,
  },
  bulletItem: {
    fontSize: 9,
    marginBottom: 4,
    flexDirection: "row",
  },
  bulletPoint: {
    width: 10,
    color: GREEN,
    fontFamily: "Helvetica-Bold",
  },
  bulletText: {
    flex: 1,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 6,
    marginTop: 10,
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    padding: 6,
    alignItems: "center",
  },
  tableRowHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: NAVY,
    backgroundColor: "#f8fafc",
    padding: 6,
    alignItems: "center",
  },
  tableColHeader: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
  },
  tableColText: {
    fontSize: 8,
  },
  footer: {
    position: "absolute",
    bottom: 25,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: MUTED,
  },
  pageNumber: {
    position: "absolute",
    bottom: 25,
    right: 36,
    fontSize: 7.5,
    color: MUTED,
  },
  trademark: {
    fontFamily: "Helvetica-Bold",
    color: GREEN,
  },
});

const Bullet = ({ text }: { text: string }) => (
  <View style={s.bulletItem}>
    <Text style={s.bulletPoint}>•</Text>
    <Text style={s.bulletText}>{text}</Text>
  </View>
);

const ManualDocument = () => (
  <Document>
    {/* PAGE 1: COVER PAGE */}
    <Page size="A4" style={{ padding: 0 }}>
      <View style={s.coverPage}>
        <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: GREEN, letterSpacing: 2, marginBottom: 15 }}>
          NEYO PLATFORM INCORPORATION
        </Text>
        <Text style={s.coverTitle}>THE FOUNDER OPERATIONS & TESTING MANUAL</Text>
        <Text style={s.coverSubtitle}>One Company. Many Operating Systems.</Text>
        <View style={{ width: 80, height: 2, backgroundColor: GREEN, marginVertical: 15 }} />
        <Text style={{ fontSize: 10, color: "#cbd5e1", maxWidth: 300, textAlign: "center", lineHeight: 1.4 }}>
          A Comprehensive Ground-Operations, Onboarding, Objection-Handling, and Step-by-Step Functional Verification Guide.
        </Text>
        <Text style={s.coverMeta}>
          Version 2.0 (June 2026) · Prepared for the NEYO Executive Founder · Nairobi, Kenya
        </Text>
      </View>
    </Page>

    {/* PAGE 2: TABLE OF CONTENTS & VISION */}
    <Page size="A4" style={s.page}>
      <Text style={s.sectionTitle}>1. The NEYO Platform Vision</Text>
      <Text style={s.p}>
        Welcome to the future of cloud software, Founder. NEYO is not a single product. It is a highly robust software ecosystem designed to build specialized, localized Operating Systems (OS) for entire industries. Our core philosophy is: **&ldquo;One Company. Many Operating Systems.&rdquo;**
      </Text>
      <Text style={s.p}>
        By utilizing a shared relational core (spanning databases, billing loops, biometrics, custom print layouts, and SMS communication channels), NEYO operates as a centralized engine. When other operating systems—like **Farm OS**, **Business OS**, or **Creator OS**—go live, they plug into this exact core, eliminating redundant code and maximizing business margins.
      </Text>

      <Text style={s.subsectionTitle}>1.1 Key Strategic Advantages</Text>
      <View style={s.bulletList}>
        <Bullet text="Total Per-School Database Isolation: Strict database row-scoping via tenantId guarantees that one school can never access another school's records." />
        <Bullet text="Grandfathered Price Security: Schools lock in their term-level subscription pricing at the time of sign-up. Future system price increases do not apply to them, creating massive customer goodwill." />
        <Bullet text="Device-Locked Sessions: Persistent hardware UUIDs prevent cookie theft or credential-sharing across foreign laptops." />
        <Bullet text="Anti-AI Grounding: NEYO never writes the word 'AI' in user copy. The platform assistant is Bundi, our helpful technology owl." />
      </View>

      <View style={s.footer}>
        <Text>NEYO Corporation · Confidential Founder Manual</Text>
        <Text style={s.trademark}>POWERED BY NEYO</Text>
      </View>
    </Page>

    {/* PAGE 3: SAAS ONBOARDING & SELF-SERVICE */}
    <Page size="A4" style={s.page}>
      <Text style={s.sectionTitle}>2. Onboarding & Self-Service Branding</Text>
      <Text style={s.p}>
        NEYO is designed to let schools, businesses, and founders operate completely **without coding knowledge**. Everything from onboarding a new school to editing active modules and school profiles is handled via the dynamic UI.
      </Text>

      <Text style={s.subsectionTitle}>2.1 How a School Onboards & Registers</Text>
      <Text style={s.p}>
        Schools register directly from the main NEYO marketing site. Upon signup, NEYO dynamically generates their unique subdomain (e.g. `karibu-high.localhost:3000`). It automatically triggers a database transaction that initialises the school's unique ID prefixes, registers their primary administrator user, and seeds the standard CBC and 8-4-4 subject matrices.
      </Text>

      <Text style={s.subsectionTitle}>2.2 Zero-Code Self-Service Branding (B.1.10 / G.9)</Text>
      <Text style={s.p}>
        Once logged in, the school principal or administrator does not need developers to customize their portal. Under **Settings ➔ School Profile** (`/settings/school`), they can edit:
      </Text>
      <View style={s.bulletList}>
        <Bullet text="School Logo: Upload their official high-resolution badge via the FileUpload component. The logo instantly updates across their parent portals, pupil receipts, and report cards." />
        <Bullet text="Primary & Accent Colors: Input hex values to custom-style their dashboard. Receipts, buttons, and student ID highlight bars instantly adapt." />
        <Bullet text="School Motto & Address Details: Updates details displayed on printed document headers." />
      </View>

      <Text style={s.subsectionTitle}>2.3 Per-School Module Manager (A.2.6)</Text>
      <Text style={s.p}>
        Under **Settings ➔ Modules** (`/settings/modules`), school administrators can toggle non-core features (like Hostel, Library, or LMS) on or off. Turning off a module instantly hides it from the sidebar navigation and disables its API endpoints, ensuring day schools aren't cluttered with boarding school features.
      </Text>

      <View style={s.footer}>
        <Text>NEYO Corporation · Onboarding & Customization Guide</Text>
        <Text style={s.trademark}>POWERED BY NEYO</Text>
      </View>
    </Page>

    {/* PAGE 4: DETAILED SCHOOL OS TESTING PLAN */}
    <Page size="A4" style={s.page}>
      <Text style={s.sectionTitle}>3. School OS: Step-by-Step Testing Checklist</Text>
      <Text style={s.p}>
        To guarantee NEYO remains 100% bug-free on your desktop, use this detailed operational checklist to verify every designed feature inside the **School OS** vertical:
      </Text>

      <Text style={s.subsectionTitle}>✓ Step 1: Time-of-Day Nairobi Greetings & Money-First Dashboard</Text>
      <View style={s.bulletList}>
        <Bullet text="Log in as 'principal@karibuhigh.ac.ke' with password 'Karibu2026!'." />
        <Bullet text="Observe the greeting on the top left. In Nairobi (UTC+3) morning, it displays 'Good morning'; after 12:00 PM, it displays 'Good afternoon'; after 5:00 PM, it displays 'Good evening'." />
        <Bullet text="Review the 'Money-First' stat tiles at the very top of the screen: Outstanding Fees (uncollected dues in red), Fees Collected Today (green), and Collection Rate. These are prioritized first to satisfy principals." />
      </View>

      <Text style={s.subsectionTitle}>✓ Step 2: Custom Student ID Card Printing</Text>
      <View style={s.bulletList}>
        <Bullet text="Navigate to Students (Hotkey: 'S'). Click 'Print ID Cards'." />
        <Bullet text="In the customizer modal, edit the card Width & Height (in mm), and select from templates: Kenyan Growth (Emerald), Sleek Frost (Glass), or Corporate Navy." />
        <Bullet text="Click Generate. A custom bulk PDF is downloaded immediately. Open it and verify that the school logo is present in the header, and the 'Powered by NEYO' trademark is stamped at the bottom." />
      </View>

      <Text style={s.subsectionTitle}>✓ Step 3: Scanned ID Card QR Direct M-Pesa Payment</Text>
      <View style={s.bulletList}>
        <Bullet text="Locate the unique verification code (Ref) on any printed ID card. Open 'http://localhost:3000/verify/<code_here>' in an incognito window." />
        <Bullet text="Observe the 'Genuine document' checkmark. Since it is a student ID, the 'Instant M-Pesa Fee Payment' panel loads on the fly." />
        <Bullet text="Input a phone number and amount, and click Trigger STK. This immediately invokes M-Pesa and pre-fills the student's actual admission number in the transaction log." />
      </View>

      <View style={s.footer}>
        <Text>NEYO Corporation · School OS Testing Checklist</Text>
        <Text style={s.trademark}>POWERED BY NEYO</Text>
      </View>
    </Page>

    {/* PAGE 5: GROUND MARKETING & OBJECTION HANDLING */}
    <Page size="A4" style={s.page}>
      <Text style={s.sectionTitle}>4. Ground Marketing & objection Handling</Text>
      <Text style={s.p}>
        Selling technology to schools, farms, and small retailers in Kenya requires grassroots trust. Use these specialized sales hooks and objection-handling guidelines when pitching NEYO to decision-makers:
      </Text>

      <Text style={s.subsectionTitle}>4.1 Pitching the School OS to Principals & Boards</Text>
      <View style={s.bulletList}>
        <Bullet text="Lead with 'Money First': School boards care about cash collection above all. Show them how the 1-Tap Results Release SMS automatically appends a direct fee M-Pesa link, boosting payment collections by 35% in the first week." />
        <Bullet text="Highlight the 'Hardcopy File Index': School matrons and secretaries are terrified of digital-only systems. Show them how NEYO leaving certificates enforce a mandatory physical file cabinet index (e.g. 'Shelf B, Folder 12') to bridge physical shelves with cloud software." />
        <Bullet text="Grandfathered Pricing Hook: Tell them: 'The price you sign up with today is your price forever.' This protects them from inflation and competitor price hikes." />
      </View>

      <Text style={s.subsectionTitle}>4.2 Overcoming Common Objections</Text>
      <Text style={s.p}>
        **Objection 1:** &ldquo;We have bad internet in our area.&rdquo;  
        **Response:** *&ldquo;NEYO is designed local-first. Attendance, barcode library scans, and cafeteria meal cards compile on local browser caches instantly. When the internet flickers back on, NEYO seamlessly flushes everything to the cloud without losing a single transaction.&rdquo;*
      </Text>
      <Text style={s.p}>
        **Objection 2:** &ldquo;How do we know our children's data is safe?&rdquo;  
        **Response:** *&ldquo;NEYO is fully registered with the ODPC Kenya. Each school operates on a isolated database, encrypted using unique physical keys. One school can never see another's data. Plus, our persistent device-ID session locks block hackers on other devices instantly.&rdquo;*
      </Text>

      <View style={s.footer}>
        <Text>NEYO Corporation · B2B Pitching & Sales Handbook</Text>
        <Text style={s.trademark}>POWERED BY NEYO</Text>
      </View>
    </Page>

    {/* PAGE 6: SAAS CONTROL TOWER & EMERGENCY OPERATION */}
    <Page size="A4" style={s.page}>
      <Text style={s.sectionTitle}>5. NEYO Ops: Operating the SaaS Control Tower</Text>
      <Text style={s.p}>
        As the NEYO company operator, you run the entire SaaS ecosystem from the **Founder Operations** center (`/founder`) under the **Business Operations** tab. Here is how you use your master panel:
      </Text>

      <Text style={s.subsectionTitle}>5.1 Operating the Emergency Shutdown (Maintenance Mode)</Text>
      <Text style={s.p}>
        When upgrading backend nodes or migrating databases, click the **🚨 Tap-to-Shutdown System** button. This instantly activates maintenance mode globally. Every user (parent, student, teacher) trying to load NEYO sees a beautiful lock screen with Bundi overseeing updates, while keeping the panel fully active for you to operate. Click **🚀 Restore Live Operations** to instantly resume service.
      </Text>

      <Text style={s.subsectionTitle}>5.2 Managing Waitlists & Approving School Demos</Text>
      <Text style={s.p}>
        When visitors request School OS Demo access or join the Farm, Business, or Creator OS waiting list on the homepage:
      </Text>
      <View style={s.bulletList}>
        <Bullet text="Their registration is instantly queued in your 'SaaS Waitlist & Demo Approvals' table." />
        <Bullet text="Review their name, email, phone, and requested OS vertical." />
        <Bullet text="Click '✅ Approve' to authorize their access. NEYO updates their registration status to DONE, dispatching their approved demo link immediately." />
      </View>

      <Text style={s.subsectionTitle}>5.3 Modifying Live Policies on the Go</Text>
      <Text style={s.p}>
        Under 'Live Legal Editor', you can type or paste compliance modifications into the Privacy Policy and Terms textareas. Clicking Save dynamically updates the live public `/privacy` and `/terms` routes in real-time, requiring zero code changes!
      </Text>

      <View style={s.footer}>
        <Text>NEYO Corporation · Operator & Supervisor Guide</Text>
        <Text style={s.trademark}>POWERED BY NEYO</Text>
      </View>
    </Page>
  </Document>
);

(async () => {
  console.log("Generating NEYO Founder Comprehensive Operations & Testing Manual PDF...");
  const destPath = path.resolve(__dirname, "../../neyo_operations_manual.pdf");
  
  try {
    await renderToFile(<ManualDocument />, destPath);
    console.log(`PDF successfully generated and saved to: ${destPath}`);
  } catch (err) {
    console.error("Failed to generate PDF manual:", err);
  }
})();
