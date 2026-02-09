import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { I18nProvider } from "@/context/I18nContext";
import { getMessages } from "@/lib/i18n";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function renderWithI18n(locale: "en" | "zh" = "en") {
  return render(
    <I18nProvider locale={locale} messages={getMessages(locale)}>
      <LanguageSwitcher />
    </I18nProvider>
  );
}

describe("LanguageSwitcher", () => {
  it("renders current locale label and switch button", () => {
    renderWithI18n("en");
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中文" })).toBeInTheDocument();
  });

  it("shows 中文 as current when locale is zh", () => {
    renderWithI18n("zh");
    expect(screen.getByText("中文")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
  });

  it("calls setLocale when switch button is clicked", async () => {
    const user = userEvent.setup();
    renderWithI18n("en");
    await user.click(screen.getByRole("button", { name: "中文" }));
    expect(mockRefresh).toHaveBeenCalled();
  });
});
