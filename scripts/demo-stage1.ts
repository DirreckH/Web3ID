process.env.WEB3ID_DEMO_ENTRY ??= "stage1";
process.env.VITE_PLATFORM_ENTRY ??= "stage1";

await import("./demo-stage2.ts");
