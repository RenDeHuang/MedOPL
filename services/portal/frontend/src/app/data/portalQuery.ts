import { useEffect, useState } from "react";
import { portalDisplayMessage } from "./portalDisplayErrors";

export type QueryState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function usePortalQuery<T>(loader: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ status: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    loader()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", data: null, error: portalDisplayMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}
