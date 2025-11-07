import { useState } from "react";

export default function CharacterForm({ addCharacter }) {
  const [formData, setFormData] = useState({
    name: "",
    race: "",
    class: "",
    subClass: "",
    alignment: "",
    specialAbility: "",
    familiar: "None",
    bio: "",
  });

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newChar = {
      ...formData,
      stats: {
        level: 1,
        strength: 3,
        dexterity: 3,
        constitution: 3,
        intelligence: 3,
        wisdom: 3,
        charisma: 3,
      },
      feats: [],
      skillsSpells: [],
      inventory: [],
      equipment: {},
    };
    addCharacter(newChar);
    setFormData({
      name: "",
      race: "",
      class: "",
      subClass: "",
      alignment: "",
      specialAbility: "",
      familiar: "None",
      bio: "",
    });
  };

  return (
<form
  onSubmit={handleSubmit}
  className="bg-[#fff0cc] border-2 border-gray-700 rounded-xl p-6 shadow-lg"
>
  <fieldset className="border-2 border-black rounded-xl p-4">
    <legend className="px-3 py-1 bg-yellow-400 font-[Cinzel] text-2xl border border-black rounded-md">
      Character Creation
    </legend>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["name", "race", "class", "subClass", "alignment", "specialAbility"].map(
            (field) => (
              <div key={field}>
                <label className="font-bold capitalize">{field}:</label>
                <input
                  type="text"
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  className="border rounded w-full p-1 mt-1"
                />
              </div>
            )
          )}

          <div>
            <label className="font-bold">Familiar:</label>
            <select
              name="familiar"
              value={formData.familiar}
              onChange={handleChange}
              className="border rounded w-full p-1 mt-1"
            >
              {[
                "None",
                "Cat",
                "Raven",
                "Owl",
                "Lizard",
                "Snake",
                "Parrot",
                "Frog",
                "Monkey",
              ].map((fam) => (
                <option key={fam}>{fam}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="font-bold">Bio / Background:</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              className="border rounded w-full p-2 mt-1"
              rows={4}
            />
          </div>
        </div>

        <div className="mt-4 flex gap-4">
          <button
            type="submit"
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
          >
            Add Character
          </button>
          <button
            type="reset"
            onClick={() =>
              setFormData({
                name: "",
                race: "",
                class: "",
                subClass: "",
                alignment: "",
                specialAbility: "",
                familiar: "None",
                bio: "",
              })
            }
            className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
          >
            Reset
          </button>
        </div>
      </fieldset>
    </form>
  );
}