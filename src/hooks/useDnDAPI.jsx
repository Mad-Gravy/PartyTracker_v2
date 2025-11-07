import { useState, useEffect } from "react";

// Normalize names like "Chain Mail" → "chain-mail"
function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/[’'"]/g, "").replace(/\s+/g, "-");
}

/**
 * Reusable API fetcher with { data, error, loading }
 * Handles 404s and network failures gracefully.
 */
function useDnDAPI(endpoint, name) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) {
      setData(null);
      return;
    }

    const slug = normalizeName(name);
    const url = `https://www.dnd5eapi.co/api/${endpoint}/${slug}`;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status !== 404 && !cancelled) {
            setError(`Failed to fetch ${endpoint}: ${res.statusText}`);
          }
          setData(null);
        } else {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [endpoint, name]);

  return { data, error, loading };
}

// Specialized API hooks
export function useEquipmentInfo(name) {
  return useDnDAPI("equipment", name);
}
export function useMagicItemInfo(name) {
  return useDnDAPI("magic-items", name);
}
export function useFeatInfo(name) {
  return useDnDAPI("feats", name);
}
export function useSpellInfo(name) {
  return useDnDAPI("spells", name);
}

/**
 * Format raw D&D item/spell/feat data into readable lines.
 */
export function formatItemDetails(item) {
  if (!item) return [];
  const lines = [];

  // Equipment
  if (item.equipment_category) lines.push(`${item.equipment_category.name} Item`);
  if (item.armor_class) {
    const base = item.armor_class.base ?? 10;
    const dex = item.armor_class.dex_bonus
      ? "(+Dex modifier)"
      : "(Dex bonus not applied)";
    lines.push(`Base AC ${base} ${dex}`);
  }
  if (item.armor_category) lines.push(`${item.armor_category} Armor`);
  if (item.str_minimum) lines.push(`Requires STR ${item.str_minimum}`);
  if (item.stealth_disadvantage) lines.push("Disadvantage on Stealth checks");
  if (item.damage) {
    const dmg = `${item.damage.dice_count || ""}d${item.damage.dice_value || ""} ${
      item.damage.damage_type?.name || ""
    }`;
    lines.push(`Damage: ${dmg}`);
  }
  if (item.cost) lines.push(`Cost: ${item.cost.quantity} ${item.cost.unit}`);
  if (item.weight) lines.push(`Weight: ${item.weight} lbs`);

  // Spells
  if (item.level !== undefined && item.school)
    lines.push(`Level ${item.level} ${item.school.name} spell`);
  if (item.casting_time) lines.push(`Casting Time: ${item.casting_time}`);
  if (item.range && typeof item.range === "string")
    lines.push(`Range: ${item.range}`);
  if (item.duration) lines.push(`Duration: ${item.duration}`);
  if (item.components) lines.push(`Components: ${item.components.join(", ")}`);

  // Feats
  if (item.prerequisites && item.prerequisites.length > 0) {
    const reqs = item.prerequisites.map((p) => Object.values(p).join(" ")).join(", ");
    lines.push(`Prerequisites: ${reqs}`);
  }

  // Description
  if (item.desc && Array.isArray(item.desc)) lines.push(...item.desc);
  if (lines.length === 0) lines.push(`No additional details available for ${item.name}.`);

  return lines;
}

/**
 * Helper: Returns tooltip content (loading, error, or formatted lines)
 */
export function getTooltipContent({ loading, data, error }) {
  if (loading) return <p className="italic text-gray-600">Loading...</p>;
  if (error)
    return <p className="italic text-red-700">Error: {error}</p>;
  if (!data)
    return <p className="italic text-gray-600">No description available.</p>;

  return (
    <ul className="list-disc ml-4">
      {formatItemDetails(data).map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

/**
 * Autocomplete hook — searches API index endpoints for partial matches.
 * Usage: const { suggestions, loading } = useDnDAutocomplete("spells", query);
 */
export function useDnDAutocomplete(endpoint, query) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    async function fetchSuggestions() {
      setLoading(true);
      try {
        const res = await fetch(`https://www.dnd5eapi.co/api/${endpoint}`);
        if (res.ok) {
          const json = await res.json();
          const matches = json.results
            .filter((r) =>
              r.name.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 8);
          if (!cancelled) setSuggestions(matches);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSuggestions();
    return () => (cancelled = true);
  }, [endpoint, query]);

  return { suggestions, loading };
}