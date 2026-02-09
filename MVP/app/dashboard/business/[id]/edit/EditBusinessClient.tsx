"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { BusinessForm } from "@/components/BusinessForm";

type EditBusinessClientProps = {
  businessId: string;
  locale: string;
  initial: {
    id: string;
    name?: string | null;
    region?: string | null;
    language?: string | null;
    tone?: string | null;
    category?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
  };
  labels: {
    name: string;
    language: string;
    tone: string;
    category: string;
    city: string;
    county: string;
    save: string;
    pasteTitle: string;
    selectPlatforms: string;
    websiteUrl?: string;
    websiteUrlPlaceholder?: string;
    materialsUpload?: string;
    materialsUploadHint?: string;
  };
};

export function EditBusinessClient({
  businessId,
  locale,
  initial,
  labels,
}: EditBusinessClientProps) {
  const router = useRouter();

  return (
    <>
      <BusinessForm
        businessId={businessId}
        labels={{
          name: labels.name,
          language: labels.language,
          tone: labels.tone,
          category: labels.category,
          city: labels.city,
          county: labels.county,
          save: labels.save,
          websiteUrl: labels.websiteUrl,
          websiteUrlPlaceholder: labels.websiteUrlPlaceholder,
          materialsUpload: labels.materialsUpload,
          materialsUploadHint: labels.materialsUploadHint,
        }}
        locale={locale}
        initial={initial}
        onSuccess={() => router.refresh()}
      />
      <div className="mt-6 flex flex-wrap gap-4 border-t border-card-border pt-4">
        <Link
          href={`/dashboard/business/${businessId}/paste`}
          className="text-sm text-blue-600 transition hover:underline dark:text-blue-400"
        >
          {labels.pasteTitle}
        </Link>
        <Link
          href={`/dashboard/business/${businessId}/platforms`}
          className="text-sm text-blue-600 transition hover:underline dark:text-blue-400"
        >
          {labels.selectPlatforms}
        </Link>
      </div>
    </>
  );
}
