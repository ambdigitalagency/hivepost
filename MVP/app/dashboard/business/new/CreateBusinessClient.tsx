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
    nextStepGenerateStrategy: string;
    scenarioLabel: string;
    scenarioPlaceholder: string;
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
        nextStepGenerateStrategy: labels.nextStepGenerateStrategy,
        scenarioLabel: labels.scenarioLabel,
        scenarioPlaceholder: labels.scenarioPlaceholder,
        websiteUrl: labels.websiteUrl,
        websiteUrlPlaceholder: labels.websiteUrlPlaceholder,
        materialsUpload: labels.materialsUpload,
        materialsUploadHint: labels.materialsUploadHint,
      }}
      locale={locale}
      showScenarioSection
      onSuccess={(id) => router.push(`/dashboard/business/${id}/strategy`)}
    />
  );
}
