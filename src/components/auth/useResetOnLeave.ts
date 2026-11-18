import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * With Cache Components, a page the user leaves stays mounted in a hidden
 * <Activity>: its state and form inputs come back on return (a spinner still
 * running, a typed password still in the DOM). The layout-effect cleanup runs
 * when the page is hidden: the form is emptied and `reset` puts the state back.
 * See node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md ("UI state preservation").
 */
export function useResetOnLeave(reset: () => void): RefObject<HTMLFormElement | null> {
  const formRef = useRef<HTMLFormElement>(null);
  const resetRef = useRef(reset);
  useLayoutEffect(() => {
    resetRef.current = reset;
  });
  useLayoutEffect(() => {
    const form = formRef;
    const latest = resetRef;
    return () => {
      form.current?.reset();
      latest.current();
    };
  }, []);
  return formRef;
}
