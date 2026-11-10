import { createServerFn } from "@tanstack/react-start";

export const getUsdBrl = createServerFn({ method: "POST" }).handler(async () => {
  const { loadUsdBrl } = await import("./fx.server");
  return loadUsdBrl();
});
