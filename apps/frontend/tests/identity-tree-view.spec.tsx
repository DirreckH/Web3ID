// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { IdentityTreeView } from "../src/app/components/IdentityTreeView";
import { LanguageProvider } from "../src/app/contexts/LanguageContext";

const card = {
  id: "test-card",
  address: "0x7Aa5C0fFEE8B45A6C4E5D9cF8f4A1F7E9d2C3B10",
  network: "hashkey-testnet",
  chainId: "133",
  signature: "signed",
} as const;

function renderIdentityTree() {
  return render(
    <LanguageProvider>
      <IdentityTreeView card={card} isOpen onClose={vi.fn()} />
    </LanguageProvider>,
  );
}

beforeAll(() => {
  Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("IdentityTreeView", () => {
  it("collapses lane detail from the header action", async () => {
    const user = userEvent.setup();
    renderIdentityTree();

    await user.click(screen.getByTestId("identity-lane-card-defi"));
    expect(screen.getByTestId("identity-regulation-detail-defi")).toBeTruthy();

    await user.click(screen.getByTestId("identity-collapse-lane-detail"));

    await waitFor(() => {
      expect(screen.queryByTestId("identity-regulation-detail-defi")).toBeNull();
    });
  });

  it("updates responsive breakpoint metadata on resize", async () => {
    window.innerWidth = 375;
    renderIdentityTree();

    await userEvent.click(screen.getByTestId("identity-lane-card-defi"));

    await waitFor(() => {
      expect(screen.getByTestId("identity-regulation-detail").getAttribute("data-breakpoint")).toBe("mobile");
    });

    window.innerWidth = 1280;
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(screen.getByTestId("identity-regulation-detail").getAttribute("data-breakpoint")).toBe("desktop");
    });
  });
});
