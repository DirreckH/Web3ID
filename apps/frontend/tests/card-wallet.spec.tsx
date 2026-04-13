// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CardWallet } from "../src/app/pages/CardWallet";
import { LanguageProvider } from "../src/app/contexts/LanguageContext";

const WALLET_CARDS_STORAGE_KEY = "web3id.wallet.cards";

function renderWallet() {
  return render(
    <LanguageProvider>
      <CardWallet />
    </LanguageProvider>,
  );
}

describe("CardWallet persistence", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("restores persisted cards after remount", () => {
    window.localStorage.setItem(
      WALLET_CARDS_STORAGE_KEY,
      JSON.stringify([
        {
          id: "persisted-card",
          address: "0x7Aa5C0fFEE8B45A6C4E5D9cF8f4A1F7E9d2C3B10",
          network: "hashkey-testnet",
          chainId: "133",
          signature: "signed",
        },
      ]),
    );

    const firstRender = renderWallet();

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByText("钱包空空如也")).toBeNull();

    firstRender.unmount();

    renderWallet();

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByText("钱包空空如也")).toBeNull();
  });
});
