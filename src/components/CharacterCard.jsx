import { useState, useEffect, useRef } from "react";
import {
  useEquipmentInfo,
  getTooltipContent,
  useDnDAutocomplete,
  useFeatureInfo,
} from "../hooks/useDnDAPI";
import { featDescriptions } from "../data/featDescriptions";

// Utility to safely create API slugs
const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

// ─────────────────────────────────────────────
// Autocomplete Input Component
// ─────────────────────────────────────────────
function AutoInput({
  endpoint,
  value,
  onChange,
  onAdd,
  placeholder,
  onFocus,
  onMouseEnter,
}) {
  const [query, setQuery] = useState(value || "");
  const { suggestions, loading } = useDnDAutocomplete(endpoint, query);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Close autocomplete when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleSelect = (name) => {
    setQuery(name);
    onChange(name);
    if (onAdd) onAdd(name);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        className="border border-gray-600 rounded w-full p-0.5 text-sm bg-[#fffbe6]"
        onFocus={() => {
          onFocus?.();
          setShowSuggestions(true);
        }}
        onMouseEnter={onMouseEnter}
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          onChange(val);
          if (val.trim()) setShowSuggestions(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && query.trim()) {
            e.preventDefault();
            handleSelect(query.trim());
          }
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />

      {loading && showSuggestions && (
        <div className="absolute left-0 right-0 bg-[#fff9e6] border border-gray-700 text-xs p-1 italic text-gray-600 z-20">
          Searching...
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 bg-[#fff9e6] border border-gray-700 rounded-md shadow-lg z-30 max-h-40 overflow-y-auto text-sm">
          {suggestions.map((s, idx) => (
            <li
              key={idx}
              className="px-2 py-1 hover:bg-[#f1e3b1] cursor-pointer flex justify-between"
              onClick={() => handleSelect(s.name)}
            >
              <span>{s.name}</span>
              {s.source && (
                <span className="text-gray-500 text-xs italic">
                  ({s.source})
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main CharacterCard Component
// ─────────────────────────────────────────────
export default function CharacterCard({ character, onDelete, onUpdate }) {
  const [stats, setStats] = useState({ ...character.stats });
  const [equipment, setEquipment] = useState({ ...character.equipment });
  const [ac, setAc] = useState(character.stats.ac || 10);
  const [feats, setFeats] = useState([...(character.feats || [])]);
  const [skills, setSkills] = useState([...(character.skillsSpells || [])]);
  const [inventory, setInventory] = useState([...(character.inventory || [])]);

  const [featDetails, setFeatDetails] = useState({});
  const [spellDetails, setSpellDetails] = useState({});
  const [itemDetails, setItemDetails] = useState({});

  const prevCharName = useRef(character.name);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoveredEquip, setHoveredEquip] = useState(null);

  // 🧭 Tooltip positioning
  const [tooltipPosition, setTooltipPosition] = useState("below");
  const handleTooltipPosition = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < tooltipHeight && spaceAbove > spaceBelow) {
      setTooltipPosition("above");
    } else {
      setTooltipPosition("below");
    }
  };

  // Reset character state when switching tabs
  useEffect(() => {
    if (prevCharName.current !== character.name) {
      setStats({ ...character.stats });
      setEquipment({ ...character.equipment });
      setAc(character.stats.ac || 10);
      setFeats([...(character.feats || [])]);
      setSkills([...(character.skillsSpells || [])]);
      setInventory([...(character.inventory || [])]);
      prevCharName.current = character.name;
    }
  }, [character]);

  // Sync with parent
  useEffect(() => {
    const timeout = setTimeout(() => {
      onUpdate(character.name, {
        stats: { ...stats, ac },
        equipment,
        feats,
        skillsSpells: skills,
        inventory,
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [stats, ac, equipment, feats, skills, inventory]);

  // ✅ Hooks for each equipment slot (moved outside of .map())
  const headInfo = useEquipmentInfo(equipment.head);
  const armorInfo = useEquipmentInfo(equipment.armor);
  const mainHandInfo = useEquipmentInfo(equipment.mainHand);
  const offHandInfo = useEquipmentInfo(equipment.offHand);
  const trinketInfo = useEquipmentInfo(equipment.trinket);

  const equipmentSlots = [
    { key: "head", label: "Head", info: headInfo },
    { key: "armor", label: "Armor", info: armorInfo },
    { key: "mainHand", label: "Main-Hand", info: mainHandInfo },
    { key: "offHand", label: "Off-Hand", info: offHandInfo },
    { key: "trinket", label: "Trinket", info: trinketInfo },
  ];

  const hoveredFeatureInfo = useFeatureInfo(hoveredItem);

  // Calculate AC
  const getModifier = (val) => Math.floor((val - 10) / 2);
  useEffect(() => {
    let baseAC = 10 + getModifier(stats.dexterity || 10);
    const armorData = armorInfo.data;
    const offhandData = offHandInfo.data;

    if (armorData?.armor_class) {
      const acData = armorData.armor_class;
      baseAC = acData.base || baseAC;
      if (acData.dex_bonus) {
        const dexMod = getModifier(stats.dexterity || 10);
        const maxBonus = acData.max_bonus;
        baseAC += maxBonus ? Math.min(dexMod, maxBonus) : dexMod;
      }
    }

    if (offhandData?.armor_class?.base) {
      baseAC += offhandData.armor_class.base;
    } else if (
      equipment.offHand?.toLowerCase().includes("shield") &&
      !offhandData
    ) {
      baseAC += 2;
    }

    setAc(baseAC);
  }, [armorInfo.data, offHandInfo.data, stats.dexterity, equipment]);

  // Stat modifiers
  const adjustStat = (stat, delta) =>
    setStats((prev) => ({
      ...prev,
      [stat]: Math.max(0, (prev[stat] || 0) + delta),
    }));

  // Equipment handler
  const handleEquipChange = (slot, value) =>
    setEquipment((prev) => ({ ...prev, [slot]: value }));

  // Add / remove list entries
  const handleAdd = (setter, list, val) => {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) setter([...list, trimmed]);
  };

  const handleRemove = (setter, list, val) =>
    setter(list.filter((x) => x !== val));

  // Color modifiers
  const getModColor = (mod) => {
    if (mod >= 3) return "bg-green-500 border-green-700 text-white";
    if (mod >= 1) return "bg-green-300 border-green-600 text-black";
    if (mod === 0) return "bg-gray-200 border-gray-600 text-black";
    if (mod <= -3) return "bg-red-800 border-red-950 text-white";
    return "bg-red-400 border-red-700 text-black";
  };

  // Fetch API tooltips
  useEffect(() => {
    async function fetchFeats() {
      const details = {};
      for (const name of feats) {
        try {
          const res = await fetch(
            `https://www.dnd5eapi.co/api/feats/${slugify(name)}`
          );
          if (res.ok) details[name] = await res.json();
        } catch {}
      }
      setFeatDetails(details);
    }
    fetchFeats();
  }, [feats]);

  useEffect(() => {
    async function fetchSpells() {
      const details = {};
      for (const name of skills) {
        try {
          const res = await fetch(
            `https://www.dnd5eapi.co/api/spells/${slugify(name)}`
          );
          if (res.ok) details[name] = await res.json();
        } catch {}
      }
      setSpellDetails(details);
    }
    fetchSpells();
  }, [skills]);

  useEffect(() => {
    async function fetchItems() {
      const details = {};
      for (const name of inventory) {
        try {
          const res = await fetch(
            `https://www.dnd5eapi.co/api/magic-items/${slugify(name)}`
          );
          if (res.ok) details[name] = await res.json();
        } catch {}
      }
      setItemDetails(details);
    }
    fetchItems();
  }, [inventory]);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="bg-[#5b3212] border-2 border-black rounded-xl p-2 shadow-lg">
      <div className="bg-[#f5e4c1] border border-black rounded-lg p-4 md:p-6">
        {/* HEADER */}
        <div className="bg-linear-to-b from-[#c88b3a] to-[#a26a1f] border-2 border-black rounded-md text-center py-1 mb-3">
          <h2 className="text-3xl font-[Cinzel] font-bold text-black tracking-wide">
            {character.name.toUpperCase()}
          </h2>
        </div>
        {/* MAIN CONTENT */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* LEFT COLUMN */}
          <div className="flex flex-col bg-[#fff9e6] border border-gray-400 rounded-md p-3 w-full lg:w-1/3 shadow-inner text-[15px]">
            <p>
              <strong>RACE:</strong> {character.race}
            </p>
            <p>
              <strong>CLASS:</strong> {character.class} ({character.subClass})
            </p>
            <p>
              <strong>ALIGNMENT:</strong> {character.alignment}
            </p>
            <p>
              <strong>SPECIAL ABILITY:</strong> {character.specialAbility}
            </p>
            <p>
              <strong>FAMILIAR:</strong> {character.familiar}
            </p>
            <div className="mt-3 border-t border-gray-500 pt-2">
              <p>
                <strong>BIO / BACKGROUND:</strong>
              </p>
              <p className="italic whitespace-pre-line text-sm">
                {character.bio}
              </p>
            </div>
          </div>

          {/* STATS + EQUIPMENT */}
          <div className="flex flex-col lg:flex-row justify-between gap-3 flex-1">
            {/* STATS */}
            <div className="bg-[#e6e08c] border border-gray-700 rounded-md p-2 w-full lg:w-60">
              <h3 className="font-[Cinzel] font-bold text-center border-b border-gray-700 mb-1 text-sm tracking-wide">
                STATS
              </h3>
              <div className="text-center font-semibold text-base mb-1">
                AC: <span className="text-lg font-bold text-black">{ac}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-sm">
                {Object.entries(stats).map(([key, val]) => {
                  if (
                    key.toLowerCase() === "ac" ||
                    key.toLowerCase() === "level"
                  )
                    return null;
                  const mod = getModifier(val);
                  const formatted = mod >= 0 ? `+${mod}` : mod;
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center justify-center border border-gray-400 rounded-md py-1 shadow-sm bg-[#f6f3c1]"
                    >
                      <div
                        className={`border rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold mb-0.5 ${getModColor(
                          mod
                        )}`}
                      >
                        {formatted}
                      </div>
                      <span className="capitalize text-xs font-semibold">
                        {key}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <button
                          onClick={() => adjustStat(key, -1)}
                          className="bg-[#b33] text-white rounded px-1 text-xs leading-none"
                        >
                          −
                        </button>
                        <span className="font-mono w-5 text-center text-sm">
                          {val}
                        </span>
                        <button
                          onClick={() => adjustStat(key, 1)}
                          className="bg-[#2d7a2d] text-white rounded px-1 text-xs leading-none"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EQUIPMENT */}
            <div className="bg-[#c4f18c] border border-gray-700 rounded-md p-3 w-full lg:w-60">
              <h3 className="font-[Cinzel] font-bold text-center border-b border-gray-700 mb-2">
                EQUIPMENT
              </h3>
              {equipmentSlots.map(({ key, label, info }) => (
                <div
                  key={key}
                  className="mb-2 relative group"
                  onMouseEnter={(e) => {
                    setHoveredEquip(key);
                    handleTooltipPosition(e);
                  }}
                  onMouseLeave={() => setHoveredEquip(null)}
                >
                  <label className="capitalize font-semibold">{label}:</label>
                  <AutoInput
                    endpoint="equipment"
                    value={equipment[key] || ""}
                    onChange={(val) => handleEquipChange(key, val)}
                    placeholder={label}
                  />
                  {hoveredEquip === key && (
                    <div
                      className={`absolute left-0 ${
                        tooltipPosition === "above"
                          ? "bottom-full mb-2"
                          : "top-full mt-2"
                      } bg-[#fff9e6] border border-gray-700 rounded p-2 text-xs w-60 shadow-lg z-50`}
                      style={{
                        position: "absolute",
                        whiteSpace: "normal",
                        pointerEvents: "auto",
                      }}
                    >
                      {getTooltipContent({ loading: info.loading, data: info.data, error: info.error })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FEATS / SKILLS / INVENTORY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-sm">
          {/* FEATS */}
          <div className="bg-[#f7a468] border border-gray-700 rounded-md p-2">
            <h3 className="font-[Cinzel] font-bold text-center border-b border-gray-700 mb-1">
              FEATS
            </h3>
            <AutoInput
              endpoint="feats"
              value=""
              onChange={() => {}}
              onAdd={(name) => handleAdd(setFeats, feats, name)}
              placeholder="Enter a Feat"
            />
            <ul className="space-y-1 mt-1">
              {feats.map((f) => (
                <li
                  key={f}
                  className="flex justify-between items-center relative group"
                  onMouseEnter={(e) => {
                    setHoveredItem(f);
                    handleTooltipPosition(e);
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span>{f}</span>
                  {hoveredItem === f && (
                    <div
                      className={`absolute left-0 ${
                        tooltipPosition === "above"
                          ? "bottom-full mb-2"
                          : "top-full mt-2"
                      } bg-[#fff9e6] border border-gray-700 rounded p-2 text-xs w-60 shadow-lg z-50 transition-opacity duration-150 ease-in-out ${
                        hoveredItem === f ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        position: "absolute",
                        whiteSpace: "normal",
                        pointerEvents: "auto",
                      }}
                    >
                      <strong className="block mb-1">{f}</strong>
                      {featDetails[f]
                        ? getTooltipContent({ loading: false, data: featDetails[f] })
                        : featDescriptions[f]
                        ? featDescriptions[f]
                        : "No data available for this feat."}
                    </div>
                  )}
                  <button
                    onClick={() => handleRemove(setFeats, feats, f)}
                    className="text-red-700 font-bold"
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* SKILLS & SPELLS */}
          <div className="bg-[#8bf7ee] border border-gray-700 rounded-md p-2">
            <h3 className="font-[Cinzel] font-bold text-center border-b border-gray-700 mb-1">
              SKILLS & SPELLS
            </h3>
            <AutoInput
              endpoint="spells"
              value=""
              onChange={() => {}}
              onAdd={(name) => handleAdd(setSkills, skills, name)}
              placeholder="Enter a Skill, Spell, or Class Feature"
            />
            <ul className="space-y-1 mt-1">
              {skills.map((s) => (
                <li
                  key={s}
                  className="flex justify-between items-center relative group"
                  onMouseEnter={(e) => {
                    setHoveredItem(s);
                    handleTooltipPosition(e);
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span>{s}</span>
                  {hoveredItem === s && (
                    <div
                      className={`absolute left-0 ${
                        tooltipPosition === "above"
                          ? "bottom-full mb-2"
                          : "top-full mt-2"
                      } bg-[#fff9e6] border border-gray-700 rounded p-2 text-xs w-60 shadow-lg z-50 transition-opacity duration-150 ease-in-out ${
                        hoveredItem === s ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        position: "absolute",
                        whiteSpace: "normal",
                        pointerEvents: "auto",
                      }}
                    >
                      <strong className="block mb-1">{s}</strong>
                      {spellDetails[s]
                        ? getTooltipContent({ loading: false, data: spellDetails[s] })
                        : hoveredFeatureInfo.data
                        ? getTooltipContent({ loading: false, data: hoveredFeatureInfo.data })
                        : "No description available for this spell or feature."}
                    </div>
                  )}
                  <button
                    onClick={() => handleRemove(setSkills, skills, s)}
                    className="text-red-700 font-bold"
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* INVENTORY */}
          <div className="bg-[#db9d18] border border-gray-700 rounded-md p-2">
            <h3 className="font-[Cinzel] font-bold text-center border-b border-gray-700 mb-1">
              INVENTORY
            </h3>
            <AutoInput
              endpoint="magic-items"
              value=""
              onChange={() => {}}
              onAdd={(name) => handleAdd(setInventory, inventory, name)}
              placeholder="Enter an Item"
            />
            <ul className="space-y-1 mt-1">
              {inventory.map((i) => (
                <li
                  key={i}
                  className="flex justify-between items-center relative group"
                  onMouseEnter={(e) => {
                    setHoveredItem(i);
                    handleTooltipPosition(e);
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span>{i}</span>
                  {hoveredItem === i && (
                    <div
                      className={`absolute left-0 ${
                        tooltipPosition === "above"
                          ? "bottom-full mb-2"
                          : "top-full mt-2"
                      } bg-[#fff9e6] border border-gray-700 rounded p-2 text-xs w-60 shadow-lg z-50 transition-opacity duration-150 ease-in-out ${
                        hoveredItem === i ? "opacity-100" : "opacity-0"
                      }`}
                      style={{
                        position: "absolute",
                        whiteSpace: "normal",
                        pointerEvents: "auto",
                      }}
                    >
                      <strong className="block mb-1">{i}</strong>
                      {itemDetails[i]
                        ? getTooltipContent({ loading: false, data: itemDetails[i] })
                        : "No data available for this item."}
                    </div>
                  )}
                  <button
                    onClick={() => handleRemove(setInventory, inventory, i)}
                    className="text-red-700 font-bold"
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* DELETE BUTTON */}
        <button
          onClick={onDelete}
          className="mt-4 bg-[#b40000] text-white font-bold border-2 border-black w-full py-2 rounded hover:bg-[#d40000]"
        >
          --Delete Character (!!!WARNING!!! Once Deleted, All Data Will Be Lost And CANNOT Be Retrieved!)--
        </button>
      </div>
    </div>
  );
}
