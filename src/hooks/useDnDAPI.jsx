import { useState, useEffect } from "react";

const API_BASE = "https://www.dnd5eapi.co/api";

/** Generic fetcher hook for any endpoint */
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
        const response = await fetch(`${API_BASE}/${endpoint}/${slug}`);
        if (!response.ok) throw new Error(`Failed to fetch ${endpoint} data`);
        const json = await response.json();
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
  if (loading) return <p><em>Loading...</em></p>;
  if (error) return <p><em>Error: {error}</em></p>;
  if (!data) return <p><em>No data found.</em></p>;

  // For spells, feats, and features, use .desc if available
  if (data.desc && Array.isArray(data.desc)) {
    return (
      <div
        dangerouslySetInnerHTML={{
          __html: data.desc.join("<br/><br/>"),
        }}
      />
    );
  }

  // Equipment-specific details
  if (data.equipment_category) {
    const ac = data.armor_class
      ? `AC: ${data.armor_class.base}${
          data.armor_class.dex_bonus ? " + Dex" : ""
        }`
      : "";
    const dmg =
      data.damage && data.damage.damage_dice
        ? `Damage: ${data.damage.damage_dice} ${data.damage.damage_type.name}`
        : "";
    return (
      <div>
        {ac && <p>{ac}</p>}
        {dmg && <p>{dmg}</p>}
        {data.desc && <p>{data.desc}</p>}
      </div>
    );
  }

  return <p><em>No description available.</em></p>;
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

          // Merge both results with type labels
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
