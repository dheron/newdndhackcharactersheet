// Printing the sheet. The print styles in src/sheet/sheet.css lay each page out on one US Letter
// page; the system print dialog also offers Save as PDF (macOS) or Microsoft Print to PDF (Windows).
import { inTauri } from "./storage";

const isMac = () => typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

export async function printSheet(): Promise<void> {
  if (inTauri() && isMac()) {
    // The macOS web view ignores window.print(), so the app opens the dialog natively.
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("print_sheet");
    return;
  }
  window.print();
}
