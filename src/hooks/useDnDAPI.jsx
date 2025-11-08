import { useState, useEffect } from "react";

const API_BASE = "https://www.dnd5eapi.co/api";

/** Generic fetcher hook for any endpoint (with fallback for magic items) */
export function useDnDAPI(endpoint, name) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!name) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-");

        // Debug: log what we're attempting to fetch
        // (helps diagnose 404s / bad slugs / CORS failures)
        // eslint-disable-next-line no-console
        console.debug(`[useDnDAPI] fetching ${endpoint}/${slug}`);

        // First attempt
        let response = await fetch(`${API_BASE}/${endpoint}/${slug}`);
        let json;
        if (!response.ok) {
          // Attempt index-based fallback: fetch the endpoint index and find a matching entry
          // eslint-disable-next-line no-console
          console.debug(`[useDnDAPI] primary fetch failed (${response.status}), attempting index fallback for ${endpoint}`);
          try {
            const listRes = await fetch(`${API_BASE}/${endpoint}`);
            if (listRes.ok) {
              const listJson = await listRes.json();
              const results = listJson.results || [];

              // Try exact name match first (case-insensitive)
              let match = results.find((r) => r.name.toLowerCase() === name.toLowerCase());

              // Next try matching by index (sometimes slugs/indices are the canonical keys)
              if (!match) {
                match = results.find((r) => String(r.index).toLowerCase() === slug);
              }

              // Then try partial match
              if (!match) {
                match = results.find((r) => r.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(r.name.toLowerCase()));
              }

              if (match) {
                // eslint-disable-next-line no-console
                console.debug(`[useDnDAPI] index fallback matched ${match.index} (${match.name}), fetching that entry`);
                const altRes = await fetch(`${API_BASE}/${endpoint}/${match.index}`);
                if (altRes.ok) {
                  json = await altRes.json();
                } else {
                  // capture alt response text for debugging
                  const text = await altRes.text().catch(() => "");
                  throw new Error(`Fallback HTTP ${altRes.status} ${altRes.statusText} - ${text}`);
                }
              } else {
                // nothing matched in the index, throw original error to be handled below
                const text = await response.text().catch(() => "");
                throw new Error(`Primary fetch failed: HTTP ${response.status} ${response.statusText} - ${text}`);
              }
            } else {
              // couldn't fetch the index either
              const text = await listRes.text().catch(() => "");
              throw new Error(`Index fetch failed: HTTP ${listRes.status} ${listRes.statusText} - ${text}`);
            }
          } catch (fallbackErr) {
            // bubble up fallback error
            throw fallbackErr;
          }
        } else {
          json = await response.json();
          // Debug: log successful response shape
          // eslint-disable-next-line no-console
          console.debug(`[useDnDAPI] response for ${endpoint}/${slug}:`, json);
        }

        // 🧩 Fallback: If it's equipment with no desc, try magic-items endpoint
        if (
          endpoint === "equipment" &&
          (!json.desc || json.desc.length === 0)
        ) {
          const altRes = await fetch(`${API_BASE}/magic-items/${slug}`);
          if (altRes.ok) {
            const altJson = await altRes.json();
            if (altJson && altJson.desc) json = altJson;
          }
        }

        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [endpoint, name]);

  return { data, loading, error };
}

/** Specialized hooks */
export const useEquipmentInfo = (name) => useDnDAPI("equipment", name);
export const useMagicItemInfo = (name) => useDnDAPI("magic-items", name);
export const useFeatInfo = (name) => useDnDAPI("feats", name);
export const useSpellInfo = (name) => useDnDAPI("spells", name);
export const useFeatureInfo = (name) => useDnDAPI("features", name);

/** Tooltip rendering helper */
export function getTooltipContent({ loading, data, error }) {
  if (loading)
    return (
      <div className="flex items-center gap-2">
        <svg
          className="animate-spin h-4 w-4 text-gray-700"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <span className="text-xs italic text-gray-700">Loading...</span>
      </div>
    );
  if (error) return <p><em>Error: {error}</em></p>;
  if (!data) return <p><em>No data found.</em></p>;

  // Spells, feats, and features — render description text normally
  // NOTE: some equipment entries return an empty `desc: []`. Only treat
  // `desc` as the primary content when it's a non-empty array.
  // If we have a non-empty desc and this entry is NOT equipment/magic-item,
  // render the description as the primary tooltip content. For equipment
  // entries we prefer to show mechanical stats and *also* include the
  // description (if present) below.
  if (data.desc && Array.isArray(data.desc) && data.desc.length > 0 && !data.equipment_category) {
    return (
      <div
        dangerouslySetInnerHTML={{
          __html: data.desc.join("<br/><br/>"),
        }}
      />
    );
  }

  // Equipment and Magic Item details (✅ cleaned up + bold labels)
  if (data.equipment_category) {
    const ac = data.armor_class
      ? `<p><strong>Base AC:</strong> ${data.armor_class.base}${
          data.armor_class.dex_bonus ? " + Dex modifier" : ""
        }</p>`
      : "";

    const strReq = data.str_minimum
      ? `<p><strong>Strength Requirement:</strong> ${data.str_minimum}</p>`
      : "";

    const stealth = data.stealth_disadvantage
      ? `<p><strong>Stealth:</strong> Disadvantage on Stealth checks</p>`
      : "";

    const dmg =
      data.damage && data.damage.damage_dice
        ? `<p><strong>Damage:</strong> ${data.damage.damage_dice} ${data.damage.damage_type.name}</p>`
        : "";

    const weight = data.weight
      ? `<p><strong>Weight:</strong> ${data.weight} lb.</p>`
      : "";

    const cost = data.cost
      ? `<p><strong>Cost:</strong> ${data.cost.quantity} ${data.cost.unit}</p>`
      : "";

    const hasStats = ac || strReq || stealth || dmg || weight || cost;

    const descHtml = data.desc && Array.isArray(data.desc) && data.desc.length > 0
      ? `<div class="mt-2">${data.desc.join("<br/><br/>")}</div>`
      : "";

    return (
      <div
        dangerouslySetInnerHTML={{
          __html: `
            ${ac}
            ${strReq}
            ${stealth}
            ${dmg}
            ${weight}
            ${cost}
            ${
              !hasStats
                ? "<p><em>No mechanical stats found for this item.</em></p>"
                : ""
            }
            ${descHtml}
          `,
        }}
      />
    );
  }

  return <p><em>No information available for this entry.</em></p>;
}

/** Autocomplete hook — includes Spells + Features combined */
export function useDnDAutocomplete(endpoint, query) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        // 🧠 Combined autocomplete for Spells + Features
        if (endpoint === "spells") {
          const [spellsRes, featuresRes] = await Promise.all([
            fetch(`${API_BASE}/spells`),
            fetch(`${API_BASE}/features`),
          ]);

          const spellsJson = await spellsRes.json();
          const featuresJson = await featuresRes.json();

          const spells = (spellsJson.results || []).filter((s) =>
            s.name.toLowerCase().includes(query.toLowerCase())
          );

          const features = (featuresJson.results || []).filter((f) =>
            f.name.toLowerCase().includes(query.toLowerCase())
          );

          // Merge and tag results
          const combined = [
            ...spells.map((s) => ({ ...s, source: "Spell" })),
            ...features.map((f) => ({ ...f, source: "Feature" })),
          ];

          // Deduplicate by name
          const unique = combined.filter(
            (v, i, a) =>
              a.findIndex(
                (t) => t.name.toLowerCase() === v.name.toLowerCase()
              ) === i
          );

          setSuggestions(unique.slice(0, 25));
          setLoading(false);
          return;
        }

        // 🧩 Default autocomplete for other endpoints
        const response = await fetch(`${API_BASE}/${endpoint}`);
        const json = await response.json();

        if (json.results) {
          const filtered = json.results.filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase())
          );
          setSuggestions(filtered.slice(0, 20));
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [endpoint, query]);

  return { suggestions, loading };
}
