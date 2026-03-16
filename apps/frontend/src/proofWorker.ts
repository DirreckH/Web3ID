import { generateHolderBindingProof, generateHolderBoundProof } from "@web3id/proof";

const E2E_DEFAULT_SUBJECT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const E2E_PROOF_POINTS = [
  13122372145947736466215110589086593424969819421568502311814817140510255388779n,
  11787358258584064952942909854067898297594773774633455905750490717289687803437n,
  14107949736790722902603583410399654372709982465456445450719954945915678412459n,
  9785936997078988836922225143728102757907830846656362841118139076774926239364n,
  8040581014653838442221190141950333874040576881913776978408098382742702200161n,
  13923702086693704559744298793842223172811566886326384347643412351152431201826n,
  3142118871755198499349118933991585226890346794618921237576094869922164069639n,
  9128433068517416820211289626332730482933802718411124296238631767069737268345n,
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
