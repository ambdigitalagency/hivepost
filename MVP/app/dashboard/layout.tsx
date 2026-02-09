import { FeedbackInvitation } from "@/components/FeedbackInvitation";
import { DashboardHeader } from "@/components/DashboardHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page-bg font-[family-name:var(--font-geist-sans)]">
      <DashboardHeader />
      <FeedbackInvitation />
      <main className="px-6 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
