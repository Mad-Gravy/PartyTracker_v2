import CharacterCard from "./CharacterCard";

export default function CharacterList({ characters, deleteCharacter }) {
  if (!characters.length)
    return (
      <p className="text-center italic text-gray-600">
        No characters yet. Fill out the form above to get started!
      </p>
    );

  return (
    <div className="grid gap-4">
      {characters.map((char, i) => (
        <CharacterCard
          key={i}
          character={char}
          onDelete={() => deleteCharacter(i)}
        />
      ))}
    </div>
  );
}
