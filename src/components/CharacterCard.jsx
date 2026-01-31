import { useState, useEffect, useRef } from "react";
import {
  useEquipmentInfo,
  getTooltipContent,
  useDnDAutocomplete,
} from "../hooks/useDnDAPI";
import { weaponShieldData } from "../data/weaponShieldData";
import { featDescriptions } from "../data/featDescriptions";
import { classFeatureDescriptions } from "../data/classFeatureDescriptions";
import { spellDescriptions } from "../data/spellDescriptions";

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
  localSuggestions,
}) {
  const [query, setQuery] = useState(value || "");
  const { suggestions: apiSuggestions, loading } = useDnDAutocomplete(
    endpoint,
    query,
    !localSuggestions // Disable API hook if local suggestions are provided
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  const suggestions = localSuggestions
    ? localSuggestions
        .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 20)
    : apiSuggestions;

  // Sync internal state when the external value prop changes
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

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

  const [isEditing, setIsEditing] = useState(false);
  const [details, setDetails] = useState({
    race: character.race || "",
    class: character.class || "",
    subClass: character.subClass || "",
    alignment: character.alignment || "",
    specialAbility: character.specialAbility || "",
    familiar: character.familiar || "None",
    bio: character.bio || "",
    picture: character.picture || "",
  });
  const [itemDetails, setItemDetails] = useState({});
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipCoordinates, setTooltipCoordinates] = useState({ x: 0, y: 0 });

  // 🧭 Tooltip positioning
  const handleMouseMove = (e) => {
    setTooltipCoordinates({ x: e.clientX, y: e.clientY });
  };

  // Sync with parent
  useEffect(() => {
    const timeout = setTimeout(() => {
      onUpdate(character.name, {
        stats: { ...stats, ac },
        ...details,
        equipment,
        feats,
        skillsSpells: skills,
        inventory,
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [stats, ac, equipment, feats, skills, inventory, details, character.name, onUpdate]);

  // ✅ Hooks for each equipment slot (moved outside of .map())
  const armorInfo = useEquipmentInfo(equipment.armor);
  const mainHandInfo = useEquipmentInfo(equipment.mainHand);
  const offHandInfo = useEquipmentInfo(equipment.offHand);

  const weaponShieldNamesForAutocomplete = Object.keys(weaponShieldData).map(
    (name) => ({ name })
  );

  const equipmentSlots = [
    { key: "armor", label: "Armor", info: armorInfo },
    { key: "mainHand", label: "Main-Hand", info: mainHandInfo, localSuggestions: weaponShieldNamesForAutocomplete },
    { key: "offHand", label: "Off-Hand", info: offHandInfo, localSuggestions: weaponShieldNamesForAutocomplete },
  ];

  // Calculate AC
  useEffect(() => {
    let baseAC = 10 + getModifier(stats.dexterity || 10);
    const armorData = armorInfo.data;

    // Armor
    if (armorData?.armor_class) {
      const acData = armorData.armor_class;
      baseAC = acData.base || baseAC;
      if (acData.dex_bonus) {
        const dexMod = getModifier(stats.dexterity || 10);
        const maxBonus = acData.max_bonus;
        baseAC += maxBonus ? Math.min(dexMod, maxBonus) : dexMod;
      }
    }

    // Main-Hand and Off-Hand AC bonus
    [equipment.mainHand, equipment.offHand].forEach(hand => {
      if (hand) {
        const item = Object.values(weaponShieldData).find(
          (i) => i.name?.toLowerCase() === hand.toLowerCase() || 
                 (i.aliases && i.aliases.some(a => a.toLowerCase() === hand.toLowerCase()))
        );
        if (item && item.acBonus) {
          baseAC += item.acBonus;
        } else if (hand.toLowerCase().includes("shield")) { // Fallback for shields
          const shield = weaponShieldData["Shield"];
          if(shield && shield.acBonus) baseAC += shield.acBonus;
        }
      }
    });

    setAc(baseAC);
  }, [armorInfo.data, equipment.mainHand, equipment.offHand, stats.dexterity]);

  // Stat modifiers
  const adjustStat = (stat, delta) =>
    setStats((prev) => ({
      ...prev,
      [stat]: Math.max(0, (prev[stat] || 0) + delta),
    }));

  // Equipment handler
  const handleEquipChange = (slot, value) =>
    setEquipment((prev) => ({ ...prev, [slot]: value }));

  // Details handler
  const handleDetailChange = (e) =>
    setDetails((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePictureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setDetails((prev) => ({
          ...prev,
          picture: loadEvent.target.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };
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

  useEffect(() => {
    async function fetchItems() {
      const details = {};
      for (const name of inventory) {
        const itemData = await fetch(
          `https://www.dnd5eapi.co/api/magic-items/${name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")}`
        );
        if (itemData.ok) {
          details[name] = await itemData.json();
        }
      }
      setItemDetails(details);
    }
    fetchItems();
  }, [inventory]);
  
  const getModifier = (val) => Math.floor((val - 10) / 2);

  const allSkills = { ...spellDescriptions, ...classFeatureDescriptions };
  const skillAndFeatureNamesForAutocomplete = Object.keys(allSkills).map(
    (name) => ({ name })
  );

  // Create a list of feat names for local autocomplete
  const featNamesForAutocomplete = Object.keys(featDescriptions).map(
    (name) => ({ name })
  );

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
          <div className="relative flex flex-col bg-[#fff9e6] border border-gray-400 rounded-md p-3 w-full lg:w-1/3 shadow-inner text-[15px]">
            {isEditing ? (
              <button onClick={() => setIsEditing(false)} className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded hover:bg-green-700">
                Save
              </button>
            ) : (
              <button onClick={() => setIsEditing(true)} className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded hover:bg-blue-700">
                Edit
              </button>
            )}

            {/* CHARACTER PICTURE */}
            <div className="mb-4 flex justify-center">
              <div className="relative w-32 h-32">
                <img
                  src={details.picture || "/pictures/default-avatar.png"}
                  alt="Character Portrait"
                  className="w-32 h-32 object-cover rounded-full border-2 border-gray-600 shadow-md"
                />
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-1 cursor-pointer hover:bg-blue-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePictureUpload} />
                  </label>
                )}
              </div>
            </div>

            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pr-16">
                  <div>
                    <label className="font-bold">RACE:</label>
                    <input type="text" name="race" value={details.race} onChange={handleDetailChange} className="border rounded w-full p-1 mt-1 text-sm" />
                  </div>
                  <div>
                    <label className="font-bold">ALIGNMENT:</label>
                    <input type="text" name="alignment" value={details.alignment} onChange={handleDetailChange} className="border rounded w-full p-1 mt-1 text-sm" />
                  </div>
                  <div>
                    <label className="font-bold">CLASS:</label>
                    <input type="text" name="class" value={details.class} onChange={handleDetailChange} className="border rounded w-full p-1 mt-1 text-sm" />
                  </div>
                  <div>
                    <label className="font-bold">SUBCLASS:</label>
                    <input type="text" name="subClass" value={details.subClass} onChange={handleDetailChange} className="border rounded w-full p-1 mt-1 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="font-bold">SPECIAL ABILITY:</label>
                    <input type="text" name="specialAbility" value={details.specialAbility} onChange={handleDetailChange} className="border rounded w-full p-1 mt-1 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="font-bold">FAMILIAR:</label>
                    <select name="familiar" value={details.familiar} onChange={handleDetailChange} className="border rounded w-full p-1 mt-1 text-sm">
                      {["None", "Cat", "Raven", "Owl", "Lizard", "Snake", "Parrot", "Frog", "Monkey"].map((fam) => (
                        <option key={fam}>{fam}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 border-t border-gray-500 pt-2">
                  <label className="font-bold">BIO / BACKGROUND:</label>
                  <textarea name="bio" value={details.bio} onChange={handleDetailChange} className="border rounded w-full p-2 mt-1 text-sm" rows={4} />
                </div>
              </>
            ) : (
              <>
                <div className="pr-16">
                  <p>
                    <strong>RACE:</strong> {details.race}
                  </p>
                  <p>
                    <strong>CLASS:</strong> {details.class} {details.subClass && `(${details.subClass})`}
                  </p>
                  <p>
                    <strong>ALIGNMENT:</strong> {details.alignment}
                  </p>
                  <p>
                    <strong>SPECIAL ABILITY:</strong> {details.specialAbility}
                  </p>
                  <p>
                    <strong>FAMILIAR:</strong> {details.familiar}
                  </p>
                </div>
                <div className="mt-3 border-t border-gray-500 pt-2">
                  <p>
                    <strong>BIO / BACKGROUND:</strong>
                  </p>
                  <p className="italic whitespace-pre-line text-sm">
                    {details.bio}
                  </p>
                </div>
              </>
            )}
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
              {/* LEVEL COUNTER */}
              <div className="col-span-2 flex flex-col items-center justify-center border-2 border-yellow-700 rounded-lg py-1.5 mb-2 shadow-md bg-yellow-400">
                <span className="uppercase text-sm font-bold tracking-wider text-black">
                  Level
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => adjustStat("level", -1)}
                    className="bg-[#b33] text-white rounded-md px-2 text-lg font-bold leading-none"
                  >
                    −
                  </button>
                  <span className="font-mono w-8 text-center text-2xl font-bold text-black">
                    {stats.level || 1}
                  </span>
                  <button
                    onClick={() => adjustStat("level", 1)}
                    className="bg-[#2d7a2d] text-white rounded-md px-2 text-lg font-bold leading-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* HP COUNTERS */}
              <div className="grid grid-cols-2 gap-2 my-2">
                {/* Current HP */}
                <div className="flex flex-col items-center justify-center border-2 border-green-700 rounded-lg py-1.5 shadow-md bg-green-400">
                  <span className="uppercase text-xs font-bold tracking-wider text-black">
                    Current HP
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <button onClick={() => adjustStat("currentHP", -1)} className="bg-[#b33] text-white rounded-md px-2 text-base font-bold leading-none"> − </button>
                    <span className="font-mono w-8 text-center text-xl font-bold text-black">
                      {stats.currentHP || 0}
                    </span>
                    <button onClick={() => adjustStat("currentHP", 1)} className="bg-[#2d7a2d] text-white rounded-md px-2 text-base font-bold leading-none"> + </button>
                  </div>
                </div>
                {/* Max HP */}
                <div className="flex flex-col items-center justify-center border-2 border-gray-600 rounded-lg py-1.5 shadow-md bg-gray-400">
                  <span className="uppercase text-xs font-bold tracking-wider text-black">
                    Max HP
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <button onClick={() => adjustStat("maxHP", -1)} className="bg-[#b33] text-white rounded-md px-2 text-base font-bold leading-none"> − </button>
                    <span className="font-mono w-8 text-center text-xl font-bold text-black">
                      {stats.maxHP || 10}
                    </span>
                    <button onClick={() => adjustStat("maxHP", 1)} className="bg-[#2d7a2d] text-white rounded-md px-2 text-base font-bold leading-none"> + </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 text-sm">
                {Object.entries(stats).map(([key, val]) => {
                  if (
                    key.toLowerCase() === "ac" ||
                    key.toLowerCase() === "level" ||
                    key.toLowerCase() === "maxhp" || // Intentionally lowercase for matching
                    key.toLowerCase() === "currenthp" // Intentionally lowercase for matching
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
              {equipmentSlots.map(({ key, label, info, localSuggestions }) => (
                <div
                  key={key}
                  className="mb-2 relative group"
                  onMouseEnter={(e) => {
                    setHoveredItem(key);
                    handleMouseMove(e);
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  onMouseMove={handleMouseMove}
                >
                  <label className="capitalize font-semibold">{label}:</label>
                  <AutoInput
                    endpoint="equipment"
                    value={equipment[key] || ""}
                    onChange={(val) => handleEquipChange(key, val)}
                    placeholder={label}
                    localSuggestions={localSuggestions}
                  />
                  {hoveredItem === key && (
                    <div
                      className="bg-[#fff9e6] border border-gray-700 rounded p-2 text-xs w-60 shadow-lg transition-opacity duration-150 ease-in-out"
                      style={{
                        position: "fixed",
                        top: tooltipCoordinates.y - 150,
                        left: tooltipCoordinates.x - 60,
                        whiteSpace: "normal",
                        pointerEvents: "none",
                      }}
                    >
                      {getTooltipContent({
                        loading: info.loading,
                        data: info.data,
                        error: info.error,
                      })}
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
              value=""
              onChange={() => {}}
              onAdd={(name) => handleAdd(setFeats, feats, name)}
              localSuggestions={featNamesForAutocomplete}
              placeholder="Enter a Feat"
            />
            <ul className="space-y-1 mt-1">
              {feats.map((f) => (
                                <li
                                  key={f}
                                  className="flex justify-between items-center relative group"
                                  onMouseEnter={(e) => {
                                    setHoveredItem(f);
                                    handleMouseMove(e);
                                  }}
                                  onMouseLeave={() => setHoveredItem(null)}
                                  onMouseMove={handleMouseMove}
                                >
                                  <span>{f}</span>
                                  {hoveredItem === f && (
                    <div
                      className="bg-[#fff9e6] border border-gray-700 rounded p-2 text-xs w-60 shadow-lg transition-opacity duration-150 ease-in-out"
                      style={{
                        position: "fixed",
                        top: tooltipCoordinates.y - 150,
                        left: tooltipCoordinates.x - 60,
                        whiteSpace: "normal",
                        pointerEvents: "none",
                      }}
                    >
                      <strong className="block mb-1">{f}</strong>
                      {featDescriptions[f] ? (
                        <p>{featDescriptions[f]}</p>
                      ) : (
                        "No data available for this feat."
                      )}
                    </div>
                  )}
                                  <button
                                    onClick={() => handleRemove(setFeats, feats, f)}
                                    className="text-red-700 font-bold"
                                  >
                                    X
                                  </button>
                                </li>              ))}
            </ul>
          </div>

          {/* SKILLS & SPELLS */}
          <div className="bg-[#8bf7ee] border border-gray-700 rounded-md p-2">
            <h3 className="font-[Cinzel] font-bold text-center border-b border-gray-700 mb-1">
              SKILLS & SPELLS
            </h3>
            <AutoInput
              localSuggestions={skillAndFeatureNamesForAutocomplete}
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
                    handleMouseMove(e);
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  onMouseMove={handleMouseMove}
                >
                  <span>{s}</span>
                  {hoveredItem === s && (
                    <div
                      className="bg-[#fff9e6] border border-gray-700 rounded p-2 text-xs w-60 shadow-lg transition-opacity duration-150 ease-in-out"
                      style={{
                        position: "fixed",
                        top: tooltipCoordinates.y - 150,
                        left: tooltipCoordinates.x - 60,
                        whiteSpace: "normal",
                        pointerEvents: "none",
                      }}
                    >
                      <strong className="block mb-1">{s}</strong>
                      {allSkills[s] ? (
                        <p>{allSkills[s]}</p>
                      ) : (
                        "No description available for this spell or feature."
                      )}
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
                    handleMouseMove(e);
                  }}
                  onMouseLeave={() => setHoveredItem(null)}
                  onMouseMove={handleMouseMove}
                >
                  <span>{i}</span>
                  {hoveredItem === i && (
                    <div
                      className="bg-[#fff9e6] border border-gray-700 rounded p-2 text-xs w-60 shadow-lg transition-opacity duration-150 ease-in-out"
                      style={{
                        position: "fixed",
                        top: tooltipCoordinates.y - 150,
                        left: tooltipCoordinates.x - 60,
                        whiteSpace: "normal",
                        pointerEvents: "none",
                      }}
                    >
                      <strong className="block mb-1">{i}</strong>
                      {itemDetails[i]
                        ? getTooltipContent({
                            loading: false,
                            data: itemDetails[i],
                          })
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
