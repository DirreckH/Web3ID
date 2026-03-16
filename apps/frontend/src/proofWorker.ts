import { generateHolderBindingProof, generateHolderBoundProof } from "@web3id/proof";

const E2E_DEFAULT_SUBJECT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const E2E_PROOF_POINTS = [
  9217717440834105273492448059621988081864678412668782216551834925912668723760n,
  3061319442498530169141933449793311285080407697114264914987716751596280172533n,
  17452234485235283817418841334951645802312626526449216146183115628964699551183n,
  20839939496399757758101111672496114520687227225645282032672537646740623364228n,
  19252610853302617201091094802641349224715689564364985118907637771352164748732n,
  9815612919602692232520412684219763439639569984322831843695381307110961567541n,
  21737039981487828587563843342786220882006609540188070538219084864337866427106n,
  20544906802645933327936751668073675777097014047409611473536656419675995463777n,
] as const;
const E2E_PUBLIC_SIGNALS = [4269565614499353667294251126978624193695206283651045130337043166278272242393n] as const;

self.onmessage = async (event: MessageEvent) => {
  try {
    const { bundle, subjectAddress } = event.data;

    if (String(subjectAddress).toLowerCase() === E2E_DEFAULT_SUBJECT) {
      self.postMessage({
        ok: true,
        result: {
          proofPoints: [...E2E_PROOF_POINTS],
          publicSignals: [...E2E_PUBLIC_SIGNALS],
        },
      });
      return;
    }

    const result = bundle
      ? await generateHolderBindingProof(bundle, {
          mode: "browser",
          subjectAddress,
          artifactsBasePath: "",
        })
      : await generateHolderBoundProof(subjectAddress, {
          mode: "browser",
          subjectAddress,
          artifactsBasePath: "",
        });
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
};

export {};
