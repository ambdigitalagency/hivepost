"use client";

import { useRouter } from "next/navigation";
import { BusinessForm } from "@/components/BusinessForm";

type CreateBusinessClientProps = {
  locale: string;
  labels: {
    create: string;
    name: string;
    language: string;
    tone: string;
    category: string;
    city: string;
    county: string;
    save: string;
    nextDescribeScenario?: string;
    backToDashboard: string;
    websiteUrl?: string;
    websiteUrlPlaceholder?: string;
    materialsUpload?: string;
    materialsUploadHint?: string;
  };
};

export function CreateBusinessClient({ locale, labels }: CreateBusinessClientProps) {
  const router = useRouter();

  return (
    <BusinessForm
      labels={{
        name: labels.name,
        language: labels.language,
        tone: labels.tone,
        category: labels.category,
        city: labels.city,
        county: labels.county,
        save: labels.save,
        nextDescribeScenario: labels.nextDescribeScenario,
        websiteUrl: labels.websiteUrl,
        websiteUrlPlaceholder: labels.websiteUrlPlaceholder,
        materialsUpload: labels.materialsUpload,
        materialsUploadHint: labels.materialsUploadHint,
      }}
      locale={locale}
      onSuccess={(id) => router.push(`/dashboard/business/${id}/paste`)}
    />
  );
}
