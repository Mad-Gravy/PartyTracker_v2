import { useState, useEffect } from "react";
import { spellDescriptions } from "../data/spellDescriptions";
import { weaponShieldData } from "../data/weaponShieldData";

// Helper to find a weapon/shield by name, including aliases
function findWeaponShield(name) {
  if (!name) return null;
  const normalizedName = name.toLowerCase().replace(/\s+/g, "");
  
  // Exact key match
  if (weaponShieldData[name]) return { name, ...weaponShieldData[name] };

  // Case-insensitive key match
  for (const key in weaponShieldData) {
    if (key.toLowerCase() === normalizedName) {
      return { name: key, ...weaponShieldData[key] };
    }
  }

  // Check aliases
  for (const key in weaponShieldData) {
    const item = weaponShieldData[key];
    if (item.aliases) {
      for (const alias of item.aliases) {
        if (alias.toLowerCase() === normalizedName) {
          return { name: key, ...item };
        }
      }
    }
  }
  
  return null;
}

const API_BASE = "https://www.dnd5eapi.co/api";

// Module-level cache for endpoint index lists to avoid repeated network calls
const endpointIndexCache = new Map();

// Normalize a name for comparison: lowercase, strip punctuation, collapse whitespace
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // remove parenthetical parts
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return normalize(s).split(" ").filter(Boolean);
}

// Simple token-overlap score (higher is better)
function tokenScore(a, b) {
  const at = new Set(tokens(a));
  const bt = new Set(tokens(b));
  let common = 0;
  at.forEach((t) => {
    if (bt.has(t)) common++;
  });
  return common;
}

/** Generic fetcher hook for any endpoint (with fallback for magic items) */
export function useDnDAPI(endpoint, name) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!name) return;

    // Check local spell descriptions first to avoid API call
    if (endpoint === "spells") {
      let localDesc = spellDescriptions[name];

      // If no exact match, try case-insensitive lookup
      if (!localDesc) {
        const lowerName = name.toLowerCase();
        const foundKey = Object.keys(spellDescriptions).find(
          (key) => key.toLowerCase() === lowerName
        );
        if (foundKey) localDesc = spellDescriptions[foundKey];
      }

      if (localDesc) {
        setData({ name, desc: [localDesc] });
        setLoading(false);
        setError(null);
        return;
      }
    }

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

        // First attempt
        let response = await fetch(`${API_BASE}/${endpoint}/${slug}`);
        let json;
        if (!response.ok) {
          // Attempt index-based fallback using a cached index list and smarter matching
          console.debug(
            `[useDnDAPI] primary fetch failed (${response.status}), attempting index fallback for ${endpoint}/${slug}`
          );

          // fetch and cache index list if not already cached
          let results = endpointIndexCache.get(endpoint);
          if (!results) {
            const listRes = await fetch(`${API_BASE}/${endpoint}`);
            if (!listRes.ok) {
              const text = await listRes.text().catch(() => "");
              throw new Error(
                `Index fetch failed: HTTP ${listRes.status} ${listRes.statusText} - ${text}`
              );
            }
            const listJson = await listRes.json();
            results = listJson.results || [];
            endpointIndexCache.set(endpoint, results);
            console.debug(
              `[useDnDAPI] cached ${results.length} entries for ${endpoint}`
            );
          }

          // Try exact normalized name match first
          const normName = normalize(name);
          let match =
            results.find(
              (r) => normalize(r.name) === normName || String(r.index).toLowerCase() === slug
            ) || null;

          // If no exact normalized match, score by token overlap
          if (!match) {
            let best = null;
            let bestScore = 0;
            for (const r of results) {
              const score = tokenScore(r.name, name);
              if (score > bestScore) {
                bestScore = score;
                best = r;
              }
            }
            // require at least one overlapping token to accept
            if (bestScore > 0) match = best;
          }

          if (match) {
            console.debug(
              `[useDnDAPI] index fallback matched ${match.index} (${match.name}), fetching that entry`
            );
            const altRes = await fetch(`${API_BASE}/${endpoint}/${match.index}`);
            if (altRes.ok) {
              json = await altRes.json();
            } else {
              const text = await altRes.text().catch(() => "");
              throw new Error(
                `Fallback HTTP ${altRes.status} ${altRes.statusText} - ${text}`
              );
            }
          } else {
            const text = await response.text().catch(() => "");
            throw new Error(
              `Primary fetch failed: HTTP ${response.status} ${response.statusText} - ${text}`
            );
          }
        } else {
          json = await response.json();
          // Debug: log successful response shape
          console.debug(`[useDnDAPI] response for ${endpoint}/${slug}:`, json);
        }

        // 🧩 Conditional magic-items fallback: only try when the name looks magic-like
        if (endpoint === "equipment" && (!json || !json.desc || json.desc.length === 0)) {
          const magicKeywords = [
            "potion",
            "ring",
            "wand",
            "staff",
            "scroll",
            "amulet",
            "cloak",
            "boots",
            "stone",
            "orb",
            "gem",
            "of",
            "rod",
          ];

          const low = name?.toLowerCase() || "";
          const looksMagic = magicKeywords.some((kw) => low.includes(kw));

          if (looksMagic) {
            console.debug(`[useDnDAPI] attempting magic-items fallback for ${name}`);
            const altRes = await fetch(`${API_BASE}/magic-items/${slug}`);

            if (altRes.ok) {
              const altJson = await altRes.json();

              if (altJson && altJson.desc) json = altJson;
            }
            
          } else {
            console.debug(`[useDnDAPI] skipping magic-items fallback for ${name}`);
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
export function useEquipmentInfo(name) {
  // First, try to find the item in the local weapon/shield data
  const localItem = findWeaponShield(name);

  // If found locally, return it immediately (no loading or API call needed)
  // We mimic the { data, loading, error } structure for consistency.
  if (localItem) {
    return { data: localItem, loading: false, error: null };
  }

  // If not found locally, fall back to the generic API fetcher.
  return useDnDAPI("equipment", name);
}
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
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-xs italic text-gray-700">Loading...</span>
      </div>
    );
  if (error) return <p><em>Error: {error}</em></p>;
  if (!data) return <p><em>No data found.</em></p>;

  // Render local weapon/shield data
  if (data.kind === "Weapon" || data.kind === "Shield") {
    const fields = {
      Category: data.category,
      Damage: data.damage,
      "AC Bonus": data.acBonus,
      Properties: data.properties?.join(', '),
      Cost: data.cost,
      Weight: data.weight ? `${data.weight} lb.` : null,
    };

    const descHtml = data.desc && Array.isArray(data.desc) && data.desc.length > 0
      ? `<div class="mt-2">${data.desc.join("<br/><br/>")}</div>`
      : "";

    return (
      <div
        dangerouslySetInnerHTML={{
          __html:
            Object.entries(fields)
              .filter(([, value]) => value) // Filter out empty/null values
              .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
              .join("") + descHtml,
        }}
      />
    );
  }
  // Spells, feats, and features — render description text normally
  // NOTE: some equipment entries return an empty `desc: []`. Only treat
  // `desc` as the primary content when it's a non-empty array and NOT equipment.
  if (data.desc && Array.isArray(data.desc) && data.desc.length > 0 && !data.equipment_category) {
    return <div dangerouslySetInnerHTML={{ __html: data.desc.join("<br/><br/>") }} />;
  }

  // Equipment and Magic Item details (✅ cleaned up + bold labels)
  if (data.equipment_category) {
    const ac = data.armor_class
      ? `<p><strong>Base AC:</strong> ${data.armor_class.base}${data.armor_class.dex_bonus ? " + Dex modifier" : ""}</p>`
      : "";

    const strReq = data.str_minimum ? `<p><strong>Strength Requirement:</strong> ${data.str_minimum}</p>` : "";

    const stealth = data.stealth_disadvantage
      ? `<p><strong>Stealth:</strong> Disadvantage on Stealth checks</p>`
      : "";

    const dmg =
      data.damage && data.damage.damage_dice
        ? `<p><strong>Damage:</strong> ${data.damage.damage_dice} ${data.damage.damage_type.name}</p>`
        : "";

    const weight = data.weight ? `<p><strong>Weight:</strong> ${data.weight} lb.</p>` : "";

    const cost = data.cost ? `<p><strong>Cost:</strong> ${data.cost.quantity} ${data.cost.unit}</p>` : "";

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
            ${!hasStats ? "<p><em>No mechanical stats found for this item.</em></p>" : ""}
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
            (v, i, a) => a.findIndex((t) => t.name.toLowerCase() === v.name.toLowerCase()) === i
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