/** Brief notices ("All changes synced", errors). Wired to the UI store in 5.4. */
export default function Toaster() {
  return <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-10 z-50 flex flex-col gap-2" />;
}
