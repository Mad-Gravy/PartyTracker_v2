import { useState, useEffect } from "react";
import { featDescriptions } from "../data/featDescriptions";

export function useDnDAutocomplete(endpoint, query) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      return;
    }

    let isCancelled = false;
    setLoading(true);

    async function fetchAndFilter() {
      try {
        if (endpoint === "feats") {
          // Use local featDescriptions keys for autocomplete
          const allFeats = Object.keys(featDescriptions);
          const filtered = allFeats.filter((feat) =>
            feat.toLowerCase().includes(query.toLowerCase())
          );
          if (!isCancelled) {
            setSuggestions(filtered.map((name) => ({ name })));
          }
        } else {
          // Use API for other endpoints
          const res = await fetch(`https://www.dnd5eapi.co/api/${endpoint}`);
          if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);
          const data = await res.json();
          if (data.results && !isCancelled) {
            const filtered = data.results.filter((item) =>
              item.name.toLowerCase().includes(query.toLowerCase())
            );
            setSuggestions(filtered);
          }
        }
      } catch (err) {
        console.error(`Autocomplete error (${endpoint}):`, err);
        if (!isCancelled) setSuggestions([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchAndFilter();
    return () => {
      isCancelled = true;
    };
  }, [endpoint, query]);

  return { suggestions, loading };
}
