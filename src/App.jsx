import { useState, useEffect } from "react";
import CharacterForm from "./components/CharacterForm";
import CharacterCard from "./components/CharacterCard";

export default function App() {
  // ────────────────────────────────
  // Load characters from localStorage
  // ────────────────────────────────
  const [characters, setCharacters] = useState(() => {
    const saved = localStorage.getItem("characters");
    const initialChars = saved ? JSON.parse(saved) : [];

    // Data migration: remove 'head' and 'trinket' fields from existing characters
    return initialChars.map((char) => {
      if (char.equipment) {
        delete char.equipment.head;
        delete char.equipment.trinket;
      }
      return char;
    });
  });

  // Track which tab is active ("create" or a character name)
  const [activeTab, setActiveTab] = useState("create");

  // ────────────────────────────────
  // Save to localStorage whenever characters change
  // ────────────────────────────────
  useEffect(() => {
    localStorage.setItem("characters", JSON.stringify(characters));
  }, [characters]);

  // ────────────────────────────────
  // Add, Delete, Update Characters
  // ────────────────────────────────
  const addCharacter = (char) => {
    setCharacters([...characters, char]);
    setActiveTab(char.name); // switch to new tab
  };

  const deleteCharacter = (name) => {
    const updated = characters.filter((c) => c.name !== name);
    setCharacters(updated);
    if (activeTab === name) setActiveTab("create");
  };

  // ✅ This ensures updates only affect the correct character
  const updateCharacter = (name, updatedData) => {
    setCharacters((prev) =>
      prev.map((c) => (c.name === name ? { ...c, ...updatedData } : c))
    );
  };

  const activeCharacter = characters.find((c) => c.name === activeTab);

  // ────────────────────────────────
  // Render
  // ────────────────────────────────
  return (
    <div
      className="min-h-screen font-serif p-6 flex justify-center"
      style={{
        backgroundImage: "url('/pictures/background.jpg')",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        backgroundPosition: "center",
      }}
    >
      {/* Outer parchment wrapper */}
      <div className="w-full max-w-5xl bg-[#d4b670]/95 border-2 border-black rounded-2xl shadow-2xl p-6 md:p-10">
        <img
          src="/pictures/party-tracker-banner.jpg"
          alt="Drink and drink and FIGHT!"
          className="rounded-xl mb-6 w-full border border-black"
        />

        <h1 className="text-4xl font-bold text-center mb-6 font-[Cinzel] text-black drop-shadow-sm">
          D&D Party Tracker
        </h1>

        {/* ────────────── Tab Buttons ────────────── */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {/* Character Creation tab */}
          <button
            onClick={() => setActiveTab("create")}
            className={`px-5 py-2 font-semibold border-2 border-black rounded-t-lg transition
              ${
                activeTab === "create"
                  ? "bg-yellow-300 text-black shadow-inner border-b-[#d4b670]"
                  : "bg-[#fff0cc] text-gray-700 hover:bg-yellow-200"
              }`}
          >
            + Character Creation
          </button>

          {/* One tab per character */}
          {characters.map((c) => (
            <button
              key={c.name}
              onClick={() => setActiveTab(c.name)}
              className={`px-5 py-2 font-semibold border-2 border-black rounded-t-lg transition
                ${
                  activeTab === c.name
                    ? "bg-yellow-300 text-black shadow-inner border-b-[#d4b670]"
                    : "bg-[#fff0cc] text-gray-700 hover:bg-yellow-200"
                }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* ────────────── Tab Content ────────────── */}
        <div className="bg-[#fff0cc] border-2 border-black rounded-b-lg p-6 shadow-inner">
          {activeTab === "create" ? (
            <CharacterForm addCharacter={addCharacter} />
          ) : activeCharacter ? (
            <CharacterCard
              key={activeCharacter.name}
              character={activeCharacter}
              onDelete={() => deleteCharacter(activeCharacter.name)}
              onUpdate={updateCharacter} // 👈 Pass update callback here
            />
          ) : (
            <p className="text-center text-gray-500 italic">
              Select a character tab to view details.
            </p>
          )}
        </div>

        {/* ────────────── Footer ────────────── */}
        <footer className="text-center mt-10 text-sm text-gray-800 font-[Vollkorn]">
          &copy; 2025 Old Gaffer’s Advice and Hobbit Code Keepers —{" "}
          <a
            href="mailto:oldgaffergamgee@gmail.com"
            className="text-blue-700 underline"
          >
            Whisper by Moth!
          </a>
          <br />
          111 Bagshot Row, Hobbiton, SH
        </footer>
      </div>
    </div>
  );
}
