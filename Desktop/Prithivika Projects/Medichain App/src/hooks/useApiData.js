// Loads data from the API and keeps it fresh.
//
//   const { data, loading, error, reload } = useApiData(() => api.listBatches(), []);
//
// - loader: a function that calls the API and returns a promise
// - deps:   when one of these changes, the data is loaded again (like useEffect)
// - live:   also refresh when the data changes elsewhere (another tab in mock mode, polling in http mode)
// - reload(): refresh quietly (no loading flash), for example after saving something
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/index.js';

export function useApiData(loader, deps = [], { live = true } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const latest = useRef(0); // ignore answers from older, slower requests

  const load = useCallback(async (quiet) => {
    const id = ++latest.current;
    if (!quiet) setState({ data: null, loading: true, error: null });
    try {
      const data = await loaderRef.current();
      if (id === latest.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (id === latest.current) setState((s) => ({ data: s.data, loading: false, error }));
    }
  }, []);

  useEffect(() => { load(false); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => (live ? api.subscribe(() => load(true)) : undefined), [live, load]);

  const reload = useCallback(() => load(true), [load]);
  return { ...state, reload };
}
